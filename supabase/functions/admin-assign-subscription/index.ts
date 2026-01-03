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
    const { user_id, plan_id } = await req.json();
    
    if (!user_id || !plan_id) {
      return jsonResponse({ error: 'user_id and plan_id are required' }, 400);
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey!
    );

    // Get the plan details
    const { data: plan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      return jsonResponse({ error: 'Plan not found' }, 404);
    }

    // Get the target user
    const { data: targetUser, error: userError } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', user_id)
      .single();

    if (userError || !targetUser) {
      return jsonResponse({ error: 'User not found' }, 404);
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return jsonResponse({ error: 'Stripe secret key not configured' }, 500);
    }
    
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    // Get or create Stripe customer
    let customerId = targetUser.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: targetUser.email,
        name: targetUser.full_name,
        metadata: {
          platform_user_id: user_id,
        },
      });
      customerId = customer.id;
      
      // Update user with stripe_customer_id
      await supabaseClient
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user_id);
    }

    // Check for existing active subscription
    const { data: existingSub } = await supabaseClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .single();

    let subscription;
    
    if (existingSub) {
      // Cancel existing subscription in Stripe
      if (existingSub.subscription_id) {
        try {
          await stripe.subscriptions.cancel(existingSub.subscription_id);
        } catch (e) {
          console.error('Failed to cancel existing subscription:', e);
        }
      }
      
      // Delete existing subscription record
      await supabaseClient
        .from('user_subscriptions')
        .delete()
        .eq('id', existingSub.id);
    }

    // Create new Stripe subscription with monthly price
    const priceId = plan.stripe_price_monthly_id;
    
    subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: plan.trial_days || 0,
      metadata: {
        platform_user_id: user_id,
        plan_id: plan_id,
        assigned_by_admin: caller.id,
      },
    });

    // Calculate period dates
    const periodStartDate = new Date(subscription.current_period_start * 1000).toISOString();
    const periodEndDate = new Date(subscription.current_period_end * 1000).toISOString();
    
    // Insert subscription record
    const { error: insertError } = await supabaseClient
      .from('user_subscriptions')
      .insert({
        user_id: user_id,
        plan_id: plan_id,
        subscription_id: subscription.id,
        status: subscription.status,
        period_start_date: periodStartDate,
        period_end_date: periodEndDate,
        is_active: subscription.status === 'active' || subscription.status === 'trialing',
        plan_name: plan.name,
      });

    if (insertError) {
      console.error('Failed to insert subscription:', insertError);
      return jsonResponse({ error: 'Failed to create subscription record', details: insertError }, 500);
    }

    return jsonResponse({ 
      success: true,
      message: 'Subscription assigned successfully',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan_name: plan.name,
      }
    }, 200);

  } catch (error) {
    console.error('Error in admin-assign-subscription:', error);
    return jsonResponse(
      { error: error.message || 'Internal server error' },
      500
    );
  }
});
