import { createClient } from 'jsr:@supabase/supabase-js@2'

import Stripe from 'npm:stripe@14.11.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2023-10-16',
});

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )
      
      const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { product_id, amount, currency, interval } = await req.json();

    if (!product_id || !amount || !currency || !interval) {
      return Response.json({
        error: 'product_id, amount, currency, and interval are required'
      }, { status: 400 });
    }

    if (!['month', 'year'].includes(interval)) {
      return Response.json({
        error: 'interval must be "month" or "year"'
      }, { status: 400 });
    }

    // Create price in Stripe
    const price = await stripe.prices.create({
      product: product_id,
      unit_amount: amount, // amount in cents
      currency: currency.toLowerCase(),
      recurring: {
        interval: interval
      },
      metadata: {
        created_by: user.email,
        platform: 'wp-cloud-hub'
      }
    });

    await supabase.from('activitylogs').insert({
      user_email: user.email,
      action: `Stripe price aangemaakt voor product ${product_id}`,
      entity_type: 'subscription',
      details: `Price ID: ${price.id}, Amount: ${amount / 100} ${currency}, Interval: ${interval}`
    });

    return Response.json({
      success: true,
      price_id: price.id,
      price
    });

  } catch (error) {
    console.error('Error creating Stripe price:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});