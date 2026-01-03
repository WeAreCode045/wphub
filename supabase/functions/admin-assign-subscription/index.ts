import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[ASSIGN] Starting admin-assign-subscription');
    console.log('[ASSIGN] Request method:', req.method);
    
    // Authenticate user
    const token = extractBearerFromReq(req);
    console.log('[ASSIGN] Token extracted:', token ? 'Yes' : 'No');
    
    const caller = await authMeWithToken(token);
    console.log('[ASSIGN] User authenticated:', caller ? caller.id : 'No');
    
    if (!caller) {
      console.error('[ASSIGN] No caller authenticated');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    console.log('[ASSIGN] Verifying admin role for user:', caller.id);
    
    // Verify admin role
    const supa = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('[ASSIGN] Service key available:', serviceKey ? 'Yes' : 'No');
    
    const adminRes = await fetch(
      `${supa}/rest/v1/users?id=eq.${encodeURIComponent(caller.id)}`,
      {
        headers: {
          apikey: serviceKey!,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    
    console.log('[ASSIGN] Admin check response status:', adminRes.status);
    
    if (!adminRes.ok) {
      console.error('[ASSIGN] Failed to verify admin');
      return jsonResponse({ error: 'Failed to verify admin' }, 500);
    }
    
    const adminArr = await adminRes.json();
    const admin = adminArr?.[0];
    
    console.log('[ASSIGN] Admin found:', admin ? 'Yes' : 'No');
    console.log('[ASSIGN] Admin role:', admin?.role);
    
    if (!admin || admin.role !== 'admin') {
      console.error('[ASSIGN] User is not admin. Role:', admin?.role);
      return jsonResponse({ error: 'Admin access required' }, 403);
    }

    console.log('[ASSIGN] Admin verified. Parsing request body...');
    
    // Get request body
    const { user_id, plan_id } = await req.json();
    
    console.log('[ASSIGN] Request body - user_id:', user_id, 'plan_id:', plan_id);
    
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

    // Check if customer has a default payment method
    const customer = await stripe.customers.retrieve(customerId);
    let defaultPaymentMethod = customer.invoice_settings?.default_payment_method as string | null;
    
    console.log('[ASSIGN] Customer default payment method:', defaultPaymentMethod || 'None');
    
    // If no payment method, try to use first available payment method on customer
    if (!defaultPaymentMethod) {
      console.log('[ASSIGN] No default payment method, checking for available payment methods...');
      
      const paymentMethods = await stripe.customers.listPaymentMethods(customerId, {
        limit: 1,
      });
      
      if (paymentMethods.data.length > 0) {
        defaultPaymentMethod = paymentMethods.data[0].id;
        console.log('[ASSIGN] Found payment method:', defaultPaymentMethod);
        
        // Set as default for the customer
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: defaultPaymentMethod,
          },
        });
        console.log('[ASSIGN] Set as default payment method');
      } else {
        console.log('[ASSIGN] No payment methods available for customer');
        
        // Check for platform default setting
        const { data: settingsData } = await supabaseClient
          .from('site_settings')
          .select('setting_value')
          .eq('setting_key', 'stripe_default_payment_method')
          .single();
        
        if (settingsData?.setting_value) {
          defaultPaymentMethod = settingsData.setting_value;
          console.log('[ASSIGN] Using platform default payment method:', defaultPaymentMethod);
          
          // Attach the default payment method to the customer
          try {
            await stripe.paymentMethods.attach(defaultPaymentMethod, {
              customer: customerId,
            });
            
            // Set as default for the customer
            await stripe.customers.update(customerId, {
              invoice_settings: {
                default_payment_method: defaultPaymentMethod,
              },
            });
            console.log('[ASSIGN] Attached platform default payment method');
          } catch (e) {
            console.error('[ASSIGN] Failed to attach default payment method:', e);
            return jsonResponse({ error: 'Gebruiker heeft geen betalingsmethode ingesteld. Voeg eerst een betalingsmethode toe.' }, 400);
          }
        } else {
          console.error('[ASSIGN] No payment methods available and no platform default set');
          return jsonResponse({ error: 'Gebruiker heeft geen betalingsmethode ingesteld. Voeg eerst een betalingsmethode toe.' }, 400);
        }
      }
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
