import { createClient } from 'jsr:@supabase/supabase-js@2'

import Stripe from 'npm:stripe@14.11.0';
import { corsHeaders } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2023-10-16',
});

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )
      
      const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { name, description } = await req.json();

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create product in Stripe
    const product = await stripe.products.create({
      name,
      description: description || '',
      metadata: {
        created_by: user.email,
        platform: 'wp-cloud-hub'
      }
    });

    await supabase.from('activitylogs').insert({
      user_email: user.email,
      action: `Stripe product aangemaakt: ${name}`,
      entity_type: 'subscription',
      details: `Product ID: ${product.id}`
    });

    return new Response(
        JSON.stringify({
      success: true,
      product_id: product.id,
      product
    }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

  } catch (error) {
    console.error('Error creating Stripe product:', error);
    return new Response(
        JSON.stringify({
      success: false,
      error: error.message
    }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
});