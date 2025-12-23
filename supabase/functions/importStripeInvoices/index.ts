import { createClientFromRequest } from '../base44Shim.js';
import Stripe from 'npm:stripe@14.11.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2023-10-16' });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();

    if (!admin || admin.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const { user_id } = await req.json();

    if (!user_id) {
      return Response.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const subscriptions = await base44.asServiceRole.entities.UserSubscription.filter({ user_id: user_id });

    if (subscriptions.length === 0) {
      return Response.json({ error: 'No subscription found for user' }, { status: 404 });
    }

    const subscription = subscriptions[0];

    if (!subscription.stripe_customer_id) {
      return Response.json({ error: 'No Stripe customer ID found' }, { status: 400 });
    }

    const user = await base44.asServiceRole.entities.User.get(user_id);
    const plan = await base44.asServiceRole.entities.SubscriptionPlan.get(subscription.plan_id);

    const stripeInvoices = await stripe.invoices.list({ customer: subscription.stripe_customer_id, limit: 100 });

    let imported = 0;
    let skipped = 0;

    for (const stripeInvoice of stripeInvoices.data) {
      const existingInvoices = await base44.asServiceRole.entities.Invoice.filter({ stripe_invoice_id: stripeInvoice.id });

      if (existingInvoices.length > 0) { skipped++; continue; }
      if (stripeInvoice.status !== 'paid' && stripeInvoice.status !== 'open') { skipped++; continue; }

      const allInvoices = await base44.asServiceRole.entities.Invoice.list();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(allInvoices.length + imported + 1).padStart(6, '0')}`;

      const subtotal = stripeInvoice.subtotal;
      const vatPercentage = subscription.vat_percentage || plan.vat_rate_percentage || 21;
      const vatAmount = stripeInvoice.tax || Math.round(subtotal * (vatPercentage / 100));
      const totalAmount = stripeInvoice.amount_paid || stripeInvoice.total;

      const billingPeriod = stripeInvoice.lines.data[0]?.price?.recurring?.interval || subscription.interval;

      await base44.asServiceRole.entities.Invoice.create({
        invoice_number: invoiceNumber,
        user_id: user_id,
        user_email: user.email,
        user_name: user.full_name,
        subscription_id: subscription.id,
        stripe_invoice_id: stripeInvoice.id,
        stripe_payment_intent_id: stripeInvoice.payment_intent,
        amount: totalAmount,
        subtotal: subtotal,
        vat_amount: vatAmount,
        vat_percentage: vatPercentage,
        currency: stripeInvoice.currency.toUpperCase(),
        plan_name: plan.name,
        billing_period: billingPeriod,
        period_start: stripeInvoice.period_start ? new Date(stripeInvoice.period_start * 1000).toISOString() : null,
        period_end: stripeInvoice.period_end ? new Date(stripeInvoice.period_end * 1000).toISOString() : null,
        status: stripeInvoice.status,
        paid_at: stripeInvoice.status_transitions?.paid_at ? new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString() : null,
        due_date: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000).toISOString() : null,
        description: stripeInvoice.description || `${plan.name} - ${billingPeriod === 'month' ? 'Maandelijks' : 'Jaarlijks'} Abonnement`,
        billing_address: stripeInvoice.customer_address || {}
      });

      imported++;
    }

    await base44.asServiceRole.entities.ActivityLog.create({
      user_email: admin.email,
      action: `Geïmporteerde Stripe facturen voor gebruiker`,
      entity_type: 'subscription',
      details: `User: ${user.email}, Imported: ${imported}, Skipped: ${skipped}`
    });

    return Response.json({ success: true, imported, skipped, total: stripeInvoices.data.length, message: `${imported} facturen geïmporteerd, ${skipped} overgeslagen` });

  } catch (error) {
    console.error('Import invoices error:', error);
    return Response.json({ error: error.message || 'Failed to import invoices' }, { status: 500 });
  }
});