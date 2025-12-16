import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import Stripe from 'npm:stripe@14.11.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2023-10-16',
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get the signature from headers
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      return Response.json({ error: 'No signature' }, { status: 400 });
    }

    // Get raw body for signature verification
    const body = await req.text();

    // Verify webhook signature
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('Webhook event received:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.user_id;
        const planId = session.metadata.plan_id;
        const billingCycle = session.metadata.billing_cycle;

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        // Create or update UserSubscription
        await base44.asServiceRole.entities.UserSubscription.create({
          user_id: userId,
          plan_id: planId,
          stripe_customer_id: session.customer,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
          trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
          interval: billingCycle,
          amount: subscription.items.data[0].price.unit_amount,
          currency: subscription.currency.toUpperCase(),
          usage_tracking: {
            plugins_used: 0,
            sites_used: 0,
            teams_used: 0,
            projects_used: 0
          }
        });

        await base44.asServiceRole.entities.ActivityLog.create({
          user_email: 'system',
          action: `Subscription aangemaakt via Stripe webhook`,
          entity_type: 'subscription',
          details: `User ID: ${userId}, Subscription ID: ${subscription.id}`
        });

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        // Find existing subscription
        const subscriptions = await base44.asServiceRole.entities.UserSubscription.filter({
          stripe_subscription_id: subscription.id
        });

        if (subscriptions.length > 0) {
          await base44.asServiceRole.entities.UserSubscription.update(subscriptions[0].id, {
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null
          });
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        // Find and update subscription
        const subscriptions = await base44.asServiceRole.entities.UserSubscription.filter({
          stripe_subscription_id: subscription.id
        });

        if (subscriptions.length > 0) {
          await base44.asServiceRole.entities.UserSubscription.update(subscriptions[0].id, {
            status: 'canceled',
            canceled_at: new Date().toISOString()
          });
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        
        // Find subscription by customer
        const subscriptions = await base44.asServiceRole.entities.UserSubscription.filter({
          stripe_customer_id: invoice.customer
        });

        if (subscriptions.length > 0) {
          await base44.asServiceRole.entities.UserSubscription.update(subscriptions[0].id, {
            status: 'past_due'
          });

          // TODO: Send notification to user about failed payment
        }

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        
        // Find subscription
        const subscriptions = await base44.asServiceRole.entities.UserSubscription.filter({
          stripe_subscription_id: invoice.subscription
        });

        if (subscriptions.length > 0) {
          await base44.asServiceRole.entities.UserSubscription.update(subscriptions[0].id, {
            status: 'active'
          });
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return Response.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});