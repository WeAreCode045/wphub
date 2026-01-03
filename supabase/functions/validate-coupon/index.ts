import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

interface ValidateCouponRequest {
  code: string;
  subscription_id?: string;
  amount?: number;
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

    const body = (await req.json()) as ValidateCouponRequest;
    const { code, subscription_id, amount } = body;

    if (!code) {
      return jsonResponse({ error: 'code is required' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get coupon from database
    const { data: coupon, error } = await supabase
      .from('public.coupons')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !coupon) {
      return jsonResponse({ error: 'Coupon code not found or invalid' }, 404);
    }

    // Check if coupon is active
    if (!coupon.is_active) {
      return jsonResponse({ error: 'Coupon is no longer active' }, 410);
    }

    // Check if coupon has expired
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
      return jsonResponse({ error: 'Coupon has expired' }, 410);
    }

    // Check if coupon is valid yet
    if (coupon.valid_from && new Date(coupon.valid_from) > new Date()) {
      return jsonResponse({ error: 'Coupon is not yet valid' }, 410);
    }

    // Check redemption limit
    if (
      coupon.max_redemptions &&
      coupon.redemptions_used >= coupon.max_redemptions
    ) {
      return jsonResponse(
        { error: 'Coupon has reached maximum redemptions' },
        410
      );
    }

    // Check if coupon applies to specific plans
    if (subscription_id && coupon.applies_to_plans && coupon.applies_to_plans.length > 0) {
      // Get subscription plan
      const { data: subscription } = await supabase
        .from('stripe.subscriptions')
        .select('items')
        .eq('id', subscription_id)
        .single();

      if (!subscription) {
        return jsonResponse({ error: 'Subscription not found' }, 404);
      }

      // Check if plan is in applies_to_plans
      const subscriptionPlanId = subscription.items?.[0]?.price?.product;
      if (subscriptionPlanId && !coupon.applies_to_plans.includes(subscriptionPlanId)) {
        return jsonResponse(
          { error: 'Coupon does not apply to this plan' },
          422
        );
      }
    }

    // Check minimum amount requirement
    if (coupon.minimum_amount && amount && amount < coupon.minimum_amount) {
      return jsonResponse(
        {
          error: `Minimum purchase amount of ${coupon.minimum_amount / 100} ${coupon.currency} required`,
        },
        422
      );
    }

    // Check if user already used coupon (if applies_once)
    if (coupon.applies_once) {
      const { data: usage } = await supabase
        .from('public.coupon_usage')
        .select('id')
        .eq('coupon_id', coupon.id)
        .eq('user_id', caller.id)
        .single();

      if (usage) {
        return jsonResponse(
          { error: 'You have already used this coupon' },
          422
        );
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.type === 'fixed_amount') {
      discountAmount = coupon.amount;
    } else if (coupon.type === 'percentage') {
      if (amount) {
        discountAmount = Math.floor((amount * coupon.amount) / 100);
      }
    }

    return jsonResponse({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        amount: coupon.amount,
        currency: coupon.currency,
        description: coupon.description,
      },
      discount: {
        amount: discountAmount,
        type: coupon.type,
        percentage: coupon.type === 'percentage' ? coupon.amount : null,
      },
    });
  } catch (error) {
    console.error('[VALIDATE-COUPON] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: message }, 500);
  }
});
