import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

interface CreateCheckoutSessionRequest {
  price_id: string;
  quantity?: number;
  metadata?: Record<string, string>;
  success_url?: string;
  cancel_url?: string;
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

    const body = (await req.json()) as CreateCheckoutSessionRequest;
    const {
      price_id,
      quantity = 1,
      metadata = {},
      success_url,
      cancel_url,
    } = body;

    if (!price_id) {
      return jsonResponse({ error: 'price_id is required' }, 400);
    }

    // Get user's Stripe customer ID from public.users
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
        { error: 'User does not have a Stripe customer. Call create-stripe-customer first.' },
        400
      );
    }

    // Determine return URLs
    const baseUrl = Deno.env.get('VITE_APP_URL') || 'http://localhost:5173';
    const returnUrl = success_url || `${baseUrl}/checkout/return`;
    const cancelUrl = cancel_url || `${baseUrl}/checkout`;

    // Create checkout session in embedded mode
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      line_items: [
        {
          price: price_id,
          quantity,
        },
      ],
      mode: 'subscription', // or 'payment' or 'setup' depending on use case
      customer: user.stripe_customer_id,
      customer_email: user.email,
      return_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        platform_user_id: caller.id,
        created_at: new Date().toISOString(),
        ...metadata,
      },
    });

    return jsonResponse({
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('[CREATE-CHECKOUT-SESSION] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: message }, 500);
  }
});
