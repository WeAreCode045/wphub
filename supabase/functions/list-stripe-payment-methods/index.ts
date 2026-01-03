import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
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

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return jsonResponse({ error: 'Stripe secret key not configured' }, 500);
    }
    
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    // Fetch all payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      limit: 100,
      type: 'card',
    });

    // Format the response to be more readable for admins
    const formattedMethods = paymentMethods.data.map((method: any) => ({
      id: method.id,
      type: method.type,
      card: method.card ? {
        brand: method.card.brand,
        last4: method.card.last4,
        exp_month: method.card.exp_month,
        exp_year: method.card.exp_year,
      } : null,
      billing_details: method.billing_details,
      created: method.created,
      customer: method.customer,
    }));

    return jsonResponse({
      payment_methods: formattedMethods,
      total: formattedMethods.length,
    }, 200);

  } catch (error) {
    console.error('Error listing payment methods:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
