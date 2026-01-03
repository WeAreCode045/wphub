import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[ACCEPT] Starting accept-subscription');
    console.log('[ACCEPT] Request method:', req.method);
    
    // Authenticate user
    const token = extractBearerFromReq(req);
    console.log('[ACCEPT] Token extracted:', token ? 'Yes' : 'No');
    
    const caller = await authMeWithToken(token);
    console.log('[ACCEPT] User authenticated:', caller ? caller.id : 'No');
    
    if (!caller) {
      console.error('[ACCEPT] No caller authenticated');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    console.log('[ACCEPT] Parsing request body...');
    
    // Get request body
    const { subscription_id, payment_method_id } = await req.json();
    
    console.log('[ACCEPT] Request body - subscription_id:', subscription_id, 'payment_method_id:', payment_method_id);
    
    if (!subscription_id || !payment_method_id) {
      return jsonResponse({ error: 'subscription_id and payment_method_id are required' }, 400);
    }

    // Initialize Supabase client
    const supa = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey!
    );

    // Get the pending subscription
    console.log('[ACCEPT] Fetching pending subscription:', subscription_id);
    
    const { data: pendingSub, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('*')
      .eq('id', subscription_id)
      .eq('user_id', caller.id)
      .eq('status', 'pending_acceptance')
      .single();

    if (subError || !pendingSub) {
      console.error('[ACCEPT] Failed to fetch subscription:', subError);
      return jsonResponse({ error: 'Subscription not found or already accepted' }, 404);
    }

    console.log('[ACCEPT] Found pending subscription:', pendingSub.id);

    // Get the plan details
    console.log('[ACCEPT] Fetching plan details for plan_id:', pendingSub.plan_id);
    
    const { data: plan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('*')
      .eq('id', pendingSub.plan_id)
      .single();

    if (planError || !plan) {
      console.error('[ACCEPT] Failed to fetch plan:', planError);
      return jsonResponse({ error: 'Plan not found' }, 404);
    }

    console.log('[ACCEPT] Found plan:', plan.id, plan.name);

    // Get the user
    console.log('[ACCEPT] Fetching user details');
    
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', caller.id)
      .single();

    if (userError || !user) {
      console.error('[ACCEPT] Failed to fetch user:', userError);
      return jsonResponse({ error: 'User not found' }, 404);
    }

    console.log('[ACCEPT] Found user:', user.id, 'stripe_customer_id:', user.stripe_customer_id);

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return jsonResponse({ error: 'Stripe secret key not configured' }, 500);
    }
    
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    // Verify the payment method exists and belongs to this customer
    console.log('[ACCEPT] Verifying payment method:', payment_method_id);
    
    let paymentMethod;
    try {
      paymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);
      console.log('[ACCEPT] Payment method retrieved:', paymentMethod.id);
    } catch (e) {
      console.error('[ACCEPT] Failed to retrieve payment method:', e);
      return jsonResponse({ error: 'Payment method not found' }, 404);
    }

    // Attach payment method to customer if not already attached
    if (paymentMethod.customer !== user.stripe_customer_id) {
      console.log('[ACCEPT] Attaching payment method to customer');
      try {
        await stripe.paymentMethods.attach(payment_method_id, {
          customer: user.stripe_customer_id!,
        });
        console.log('[ACCEPT] Payment method attached');
      } catch (e) {
        console.error('[ACCEPT] Failed to attach payment method:', e);
        // Continue anyway, might already be attached
      }
    }

    // Create Stripe subscription
    console.log('[ACCEPT] Creating Stripe subscription for customer:', user.stripe_customer_id);
    
    const stripeSubscription = await stripe.subscriptions.create({
      customer: user.stripe_customer_id!,
      items: [
        {
          price: plan.stripe_price_id,
        },
      ],
      default_payment_method: payment_method_id,
      // Immediately charge the first payment
      billing_cycle_anchor: undefined,
    });

    console.log('[ACCEPT] Stripe subscription created:', stripeSubscription.id);

    // Update the pending subscription record
    console.log('[ACCEPT] Updating subscription record with stripe subscription_id');
    
    const { data: updatedSub, error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update({
        subscription_id: stripeSubscription.id,
        status: 'active',
        is_active: true,
        period_end_date: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
        metadata: {
          ...pendingSub.metadata,
          accepted_at: new Date().toISOString(),
          accepted_by: caller.id,
        },
      })
      .eq('id', subscription_id)
      .select()
      .single();

    if (updateError || !updatedSub) {
      console.error('[ACCEPT] Failed to update subscription:', updateError);
      // Try to cancel the Stripe subscription since we couldn't update the database
      try {
        await stripe.subscriptions.cancel(stripeSubscription.id);
        console.log('[ACCEPT] Cancelled Stripe subscription due to database error');
      } catch (e) {
        console.error('[ACCEPT] Failed to cancel Stripe subscription:', e);
      }
      return jsonResponse({ error: 'Failed to activate subscription', details: updateError }, 500);
    }

    console.log('[ACCEPT] Successfully accepted subscription:', updatedSub.id);

    return jsonResponse({ 
      success: true,
      message: 'Subscription accepted and activated. Charging your payment method now.',
      subscription: {
        id: updatedSub.id,
        subscription_id: updatedSub.subscription_id,
        status: 'active',
        plan_name: plan.name,
      }
    }, 200);

  } catch (error) {
    console.error('[ACCEPT] Error in accept-subscription:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
