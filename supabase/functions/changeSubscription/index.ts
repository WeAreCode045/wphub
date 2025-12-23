import Stripe from 'npm:stripe';
import { authMeWithToken, extractBearerFromReq, jsonResponse } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '');

Deno.serve(async (req: Request) => {
  try {
    const token = extractBearerFromReq(req);
    const user = await authMeWithToken(token);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const { new_plan_id, action } = body;
    if (!new_plan_id || !action) return jsonResponse({ error: 'Missing required parameters: new_plan_id and action' }, 400);

    const supa = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY');

    // Get current active subscription
    const subsRes = await fetch(`${supa}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(String(user.id))}&or=(status.eq.active,status.eq.trialing)`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const subscriptions = subsRes.ok ? await subsRes.json() : [];
    if (!subscriptions || subscriptions.length === 0) return jsonResponse({ error: 'No active subscription found' }, 404);

    const currentSubscription = subscriptions[0];
    if (currentSubscription.is_manual) return jsonResponse({ error: 'Manual subscriptions must be changed by an administrator' }, 400);
    if (!currentSubscription.stripe_subscription_id) return jsonResponse({ error: 'No Stripe subscription found' }, 404);

    // Get the new plan details
    const newPlanRes = await fetch(`${supa}/rest/v1/subscription_plans?id=eq.${encodeURIComponent(String(new_plan_id))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const newPlans = newPlanRes.ok ? await newPlanRes.json() : [];
    const newPlan = newPlans[0];
    if (!newPlan || !newPlan.is_active) return jsonResponse({ error: 'Invalid or inactive plan' }, 400);

    // Get current plan details
    const currentPlanRes = await fetch(`${supa}/rest/v1/subscription_plans?id=eq.${encodeURIComponent(String(currentSubscription.plan_id))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const currentPlans = currentPlanRes.ok ? await currentPlanRes.json() : [];
    const currentPlan = currentPlans[0] || { name: 'Unknown' };

    const billingInterval = currentSubscription.interval;
    const newStripePriceId = billingInterval === 'year' ? newPlan.stripe_price_id_annual : newPlan.stripe_price_id_monthly;
    if (!newStripePriceId) return jsonResponse({ error: `No ${billingInterval}ly price configured for this plan` }, 400);

    // Retrieve Stripe subscription and items
    const stripeSubscription = await stripe.subscriptions.retrieve(currentSubscription.stripe_subscription_id);
    if (!stripeSubscription || stripeSubscription.items.data.length === 0) return jsonResponse({ error: 'Invalid Stripe subscription' }, 404);

    const subscriptionItemId = stripeSubscription.items.data[0].id;
    const currentStripePriceId = stripeSubscription.items.data[0].price.id;

    const currentPrice = await stripe.prices.retrieve(currentStripePriceId);
    const newPrice = await stripe.prices.retrieve(newStripePriceId);
    const isChangingInterval = currentPrice.recurring?.interval !== newPrice.recurring?.interval;

    if (action === 'downgrade') {
      const usageCheck = await checkDowngradeEligibility(supa, serviceKey, user.id, newPlan);
      if (!usageCheck.allowed) return jsonResponse({ success: false, error: 'Downgrade not allowed', details: usageCheck.violations }, 400);

      let updatedSubscription;
      if (isChangingInterval) {
        await stripe.subscriptions.update(currentSubscription.stripe_subscription_id, { cancel_at_period_end: true });
        updatedSubscription = await stripe.subscriptions.create({ customer: currentSubscription.stripe_customer_id, items: [{ price: newStripePriceId }], billing_cycle_anchor: stripeSubscription.current_period_end, proration_behavior: 'none', backdate_start_date: stripeSubscription.current_period_end });
      } else {
        updatedSubscription = await stripe.subscriptions.update(currentSubscription.stripe_subscription_id, { items: [{ id: subscriptionItemId, price: newStripePriceId }], proration_behavior: 'none', billing_cycle_anchor: 'unchanged' });
      }

      // Update DB: schedule pending plan change
      await fetch(`${supa}/rest/v1/user_subscriptions?id=eq.${encodeURIComponent(String(currentSubscription.id))}`, { method: 'PATCH', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ pending_plan_change: new_plan_id }) });

      return jsonResponse({ success: true, message: 'Downgrade scheduled for end of billing period', effective_date: new Date((stripeSubscription.current_period_end || 0) * 1000).toISOString(), current_plan: currentPlan.name, new_plan: newPlan.name });

    } else if (action === 'upgrade') {
      let updatedSubscription;
      if (isChangingInterval) {
        await stripe.subscriptions.cancel(currentSubscription.stripe_subscription_id);
        updatedSubscription = await stripe.subscriptions.create({ customer: currentSubscription.stripe_customer_id, items: [{ price: newStripePriceId }], proration_behavior: 'always_invoice' });
      } else {
        updatedSubscription = await stripe.subscriptions.update(currentSubscription.stripe_subscription_id, { items: [{ id: subscriptionItemId, price: newStripePriceId }], proration_behavior: 'always_invoice', billing_cycle_anchor: 'unchanged' });
      }

      const newAmount = billingInterval === 'year' ? newPlan.annual_price_amount : newPlan.monthly_price_amount;

      // Update DB immediately
      await fetch(`${supa}/rest/v1/user_subscriptions?id=eq.${encodeURIComponent(String(currentSubscription.id))}`, { method: 'PATCH', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ plan_id: new_plan_id, amount: newAmount, currency: newPlan.currency, vat_percentage: newPlan.vat_rate_percentage, stripe_subscription_id: updatedSubscription.id }) });

      // Activity log
      await fetch(`${supa}/rest/v1/activity_logs`, { method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_email: user.email, action: `Abonnement geüpgraded van ${currentPlan.name} naar ${newPlan.name}`, entity_type: 'user', entity_id: user.id }) });

      return jsonResponse({ success: true, message: 'Upgrade successful', prorated_amount: updatedSubscription.latest_invoice?.amount_due || 0, current_plan: newPlan.name, invoice_url: updatedSubscription.latest_invoice?.hosted_invoice_url });

    } else {
      return jsonResponse({ error: 'Invalid action. Must be "upgrade" or "downgrade"' }, 400);
    }

  } catch (err:any) {
    console.error('changeSubscription error', err);
    return jsonResponse({ error: err.message || String(err) }, 500);
  }
});

