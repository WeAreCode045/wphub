import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse } from '../_helpers.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
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
    const { plan_id } = await req.json();
    
    if (!plan_id) {
      return jsonResponse({ error: 'plan_id is required' }, 400);
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey!
    );

    // Get the plan details from database
    const { data: plan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('stripe_product_id')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      return jsonResponse({ error: 'Plan not found' }, 404);
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return jsonResponse({ error: 'Stripe secret key not configured' }, 500);
    }
    
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    // Archive the product in Stripe if it exists
    if (plan.stripe_product_id) {
      try {
        await stripe.products.update(plan.stripe_product_id, {
          active: false,
        });
        console.log(`Archived Stripe product: ${plan.stripe_product_id}`);
      } catch (stripeError) {
        console.error('Failed to archive Stripe product:', stripeError);
        // Continue with deletion even if archiving fails
      }
    }

    // Delete the plan from database
    const { error: deleteError } = await supabaseClient
      .from('subscription_plans')
      .delete()
      .eq('id', plan_id);

    if (deleteError) {
      return jsonResponse({ error: 'Failed to delete plan from database', details: deleteError }, 500);
    }

    return jsonResponse({ 
      success: true,
      message: 'Plan deleted and Stripe product archived successfully'
    }, 200);

  } catch (error) {
    console.error('Error in admin-delete-plan:', error);
    return jsonResponse(
      { error: error.message || 'Internal server error' },
      500
    );
  }
});
