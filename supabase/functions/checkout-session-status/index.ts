import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { jsonResponse, corsHeaders } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // Get session_id from query parameters
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id');

    if (!sessionId) {
      return jsonResponse({ error: 'session_id is required' }, 400);
    }

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Optionally expand the customer object to get more details
    if (!session) {
      return jsonResponse({ error: 'Session not found' }, 404);
    }

    return jsonResponse({
      status: session.status,
      customer_email: session.customer_details?.email || session.customer_email || null,
      payment_intent: session.payment_intent,
      payment_status: session.payment_status,
      subscription: session.subscription,
      mode: session.mode,
      total_details: session.total_details,
      amount_total: session.amount_total,
      amount_subtotal: session.amount_subtotal,
    });
  } catch (error) {
    console.error('[CHECKOUT-SESSION-STATUS] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: message }, 500);
  }
});
