import Stripe from "https://esm.sh/stripe@17.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authMeWithToken, extractBearerFromReq, jsonResponse } from '../_helpers.ts';
import { corsHeaders } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "");
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, serviceRoleKey);

interface CreatePlanRequest {
  name: string;
  description?: string;
  monthly_price_cents: number;
  yearly_price_cents: number;
  trial_days?: number;
  position?: number;
  is_public?: boolean;
  features: {
    limits_sites: number;
    feature_projects: boolean;
    feature_local_plugins: boolean;
    feature_local_themes: boolean;
    feature_team_invites: boolean;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const token = extractBearerFromReq(req);
    const caller = await authMeWithToken(token);
    if (!caller) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supa = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const adminRes = await fetch(`${supa}/rest/v1/users?id=eq.${encodeURIComponent(caller.id)}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });
    if (!adminRes.ok) return jsonResponse({ error: 'Failed to verify admin' }, 500);
    const adminArr = await adminRes.json();
    const admin = adminArr?.[0];
    if (!admin || admin.role !== 'admin') return jsonResponse({ error: 'Admin access required' }, 403);

    const body = (await req.json()) as CreatePlanRequest;
    const {
      name,
      description,
      monthly_price_cents,
      yearly_price_cents,
      trial_days = 14,
      position = 0,
      is_public = true,
      features,
    } = body;

    if (!name || !monthly_price_cents || !yearly_price_cents || !features) {
      return jsonResponse({
        error: "name, monthly_price_cents, yearly_price_cents, and features are required"
      }, 400);
    }

    const product = await stripe.products.create({
      name,
      description,
      metadata: {
        created_by: caller.id,
        created_at: new Date().toISOString(),
        limits_sites: String(features.limits_sites),
        feature_projects: String(features.feature_projects),
        feature_local_plugins: String(features.feature_local_plugins),
        feature_local_themes: String(features.feature_local_themes),
        feature_team_invites: String(features.feature_team_invites),
      },
    });

    if (!product.id) {
      throw new Error("Failed to create Stripe product");
    }

    const monthlyPrice = await stripe.prices.create({
      currency: "usd",
      unit_amount: monthly_price_cents,
      recurring: {
        interval: "month",
      },
      product: product.id,
      nickname: `${name} - Monthly`,
      lookup_key: `${name.toLowerCase().replace(/\s+/g, "_")}_monthly`,
      metadata: {
        billing_period: "monthly",
      },
    });

    const yearlyPrice = await stripe.prices.create({
      currency: "usd",
      unit_amount: yearly_price_cents,
      recurring: {
        interval: "year",
      },
      product: product.id,
      nickname: `${name} - Yearly`,
      lookup_key: `${name.toLowerCase().replace(/\s+/g, "_")}_yearly`,
      metadata: {
        billing_period: "yearly",
      },
    });

    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .insert({
        stripe_product_id: product.id,
        stripe_price_monthly_id: monthlyPrice.id,
        stripe_price_yearly_id: yearlyPrice.id,
        name,
        description,
        position,
        is_public,
        is_subscription: true,
        monthly_price_cents,
        yearly_price_cents,
        trial_days,
      })
      .select()
      .single();

    if (planError) {
      throw new Error(`Failed to create plan in Supabase: ${planError.message}`);
    }

    return jsonResponse({
      plan_id: plan.id,
      stripe_product_id: product.id,
      stripe_price_monthly_id: monthlyPrice.id,
      stripe_price_yearly_id: yearlyPrice.id,
      message: "Subscription plan created successfully",
    }, 200);
  } catch (err: any) {
    console.error("Error creating plan:", err);

    if (err instanceof Stripe.errors.StripeError) {
      return jsonResponse({ error: `Stripe error: ${err.message}` }, 400);
    }

    return jsonResponse({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});

export {};
