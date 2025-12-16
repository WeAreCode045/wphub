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

        console.log('Processing checkout for user:', userId, 'plan:', planId);

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        // Check if subscription already exists
        const existingSubs = await base44.asServiceRole.entities.UserSubscription.filter({
          stripe_subscription_id: subscription.id
        });

        if (existingSubs.length > 0) {
          console.log('Subscription already exists, updating instead');
          await base44.asServiceRole.entities.UserSubscription.update(existingSubs[0].id, {
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
            trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          });
        } else {
          // Create new UserSubscription
          const newSub = await base44.asServiceRole.entities.UserSubscription.create({
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
          
          console.log('Created subscription:', newSub.id);
        }

        await base44.asServiceRole.entities.ActivityLog.create({
          user_email: 'system',
          action: `Subscription aangemaakt via Stripe webhook`,
          entity_type: 'subscription',
          details: `User ID: ${userId}, Subscription ID: ${subscription.id}, Plan ID: ${planId}`
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
          
          console.log('Updated subscription:', subscriptions[0].id);
        } else {
          console.error('Subscription not found for update:', subscription.id);
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
          
          console.log('Canceled subscription:', subscriptions[0].id);
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
          
          console.log('Marked subscription as past_due:', subscriptions[0].id);
        }

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        
        // Find subscription
        if (invoice.subscription) {
          const subscriptions = await base44.asServiceRole.entities.UserSubscription.filter({
            stripe_subscription_id: invoice.subscription
          });

          if (subscriptions.length > 0) {
            const subscription = subscriptions[0];
            
            await base44.asServiceRole.entities.UserSubscription.update(subscription.id, {
              status: 'active'
            });
            
            // Get user and plan details
            const user = await base44.asServiceRole.entities.User.get(subscription.user_id);
            const plan = await base44.asServiceRole.entities.SubscriptionPlan.get(subscription.plan_id);
            
            // Generate invoice number
            const invoiceCount = await base44.asServiceRole.entities.Invoice.list();
            const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount.length + 1).padStart(6, '0')}`;
            
            // Calculate VAT
            const subtotal = invoice.subtotal;
            const vatPercentage = subscription.vat_percentage || plan.vat_rate_percentage || 21;
            const vatAmount = invoice.tax || Math.round(subtotal * (vatPercentage / 100));
            const totalAmount = invoice.amount_paid;
            
            // Create Invoice record
            await base44.asServiceRole.entities.Invoice.create({
              invoice_number: invoiceNumber,
              user_id: subscription.user_id,
              user_email: user.email,
              user_name: user.full_name,
              subscription_id: subscription.id,
              stripe_invoice_id: invoice.id,
              stripe_payment_intent_id: invoice.payment_intent,
              amount: totalAmount,
              subtotal: subtotal,
              vat_amount: vatAmount,
              vat_percentage: vatPercentage,
              currency: invoice.currency.toUpperCase(),
              plan_name: plan.name,
              billing_period: subscription.interval,
              period_start: new Date(invoice.period_start * 1000).toISOString(),
              period_end: new Date(invoice.period_end * 1000).toISOString(),
              status: 'paid',
              paid_at: new Date(invoice.status_transitions.paid_at * 1000).toISOString(),
              description: `${plan.name} - ${subscription.interval === 'month' ? 'Maandelijks' : 'Jaarlijks'} Abonnement`,
              billing_address: invoice.customer_address || {}
            });
            
            console.log('Created invoice:', invoiceNumber);
            console.log('Marked subscription as active:', subscription.id);
          }
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return Response.json({ received: true, event_type: event.type });

  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});