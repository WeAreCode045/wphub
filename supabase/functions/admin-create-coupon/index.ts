import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

interface CreateCouponRequest {
  code: string;
  type: 'fixed_amount' | 'percentage';
  amount: number;
  currency?: string;
  max_redemptions?: number;
  valid_until?: string;
  applies_to_plans?: string[];
  minimum_amount?: number;
  applies_once?: boolean;
  applies_to_new_customers_only?: boolean;
  description?: string;
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user is admin
    const { data: user } = await supabase
      .from('public.users')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (user?.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required' }, 403);
    }

    const body = (await req.json()) as CreateCouponRequest;
    const {
      code,
      type,
      amount,
      currency = 'eur',
      max_redemptions,
      valid_until,
      applies_to_plans,
      minimum_amount,
      applies_once = false,
      applies_to_new_customers_only = false,
      description,
    } = body;

    // Validate input
    if (!code || !type || !amount) {
      return jsonResponse(
        { error: 'code, type, and amount are required' },
        400
      );
    }

    if (!['fixed_amount', 'percentage'].includes(type)) {
      return jsonResponse(
        { error: 'type must be "fixed_amount" or "percentage"' },
        400
      );
    }

    if (amount <= 0) {
      return jsonResponse({ error: 'amount must be positive' }, 400);
    }

    if (type === 'percentage' && amount > 100) {
      return jsonResponse({ error: 'percentage cannot exceed 100' }, 400);
    }

    // Check if coupon code already exists
    const { data: existingCoupon } = await supabase
      .from('public.coupons')
      .select('id')
      .eq('code', code)
      .single();

    if (existingCoupon) {
      return jsonResponse(
        { error: 'Coupon code already exists' },
        409
      );
    }

    // Create Stripe coupon first
    let stripeCoupon;
    try {
      stripeCoupon = await stripe.coupons.create({
        duration: valid_until ? 'repeating' : 'forever',
        duration_in_months: valid_until ? 1 : undefined,
        id: code,
        percent_off: type === 'percentage' ? amount : undefined,
        amount_off: type === 'fixed_amount' ? amount * 100 : undefined, // Stripe expects cents
        currency: type === 'fixed_amount' ? currency : undefined,
        max_redemptions: max_redemptions,
      });
    } catch (stripeError) {
      console.error('[ADMIN-CREATE-COUPON] Stripe error:', stripeError);
      // Continue even if Stripe fails, we can still create in local DB
    }

    // Create coupon in database
    const { data: coupon, error } = await supabase
      .from('public.coupons')
      .insert({
        code,
        stripe_coupon_id: stripeCoupon?.id,
        type,
        amount,
        currency: type === 'fixed_amount' ? currency : null,
        valid_from: new Date().toISOString(),
        valid_until: valid_until ? new Date(valid_until).toISOString() : null,
        max_redemptions,
        applies_to_plans,
        minimum_amount,
        applies_once,
        applies_to_new_customers_only,
        description,
        created_by: caller.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[ADMIN-CREATE-COUPON] Database error:', error);
      return jsonResponse(
        { error: error.message || 'Failed to create coupon' },
        500
      );
    }

    return jsonResponse({
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        amount: coupon.amount,
        stripe_coupon_id: coupon.stripe_coupon_id,
        created_at: coupon.created_at,
      },
    });
  } catch (error) {
    console.error('[ADMIN-CREATE-COUPON] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: message }, 500);
  }
});
