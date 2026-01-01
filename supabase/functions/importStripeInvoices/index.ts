import { createClient } from 'jsr:@supabase/supabase-js@2'

import Stripe from 'npm:stripe@14.11.0';
import { corsHeaders } from '../_helpers.ts';
import { ImportStripeInvoicesRequestSchema, z } from '../_shared/schemas.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2023-10-16' });

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const token = extractBearerFromReq(req);
    const admin = await authMeWithToken(token);

    if (!admin || admin.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin only' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body with Zod
    let body;
    try {
      const bodyText = await req.text();
      const parsed = JSON.parse(bodyText);
      body = ImportStripeInvoicesRequestSchema.parse(parsed);
    } catch (parseError) {
      console.error('[importStripeInvoices] Validation error:', parseError);
      const error = parseError instanceof z.ZodError
        ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        : `Invalid request: ${parseError.message}`;
      return new Response(
        JSON.stringify({ error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id } = body;

    // Get user and their stripe customer ID
    const { data: user, error: userError } = await supabase.from('users').select('*').eq('id', user_id).single();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'No Stripe customer ID found for this user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's subscriptions via stripe customer ID link
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('user_subscriptions')
      .select()
      .eq('customer', user.stripe_customer_id);

    if (subscriptionsError || !subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active subscription found for user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripeInvoices = await stripe.invoices.list({ customer: user.stripe_customer_id, limit: 100 });

    let imported = 0;
    let skipped = 0;

    for (const stripeInvoice of stripeInvoices.data) {
      // Check if invoice already exists
      const { data: existingInvoices, error: existingInvoicesError } = await supabase
        .from('invoices')
        .select()
        .eq('id', stripeInvoice.id);

      if (existingInvoices && existingInvoices.length > 0) { 
        skipped++; 
        continue; 
      }
      
      if (stripeInvoice.status !== 'paid' && stripeInvoice.status !== 'open') { 
        skipped++; 
        continue; 
      }

      const subtotal = stripeInvoice.subtotal || 0;
      const vatAmount = stripeInvoice.tax || 0;
      const totalAmount = stripeInvoice.amount_paid || stripeInvoice.total || 0;

      // Insert invoice using Stripe table structure
      await supabase.from('invoices').insert({
        id: stripeInvoice.id,
        customer: user.stripe_customer_id,
        subscription: stripeInvoice.subscription || null,
        status: stripeInvoice.status,
        total: totalAmount,
        currency: stripeInvoice.currency?.toUpperCase() || 'EUR',
        period_start: stripeInvoice.period_start ? new Date(stripeInvoice.period_start * 1000).toISOString() : null,
        period_end: stripeInvoice.period_end ? new Date(stripeInvoice.period_end * 1000).toISOString() : null,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        attrs: stripeInvoice
      });

      imported++;
    }

    return new Response(
      JSON.stringify({ success: true, imported, skipped, total: stripeInvoices.data.length, message: `${imported} invoices imported, ${skipped} skipped` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Import invoices error:', error);
    return new Response(
        JSON.stringify({ error: error.message || 'Failed to import invoices' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
});