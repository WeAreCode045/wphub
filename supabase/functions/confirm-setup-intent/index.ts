import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[CONFIRM] Starting confirm-setup-intent');
    
    // Authenticate user
    const token = extractBearerFromReq(req);
    const caller = await authMeWithToken(token);
    
    if (!caller) {
      console.error('[CONFIRM] No caller authenticated');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    console.log('[CONFIRM] User authenticated:', caller.id);

    // Get request body
    const { setup_intent_id } = await req.json();
    
    if (!setup_intent_id) {
      return jsonResponse({ error: 'setup_intent_id is required' }, 400);
    }

    console.log('[CONFIRM] Setup intent ID:', setup_intent_id);

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return jsonResponse({ error: 'Stripe secret key not configured' }, 500);
    }
    
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    // Retrieve the SetupIntent
    console.log('[CONFIRM] Retrieving SetupIntent');
    
    const setupIntent = await stripe.setupIntents.retrieve(setup_intent_id);

    console.log('[CONFIRM] SetupIntent retrieved, status:', setupIntent.status);

    if (setupIntent.status !== 'succeeded') {
      console.error('[CONFIRM] SetupIntent not succeeded, status:', setupIntent.status);
      return jsonResponse({ 
        error: `Setup failed: ${setupIntent.status}`,
        status: setupIntent.status,
      }, 400);
    }

    // Get the payment method that was saved
    const paymentMethodId = setupIntent.payment_method;
    if (!paymentMethodId) {
      return jsonResponse({ error: 'No payment method attached to SetupIntent' }, 400);
    }

    console.log('[CONFIRM] Payment method ID:', paymentMethodId);

    // Initialize Supabase client
    const supa = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey!
    );

    // Verify the payment method belongs to this user's customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId as string);
    
    const { data: user } = await supabaseClient
      .from('users')
      .select('stripe_customer_id')
      .eq('id', caller.id)
      .single();

    if (!user?.stripe_customer_id) {
      return jsonResponse({ error: 'User has no Stripe customer' }, 400);
    }

    if (paymentMethod.customer !== user.stripe_customer_id) {
      console.error('[CONFIRM] Payment method does not belong to user');
      return jsonResponse({ error: 'Payment method does not belong to this user' }, 403);
    }

    console.log('[CONFIRM] Payment method verified');

    // Get the payment method details for the response
    const card = paymentMethod.card;

    return jsonResponse({
      success: true,
      message: 'Payment method added successfully',
      payment_method: {
        id: paymentMethodId,
        brand: card?.brand || 'unknown',
        last4: card?.last4 || 'xxxx',
        exp_month: card?.exp_month,
        exp_year: card?.exp_year,
      },
    }, 200);

  } catch (error) {
    console.error('[CONFIRM] Error in confirm-setup-intent:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
