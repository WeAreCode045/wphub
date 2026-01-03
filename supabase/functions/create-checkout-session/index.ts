import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

interface CreateCheckoutSessionRequest {
  price_id: string;
  quantity?: number;
  coupon_code?: string;
  billing_details?: {
    address?: {
      line1?: string;
      city?: string;
      postal_code?: string;
      country?: string;
    };
    tax_id?: {
      type: string;
      value: string;
    };
  };
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
      coupon_code,
      billing_details,
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

    // Get payment configuration from settings
    const { data: paymentConfigSetting } = await supabase
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', 'stripe_payment_configuration')
      .single();

    const paymentConfiguration = paymentConfigSetting?.setting_value || null;

    // Determine return URLs
    const baseUrl = Deno.env.get('VITE_APP_URL') || 'http://localhost:5173';
    const returnUrl = success_url || `${baseUrl}/checkout/return`;
    const cancelUrl = cancel_url || `${baseUrl}/checkout`;

    // Prepare session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      ui_mode: 'embedded',
      line_items: [
        {
          price: price_id,
          quantity,
        },
      ],
      mode: 'subscription',
      customer: user.stripe_customer_id,
      customer_email: user.email,
      return_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      billing_address_collection: 'auto',
      tax_id_collection: {
        enabled: true,
      },
      metadata: {
        platform_user_id: caller.id,
        created_at: new Date().toISOString(),
        ...metadata,
      },
    };

    // Add payment configuration if set
    if (paymentConfiguration) {
      sessionParams.payment_method_configuration = paymentConfiguration;
    }

    // Add coupon if provided
    if (coupon_code) {
      sessionParams.discounts = [{ coupon: coupon_code }];
    }

    // Add custom fields for VAT number if provided
    if (billing_details?.tax_id?.value) {
      sessionParams.invoice_creation = {
        enabled: true,
        invoice_data: {
          custom_fields: [
            {
              name: 'VAT Number',
              value: billing_details.tax_id.value,
            },
          ],
        },
      };
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

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
