import { createClientFromRequest } from '../base44Shim.js';
import Stripe from 'npm:stripe@14.11.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2023-10-16',
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description } = await req.json();

    if (!name) {
      return Response.json({ error: 'Name is required' }, { status: 400 });
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

    await base44.asServiceRole.entities.ActivityLog.create({
      user_email: user.email,
      action: `Stripe product aangemaakt: ${name}`,
      entity_type: 'subscription',
      details: `Product ID: ${product.id}`
    });

    return Response.json({
      success: true,
      product_id: product.id,
      product
    });

  } catch (error) {
    console.error('Error creating Stripe product:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});