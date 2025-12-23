import Stripe from 'npm:stripe';
import { authMeWithToken, extractBearerFromReq, jsonResponse } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '');

Deno.serve(async (req: Request) => {
  try {
    const token = extractBearerFromReq(req);
    const user = await authMeWithToken(token);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supa = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY');

    const subsRes = await fetch(`${supa}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(String(user.id))}&or=(status.eq.active,status.eq.trialing)`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const subscriptions = subsRes.ok ? await subsRes.json() : [];
    if (!subscriptions || subscriptions.length === 0) return jsonResponse({ error: 'No active subscription found' }, 404);

    const currentSubscription = subscriptions[0];
    if (currentSubscription.is_manual) return jsonResponse({ error: 'Manual subscriptions must be canceled by an administrator' }, 400);
    if (!currentSubscription.stripe_subscription_id) return jsonResponse({ error: 'No Stripe subscription found' }, 404);

    const canceledSubscription = await stripe.subscriptions.update(currentSubscription.stripe_subscription_id, { cancel_at_period_end: true });

    await fetch(`${supa}/rest/v1/user_subscriptions?id=eq.${encodeURIComponent(String(currentSubscription.id))}`, { method: 'PATCH', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ cancel_at_period_end: true, canceled_at: new Date().toISOString() }) });

    await fetch(`${supa}/rest/v1/activity_logs`, { method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_email: user.email, action: 'Abonnement opgezegd (eindigt aan het einde van de periode)', entity_type: 'user', entity_id: user.id }) });

    return jsonResponse({ success: true, message: 'Subscription will be canceled at the end of the billing period', cancels_at: new Date((canceledSubscription.cancel_at || 0) * 1000).toISOString() });
  } catch (err:any) {
    console.error('cancelSubscription error', err);
    return jsonResponse({ error: err.message || String(err) }, 500);
  }
});

export {};
