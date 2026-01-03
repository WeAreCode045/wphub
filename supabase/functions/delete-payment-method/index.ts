import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

interface DeletePaymentMethodRequest {
  payment_method_id: string;
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

    const body = (await req.json()) as DeletePaymentMethodRequest;
    const { payment_method_id } = body;

    if (!payment_method_id) {
      return jsonResponse({ error: 'payment_method_id is required' }, 400);
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's Stripe customer ID
    const { data: user } = await supabase
      .from('public.users')
      .select('stripe_customer_id')
      .eq('id', caller.id)
      .single();

    if (!user?.stripe_customer_id) {
      return jsonResponse(
        { error: 'User does not have a Stripe customer account' },
        400
      );
    }

    // Verify payment method belongs to this customer
    const paymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);

    if (paymentMethod.customer !== user.stripe_customer_id) {
      return jsonResponse(
        { error: 'Payment method does not belong to this customer' },
        403
      );
    }

    // Check if this is the default payment method for any active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active',
    });

    const isDefault = subscriptions.data.some(
      (sub) => sub.default_payment_method === payment_method_id
    );

    if (isDefault) {
      return jsonResponse(
        {
          error:
            'Cannot delete default payment method. Please set another payment method as default first.',
        },
        400
      );
    }

    // Detach payment method from customer
    const detached = await stripe.paymentMethods.detach(payment_method_id);

    return jsonResponse({
      success: true,
      payment_method_id: detached.id,
      message: 'Payment method deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE-PAYMENT-METHOD] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: message }, 500);
  }
});
