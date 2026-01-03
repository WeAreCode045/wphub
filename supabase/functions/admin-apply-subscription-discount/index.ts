import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const token = extractBearerFromReq(req);
    const caller = await authMeWithToken(token);
    
    if (!caller) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Verify admin role
    const supa = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const adminRes = await fetch(
      `${supa}/rest/v1/users?id=eq.${encodeURIComponent(caller.id)}`,
      {
        headers: {
          apikey: serviceKey!,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    
    if (!adminRes.ok) {
      return jsonResponse({ error: 'Failed to verify admin' }, 500);
    }
    
    const adminArr = await adminRes.json();
    const admin = adminArr?.[0];
    
    if (!admin || admin.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required' }, 403);
    }

    // Get request body
    const { user_id, discount_percent, duration_type, duration_months } = await req.json();
    
    if (!user_id || !discount_percent) {
      return jsonResponse({ error: 'user_id and discount_percent are required' }, 400);
    }

    if (discount_percent < 0 || discount_percent > 100) {
      return jsonResponse({ error: 'discount_percent must be between 0 and 100' }, 400);
    }

    // Validate duration
    const validDurations = ['once', 'repeating', 'forever'];
    if (!validDurations.includes(duration_type)) {
      return jsonResponse({ error: 'duration_type must be one of: once, repeating, forever' }, 400);
    }

    if (duration_type === 'repeating' && (!duration_months || duration_months < 1)) {
      return jsonResponse({ error: 'duration_months is required and must be >= 1 for repeating discounts' }, 400);
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey!
    );

    // Get user's active subscription
    const { data: subscription, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .single();

    if (subError || !subscription) {
      return jsonResponse({ error: 'No active subscription found for this user' }, 404);
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return jsonResponse({ error: 'Stripe secret key not configured' }, 500);
    }
    
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    // Create a coupon in Stripe
    const couponParams: any = {
      percent_off: discount_percent,
      duration: duration_type,
      name: `Admin discount for user ${user_id} - ${discount_percent}% off`,
      metadata: {
        applied_by_admin: caller.id,
        user_id: user_id,
      },
    };

    if (duration_type === 'repeating') {
      couponParams.duration_in_months = duration_months;
    }

    const coupon = await stripe.coupons.create(couponParams);

    // Apply the coupon to the subscription
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.subscription_id,
      {
        coupon: coupon.id,
        proration_behavior: 'none', // Don't prorate, apply from next billing cycle
      }
    );

    // Log the discount application
    console.log(`Discount applied: ${discount_percent}% off for ${duration_type}${duration_type === 'repeating' ? ` (${duration_months} months)` : ''}`);

    return jsonResponse({ 
      success: true,
      message: 'Discount applied successfully',
      coupon_id: coupon.id,
      discount: {
        percent_off: discount_percent,
        duration: duration_type,
        duration_in_months: duration_type === 'repeating' ? duration_months : null,
      }
    }, 200);

  } catch (error) {
    console.error('Error in admin-apply-subscription-discount:', error);
    return jsonResponse(
      { error: error.message || 'Internal server error' },
      500
    );
  }
});
