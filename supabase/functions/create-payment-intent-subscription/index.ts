import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

interface CreatePaymentIntentRequest {
  price_id: string;
  metadata?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // Authenticate user
    const token = extractBearerFromReq(req);
    const caller = await authMeWithToken(token);

    if (!caller) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = (await req.json()) as CreatePaymentIntentRequest;
    const { price_id, metadata = {} } = body;

    if (!price_id) {
      return jsonResponse({ error: 'price_id is required' }, 400);
    }

    // Get user and customer info
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: user } = await supabase
      .from('public.users')
      .select('stripe_customer_id, email')
      .eq('id', caller.id)
      .single();

    if (!user?.stripe_customer_id) {
      return jsonResponse(
        { error: 'User does not have a Stripe customer account' },
        400
      );
    }

    // Fetch price to get product and amount
    const price = await stripe.prices.retrieve(price_id);
    if (!price.unit_amount) {
      return jsonResponse(
        { error: 'Invalid price: no amount configured' },
        400
      );
    }

    // Create Payment Intent for subscription mode
    // Note: For subscriptions with Payment Elements, we create a subscription
    // with Payment Intent-like behavior
    const paymentIntent = await stripe.paymentIntents.create({
      customer: user.stripe_customer_id,
      amount: price.unit_amount,
      currency: price.currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        platform_user_id: caller.id,
        price_id,
        ...metadata,
      },
    });

    return jsonResponse({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
  } catch (error) {
    console.error('[CREATE-PAYMENT-INTENT-SUBSCRIPTION] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: message }, 500);
  }
});