async function checkDowngradeEligibility(supa: string, serviceKey: string | undefined, userId: any, newPlan: any) {
  const violations: any[] = [];

  // Plugins
  if (newPlan.features?.plugins?.enabled) {
    const res = await fetch(`${supa}/rest/v1/plugins?owner_type=eq.user&owner_id=eq.${encodeURIComponent(String(userId))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const plugins = res.ok ? await res.json() : [];
    const limit = newPlan.features.plugins.limit;
    if (limit !== -1 && plugins.length > limit) {
      violations.push({ feature: 'plugins', current: plugins.length, limit, message: `Je hebt ${plugins.length} plugins, maar het nieuwe plan staat maximaal ${limit} toe` });
    }
  } else if (newPlan.features?.plugins && !newPlan.features.plugins.enabled) {
    const res = await fetch(`${supa}/rest/v1/plugins?owner_type=eq.user&owner_id=eq.${encodeURIComponent(String(userId))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const plugins = res.ok ? await res.json() : [];
    if (plugins.length > 0) violations.push({ feature: 'plugins', current: plugins.length, limit: 0, message: 'Het nieuwe plan ondersteunt geen plugins. Verwijder eerst al je plugins.' });
  }

  // Sites
  if (newPlan.features?.sites?.enabled) {
    const res = await fetch(`${supa}/rest/v1/sites?owner_type=eq.user&owner_id=eq.${encodeURIComponent(String(userId))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const sites = res.ok ? await res.json() : [];
    const limit = newPlan.features.sites.limit;
    if (limit !== -1 && sites.length > limit) violations.push({ feature: 'sites', current: sites.length, limit, message: `Je hebt ${sites.length} sites, maar het nieuwe plan staat maximaal ${limit} toe` });
  } else if (newPlan.features?.sites && !newPlan.features.sites.enabled) {
    const res = await fetch(`${supa}/rest/v1/sites?owner_type=eq.user&owner_id=eq.${encodeURIComponent(String(userId))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const sites = res.ok ? await res.json() : [];
    if (sites.length > 0) violations.push({ feature: 'sites', current: sites.length, limit: 0, message: 'Het nieuwe plan ondersteunt geen sites. Verwijder eerst al je sites.' });
  }

  // Teams
  if (newPlan.features?.teams?.enabled) {
    const res = await fetch(`${supa}/rest/v1/teams?owner_id=eq.${encodeURIComponent(String(userId))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const teams = res.ok ? await res.json() : [];
    const limit = newPlan.features.teams.limit;
    if (limit !== -1 && teams.length > limit) violations.push({ feature: 'teams', current: teams.length, limit, message: `Je hebt ${teams.length} teams, maar het nieuwe plan staat maximaal ${limit} toe` });
  } else if (newPlan.features?.teams && !newPlan.features.teams.enabled) {
    const res = await fetch(`${supa}/rest/v1/teams?owner_id=eq.${encodeURIComponent(String(userId))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const teams = res.ok ? await res.json() : [];
    if (teams.length > 0) violations.push({ feature: 'teams', current: teams.length, limit: 0, message: 'Het nieuwe plan ondersteunt geen teams. Verwijder eerst al je teams.' });
  }

  // Projects
  if (newPlan.features?.projects?.enabled) {
    const teamsRes = await fetch(`${supa}/rest/v1/teams?owner_id=eq.${encodeURIComponent(String(userId))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const teams = teamsRes.ok ? await teamsRes.json() : [];
    const teamIds = teams.map((t:any) => t.id).filter(Boolean);
    let userProjects: any[] = [];
    if (teamIds.length > 0) {
      const inList = teamIds.map((id:any) => encodeURIComponent(String(id))).join(',');
      const projectsRes = await fetch(`${supa}/rest/v1/projects?team_id=in.(${inList})`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      const projects = projectsRes.ok ? await projectsRes.json() : [];
      userProjects = projects;
    }
    const limit = newPlan.features.projects.limit;
    if (limit !== -1 && userProjects.length > limit) violations.push({ feature: 'projects', current: userProjects.length, limit, message: `Je hebt ${userProjects.length} projecten, maar het nieuwe plan staat maximaal ${limit} toe` });
  } else if (newPlan.features?.projects && !newPlan.features.projects.enabled) {
    const teamsRes = await fetch(`${supa}/rest/v1/teams?owner_id=eq.${encodeURIComponent(String(userId))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const teams = teamsRes.ok ? await teamsRes.json() : [];
    const teamIds = teams.map((t:any) => t.id).filter(Boolean);
    let userProjects: any[] = [];
    if (teamIds.length > 0) {
      const inList = teamIds.map((id:any) => encodeURIComponent(String(id))).join(',');
      const projectsRes = await fetch(`${supa}/rest/v1/projects?team_id=in.(${inList})`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      const projects = projectsRes.ok ? await projectsRes.json() : [];
      userProjects = projects;
    }
    if (userProjects.length > 0) violations.push({ feature: 'projects', current: userProjects.length, limit: 0, message: 'Het nieuwe plan ondersteunt geen projecten. Verwijder eerst al je projecten.' });
  }

  return { allowed: violations.length === 0, violations };
}

export {};
