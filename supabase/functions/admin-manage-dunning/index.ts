import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

interface ManageDunningRequest {
  action: 'retry' | 'forgive' | 'cancel' | 'notify';
  payment_failure_id: string;
  note?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // Authenticate admin user
    const token = extractBearerFromReq(req);
    const caller = await authMeWithToken(token);

    if (!caller) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Check if user is admin
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: user } = await supabase
      .from('public.users')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (user?.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required' }, 403);
    }

    const body = (await req.json()) as ManageDunningRequest;
    const { action, payment_failure_id, note } = body;

    if (!action || !['retry', 'forgive', 'cancel', 'notify'].includes(action)) {
      return jsonResponse(
        { error: 'Invalid action. Must be: retry, forgive, cancel, or notify' },
        400
      );
    }

    if (!payment_failure_id) {
      return jsonResponse({ error: 'payment_failure_id is required' }, 400);
    }

    // Get payment failure record
    const { data: failure } = await supabase
      .from('payment_failures')
      .select('*')
      .eq('id', payment_failure_id)
      .single();

    if (!failure) {
      return jsonResponse({ error: 'Payment failure not found' }, 404);
    }

    let result;

    switch (action) {
      case 'retry':
        result = await handleRetry(failure, supabase, stripe);
        break;

      case 'forgive':
        result = await handleForgive(failure, supabase, note);
        break;

      case 'cancel':
        result = await handleCancel(failure, supabase, stripe, note);
        break;

      case 'notify':
        result = await handleNotify(failure, supabase, note);
        break;
    }

    return jsonResponse({
      success: true,
      action,
      payment_failure_id,
      ...result,
    });
  } catch (error) {
    console.error('[ADMIN-MANAGE-DUNNING] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: message }, 500);
  }
});

async function handleRetry(failure: any, supabase: any, stripe: any) {
  console.log(`[DUNNING] Retrying payment: ${failure.invoice_id}`);

  try {
    if (failure.invoice_id) {
      // Retry invoice payment
      const invoice = await stripe.invoices.retrieve(failure.invoice_id);
      const retry = await stripe.invoices.pay(failure.invoice_id);

      // Update failure record
      await supabase
        .from('payment_failures')
        .update({
          retry_count: (failure.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
        })
        .eq('id', failure.id);

      return {
        message: 'Payment retry initiated',
        invoice_status: retry.status,
      };
    } else if (failure.payment_intent_id) {
      // For payment intents, we can't directly retry, but we can note it
      await supabase
        .from('payment_failures')
        .update({
          retry_count: (failure.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
          status: 'retrying',
        })
        .eq('id', failure.id);

      return {
        message:
          'Retry scheduled for payment intent (automatic retry will occur)',
      };
    }
  } catch (err) {
    console.error('[DUNNING] Retry error:', err);
    throw err;
  }
}

async function handleForgive(failure: any, supabase: any, note?: string) {
  console.log(`[DUNNING] Forgiving payment failure: ${failure.id}`);

  // Update failure record
  const { error } = await supabase
    .from('payment_failures')
    .update({
      status: 'forgiven',
      resolved_at: new Date().toISOString(),
      admin_note: note,
    })
    .eq('id', failure.id);

  if (error) throw error;

  return {
    message: 'Payment failure forgiven',
    note,
  };
}

async function handleCancel(
  failure: any,
  supabase: any,
  stripe: any,
  note?: string
) {
  console.log(`[DUNNING] Canceling subscription for failure: ${failure.id}`);

  try {
    // Cancel subscription if it exists
    if (failure.subscription_id) {
      const subscription = await stripe.subscriptions.del(
        failure.subscription_id
      );

      // Update failure record
      await supabase
        .from('payment_failures')
        .update({
          status: 'subscription_canceled',
          resolved_at: new Date().toISOString(),
          admin_note: note,
        })
        .eq('id', failure.id);

      return {
        message: 'Subscription canceled',
        subscription_id: subscription.id,
        canceled_at: subscription.canceled_at,
      };
    }

    // If no subscription, just mark as cancelled
    await supabase
      .from('payment_failures')
      .update({
        status: 'canceled',
        resolved_at: new Date().toISOString(),
        admin_note: note,
      })
      .eq('id', failure.id);

    return {
      message: 'Payment failure marked as canceled',
    };
  } catch (err) {
    console.error('[DUNNING] Cancel error:', err);
    throw err;
  }
}

async function handleNotify(failure: any, supabase: any, note?: string) {
  console.log(`[DUNNING] Recording notification for failure: ${failure.id}`);

  // Log notification attempt
  const { error } = await supabase.from('subscription_events').insert({
    subscription_id: failure.subscription_id,
    event_type: 'dunning_notification_sent',
    event_data: {
      payment_failure_id: failure.id,
      reason: note || 'Dunning notification',
    },
    created_at: new Date().toISOString(),
  });

  if (error) throw error;

  return {
    message: 'Notification recorded',
    note,
  };
}
