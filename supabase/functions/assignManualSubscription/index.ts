import { authMeWithToken, extractBearerFromReq, jsonResponse } from '../_helpers.ts';

Deno.serve(async (req: Request) => {
  try {
    const token = extractBearerFromReq(req);
    const admin = await authMeWithToken(token);
    if (!admin || admin.role !== 'admin') return jsonResponse({ error: 'Unauthorized' }, 401);

    const { user_id, plan_id, custom_amount, interval, end_date } = await req.json();
    if (!user_id || !plan_id) return jsonResponse({ error: 'user_id en plan_id zijn verplicht' }, 400);

    const supa = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY');

    // Get plan
    const planRes = await fetch(`${supa}/rest/v1/subscription_plans?id=eq.${encodeURIComponent(String(plan_id))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!planRes.ok) return jsonResponse({ error: 'Failed to load plan' }, 500);
    const planArr = await planRes.json();
    const plan = planArr?.[0];
    if (!plan) return jsonResponse({ error: 'Plan niet gevonden' }, 404);

    // Get user
    const userRes = await fetch(`${supa}/rest/v1/users?id=eq.${encodeURIComponent(String(user_id))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!userRes.ok) return jsonResponse({ error: 'Failed to load user' }, 500);
    const userArr = await userRes.json();
    const user = userArr?.[0];
    if (!user) return jsonResponse({ error: 'Gebruiker niet gevonden' }, 404);

    // Cancel existing subscriptions
    const subsRes = await fetch(`${supa}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(String(user_id))}&or=(status.eq.active,status.eq.trialing)`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const existingSubscriptions = (subsRes.ok ? await subsRes.json() : []);
    for (const sub of existingSubscriptions) {
      await fetch(`${supa}/rest/v1/user_subscriptions?id=eq.${encodeURIComponent(String(sub.id))}`, { method: 'PATCH', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ status: 'canceled', canceled_at: new Date().toISOString(), cancel_at_period_end: false }) });
    }

    // Create manual subscription
    const now = new Date();
    const currentPeriodEnd = end_date ? new Date(end_date) : null;
    const newSubPayload = {
      user_id,
      plan_id,
      is_manual: true,
      assigned_by: admin.email,
      manual_end_date: end_date || null,
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
      interval: interval || 'lifetime',
      amount: custom_amount || 0,
      currency: plan.currency || 'EUR',
      usage_tracking: { plugins_used: 0, sites_used: 0, teams_used: 0, projects_used: 0 }
    };

    const createRes = await fetch(`${supa}/rest/v1/user_subscriptions`, { method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(newSubPayload) });
    if (!createRes.ok) {
      const txt = await createRes.text().catch(()=>'');
      return jsonResponse({ success: false, error: `Failed to create subscription: ${txt}` }, 500);
    }
    const created = await createRes.json();

    // Log activity
    await fetch(`${supa}/rest/v1/activity_logs`, { method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_email: admin.email, action: `Handmatig abonnement toegewezen aan ${user.email}`, entity_type: 'subscription', details: `Plan: ${plan.name}, Bedrag: €${(custom_amount || 0) / 100}, Interval: ${interval || 'lifetime'}, Einddatum: ${end_date || 'onbeperkt'}` }) });

    return jsonResponse({ success: true, subscription: created });
  } catch (err:any) {
    console.error('assignManualSubscription error', err);
    return jsonResponse({ success: false, error: err.message || String(err) }, 500);
  }
});

export {};
