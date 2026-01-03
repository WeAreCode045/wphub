import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsonResponse, corsHeaders } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
    previous_attributes?: any;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.warn('[WEBHOOK] No signature provided');
      return jsonResponse({ error: 'Missing stripe-signature header' }, 400);
    }

    const body = await req.text();

    // Verify webhook signature
    let event: WebhookEvent;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        endpointSecret
      ) as unknown as WebhookEvent;
    } catch (error) {
      console.error('[WEBHOOK] Signature verification failed:', error);
      return jsonResponse(
        { error: 'Invalid webhook signature' },
        401
      );
    }

    console.log(`[WEBHOOK] Received event: ${event.type}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, event.data.previous_attributes, supabase);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, supabase);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object, supabase);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object, supabase);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object, supabase);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object, supabase);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object, supabase);
        break;

      default:
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});

async function handleSubscriptionUpdated(
  subscription: any,
  previousAttributes: any,
  supabase: any
) {
  console.log(`[WEBHOOK] Subscription updated: ${subscription.id}`);

  try {
    // Sync subscription data
    const { error } = await supabase
      .from('stripe.subscriptions')
      .upsert(
        {
          id: subscription.id,
          customer: subscription.customer,
          status: subscription.status,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          items: JSON.stringify(subscription.items.data),
          metadata: subscription.metadata,
          pause_collection: subscription.pause_collection,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.error('[WEBHOOK] Error syncing subscription:', error);
    } else {
      console.log(`[WEBHOOK] Subscription synced: ${subscription.id}`);
    }

    // Log subscription event
    await supabase.from('subscription_events').insert({
      subscription_id: subscription.id,
      event_type: 'subscription_updated',
      previous_status: previousAttributes?.status,
      new_status: subscription.status,
      event_data: previousAttributes,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[WEBHOOK] handleSubscriptionUpdated error:', err);
  }
}

async function handleSubscriptionDeleted(subscription: any, supabase: any) {
  console.log(`[WEBHOOK] Subscription deleted: ${subscription.id}`);

  try {
    // Update subscription status
    const { error } = await supabase
      .from('stripe.subscriptions')
      .update({ status: 'canceled', canceled_at: new Date().toISOString() })
      .eq('id', subscription.id);

    if (error) {
      console.error('[WEBHOOK] Error updating subscription:', error);
    }

    // Log event
    await supabase.from('subscription_events').insert({
      subscription_id: subscription.id,
      event_type: 'subscription_deleted',
      new_status: 'canceled',
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[WEBHOOK] handleSubscriptionDeleted error:', err);
  }
}

async function handleInvoicePaymentFailed(invoice: any, supabase: any) {
  console.log(`[WEBHOOK] Invoice payment failed: ${invoice.id}`);

  try {
    // Log payment failure
    const { error } = await supabase.from('payment_failures').insert({
      invoice_id: invoice.id,
      subscription_id: invoice.subscription,
      customer_id: invoice.customer,
      amount: invoice.amount_due,
      currency: invoice.currency,
      failure_code: invoice.last_payment_error?.code,
      failure_message: invoice.last_payment_error?.message,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[WEBHOOK] Error logging payment failure:', error);
    }

    console.log(
      `[WEBHOOK] Payment failure logged for invoice ${invoice.id}`
    );
  } catch (err) {
    console.error('[WEBHOOK] handleInvoicePaymentFailed error:', err);
  }
}

async function handleInvoicePaymentSucceeded(invoice: any, supabase: any) {
  console.log(`[WEBHOOK] Invoice payment succeeded: ${invoice.id}`);

  try {
    // Mark any pending failures as resolved
    const { error } = await supabase
      .from('payment_failures')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('invoice_id', invoice.id)
      .eq('status', 'pending');

    if (error) {
      console.error('[WEBHOOK] Error updating payment failure:', error);
    }

    // Log event
    await supabase.from('subscription_events').insert({
      subscription_id: invoice.subscription,
      event_type: 'invoice_paid',
      event_data: { invoice_id: invoice.id, amount: invoice.amount_paid },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[WEBHOOK] handleInvoicePaymentSucceeded error:', err);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: any, supabase: any) {
  console.log(`[WEBHOOK] Payment intent succeeded: ${paymentIntent.id}`);

  try {
    // Log event if there's a subscription
    if (paymentIntent.metadata?.price_id) {
      await supabase.from('subscription_events').insert({
        subscription_id: null,
        event_type: 'payment_succeeded',
        event_data: {
          payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount,
        },
        created_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('[WEBHOOK] handlePaymentIntentSucceeded error:', err);
  }
}

async function handlePaymentIntentFailed(paymentIntent: any, supabase: any) {
  console.log(`[WEBHOOK] Payment intent failed: ${paymentIntent.id}`);

  try {
    // Log failure
    await supabase.from('payment_failures').insert({
      payment_intent_id: paymentIntent.id,
      customer_id: paymentIntent.customer,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      failure_code: paymentIntent.last_payment_error?.code,
      failure_message: paymentIntent.last_payment_error?.message,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[WEBHOOK] handlePaymentIntentFailed error:', err);
  }
}

async function handleChargeRefunded(charge: any, supabase: any) {
  console.log(`[WEBHOOK] Charge refunded: ${charge.id}`);

  try {
    // Log refund
    await supabase.from('subscription_events').insert({
      subscription_id: null,
      event_type: 'charge_refunded',
      event_data: {
        charge_id: charge.id,
        amount: charge.amount_refunded,
        reason: charge.refunded,
      },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[WEBHOOK] handleChargeRefunded error:', err);
  }
}
