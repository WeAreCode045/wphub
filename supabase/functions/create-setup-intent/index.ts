import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[SETUP] Starting create-setup-intent');
    
    // Authenticate user
    const token = extractBearerFromReq(req);
    const caller = await authMeWithToken(token);
    
    if (!caller) {
      console.error('[SETUP] No caller authenticated');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    console.log('[SETUP] User authenticated:', caller.id);

    // Initialize Supabase client
    const supa = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey!
    );

    // Get the user
    console.log('[SETUP] Fetching user details');
    
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', caller.id)
      .single();

    if (userError || !user) {
      console.error('[SETUP] Failed to fetch user:', userError);
      return jsonResponse({ error: 'User not found' }, 404);
    }

    console.log('[SETUP] Found user:', user.id, 'stripe_customer_id:', user.stripe_customer_id);

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return jsonResponse({ error: 'Stripe secret key not configured' }, 500);
    }
    
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    // Ensure customer exists
    let customerId = user.stripe_customer_id;
    
    if (!customerId) {
      console.log('[SETUP] Creating Stripe customer for user');
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name,
        metadata: {
          platform_user_id: caller.id,
        },
      });
      customerId = customer.id;
      
      // Update user with stripe_customer_id
      await supabaseClient
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', caller.id);
      
      console.log('[SETUP] Stripe customer created:', customerId);
    }

    // Create SetupIntent
    console.log('[SETUP] Creating SetupIntent for customer:', customerId);
    
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session', // For future charges
    });

    console.log('[SETUP] SetupIntent created:', setupIntent.id);

    return jsonResponse({
      success: true,
      client_secret: setupIntent.client_secret,
      customer_id: customerId,
    }, 200);

  } catch (error) {
    console.error('[SETUP] Error in create-setup-intent:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
