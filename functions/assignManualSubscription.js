import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();

    if (!admin || admin.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      user_id, 
      plan_id, 
      custom_amount,
      interval,
      end_date
    } = await req.json();

    if (!user_id || !plan_id) {
      return Response.json({ 
        error: 'user_id en plan_id zijn verplicht' 
      }, { status: 400 });
    }

    // Get plan details
    const plan = await base44.asServiceRole.entities.SubscriptionPlan.get(plan_id);
    if (!plan) {
      return Response.json({ error: 'Plan niet gevonden' }, { status: 404 });
    }

    // Get user details
    const users = await base44.asServiceRole.entities.User.filter({ id: user_id });
    if (users.length === 0) {
      return Response.json({ error: 'Gebruiker niet gevonden' }, { status: 404 });
    }
    const user = users[0];

    // Check if user already has an active subscription
    const existingSubscriptions = await base44.asServiceRole.entities.UserSubscription.filter({
      user_id: user_id,
      status: ['active', 'trialing']
    });

    // Cancel existing subscriptions
    for (const sub of existingSubscriptions) {
      await base44.asServiceRole.entities.UserSubscription.update(sub.id, {
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        cancel_at_period_end: false
      });
    }

    // Create manual subscription
    const now = new Date();
    const currentPeriodEnd = end_date ? new Date(end_date) : null;

    const newSubscription = await base44.asServiceRole.entities.UserSubscription.create({
      user_id: user_id,
      plan_id: plan_id,
      is_manual: true,
      assigned_by: admin.email,
      manual_end_date: end_date || null,
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
      interval: interval || 'lifetime',
      amount: custom_amount || 0,
      currency: plan.currency || 'EUR',
      usage_tracking: {
        plugins_used: 0,
        sites_used: 0,
        teams_used: 0,
        projects_used: 0
      }
    });

    // Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      user_email: admin.email,
      action: `Handmatig abonnement toegewezen aan ${user.email}`,
      entity_type: 'subscription',
      details: `Plan: ${plan.name}, Bedrag: €${(custom_amount || 0) / 100}, Interval: ${interval || 'lifetime'}, Einddatum: ${end_date || 'onbeperkt'}`
    });

    return Response.json({
      success: true,
      subscription: newSubscription
    });

  } catch (error) {
    console.error('Error assigning manual subscription:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});