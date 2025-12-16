import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current active subscription
    const subscriptions = await base44.asServiceRole.entities.UserSubscription.filter({
      user_id: user.id,
      status: ['active', 'trialing']
    });

    if (subscriptions.length === 0) {
      return Response.json({ 
        error: 'No active subscription found' 
      }, { status: 404 });
    }

    const currentSubscription = subscriptions[0];

    // Manual subscriptions cannot be canceled via this endpoint
    if (currentSubscription.is_manual) {
      return Response.json({ 
        error: 'Manual subscriptions must be canceled by an administrator' 
      }, { status: 400 });
    }

    if (!currentSubscription.stripe_subscription_id) {
      return Response.json({ 
        error: 'No Stripe subscription found' 
      }, { status: 404 });
    }

    // Cancel subscription at period end
    const canceledSubscription = await stripe.subscriptions.update(
      currentSubscription.stripe_subscription_id,
      {
        cancel_at_period_end: true
      }
    );

    // Update our database
    await base44.asServiceRole.entities.UserSubscription.update(
      currentSubscription.id,
      {
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString()
      }
    );

    // Create activity log
    await base44.asServiceRole.entities.ActivityLog.create({
      user_email: user.email,
      action: 'Abonnement opgezegd (eindigt aan het einde van de periode)',
      entity_type: 'user',
      entity_id: user.id
    });

    return Response.json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      cancels_at: new Date(canceledSubscription.cancel_at * 1000).toISOString()
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    return Response.json({ 
      error: error.message || 'Failed to cancel subscription' 
    }, { status: 500 });
  }
});