import Stripe from "https://esm.sh/stripe@17.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authMeWithToken, extractBearerFromReq, jsonResponse, corsHeaders } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface UpdatePlanRequest {
  plan_id: number;
  name?: string;
  description?: string;
  monthly_price_cents?: number;
  yearly_price_cents?: number;
  trial_days?: number;
  position?: number;
  is_public?: boolean;
  features?: {
    limits_sites: number;
    feature_projects: boolean;
    feature_local_plugins: boolean;
    feature_local_themes: boolean;
    feature_team_invites: boolean;
  };
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // Verify token and check admin role
    const token = extractBearerFromReq(req);
    const caller = await authMeWithToken(token);
    if (!caller) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Check if caller is admin by querying users table
    const adminRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(caller.id)}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    if (!adminRes.ok) {
      console.error("Failed to verify admin status");
      return jsonResponse({ error: "Failed to verify admin" }, 500);
    }
    const adminArr = await adminRes.json();
    const admin = adminArr?.[0];
    if (!admin || admin.role !== "admin") {
      console.log("User role:", admin?.role, "User ID:", caller.id);
      return jsonResponse({ error: "Admin access required" }, 403);
    }

    const body = (await req.json()) as UpdatePlanRequest;
    const {
      plan_id,
      name,
      description,
      monthly_price_cents,
      yearly_price_cents,
      trial_days,
      position,
      is_public,
      features,
    } = body;

    if (!plan_id) {
      return error("plan_id is required", 400);
    }

    // Get current plan
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planError || !plan) {
      return error("Plan not found", 404);
    }

    // Update Stripe Product
    const updateMetadata: Record<string, string> = {};
    if (features) {
      updateMetadata.limits_sites = String(features.limits_sites);
      updateMetadata.feature_projects = String(features.feature_projects);
      updateMetadata.feature_local_plugins = String(
        features.feature_local_plugins
      );
      updateMetadata.feature_local_themes = String(
        features.feature_local_themes
      );
      updateMetadata.feature_team_invites = String(
        features.feature_team_invites
      );
    }

    const stripeProductUpdate: Stripe.ProductUpdateParams = {};
    if (name) stripeProductUpdate.name = name;
    if (description) stripeProductUpdate.description = description;
    if (Object.keys(updateMetadata).length > 0) {
      stripeProductUpdate.metadata = updateMetadata;
    }

    if (Object.keys(stripeProductUpdate).length > 0) {
      await stripe.products.update(plan.stripe_product_id, stripeProductUpdate);
    }

    // Update prices if they changed
    if (monthly_price_cents && monthly_price_cents !== plan.monthly_price_cents) {
      // Create new monthly price (prices are immutable)
      const newMonthlyPrice = await stripe.prices.create({
        currency: "usd",
        unit_amount: monthly_price_cents,
        recurring: {
          interval: "month",
          usage_type: "licensed",
        },
        product: plan.stripe_product_id,
        nickname: `${name || plan.name} - Monthly`,
        metadata: {
          billing_period: "monthly",
        },
      });

      // Update plan with new price
      await supabase
        .from("subscription_plans")
        .update({
          stripe_price_monthly_id: newMonthlyPrice.id,
          monthly_price_cents,
        })
        .eq("id", plan_id);
    }

    if (yearly_price_cents && yearly_price_cents !== plan.yearly_price_cents) {
      // Create new yearly price (prices are immutable)
      const newYearlyPrice = await stripe.prices.create({
        currency: "usd",
        unit_amount: yearly_price_cents,
        recurring: {
          interval: "year",
          usage_type: "licensed",
        },
        product: plan.stripe_product_id,
        nickname: `${name || plan.name} - Yearly`,
        metadata: {
          billing_period: "yearly",
        },
      });

      // Update plan with new price
      await supabase
        .from("subscription_plans")
        .update({
          stripe_price_yearly_id: newYearlyPrice.id,
          yearly_price_cents,
        })
        .eq("id", plan_id);
    }

    // Update plan metadata in Supabase
    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (trial_days !== undefined) updateData.trial_days = trial_days;
    if (position !== undefined) updateData.position = position;
    if (is_public !== undefined) updateData.is_public = is_public;

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from("subscription_plans")
        .update(updateData)
        .eq("id", plan_id);
    }

    return jsonResponse({
      plan_id,
      message: "Subscription plan updated successfully",
    }, 200);
  } catch (err) {
    console.error("Error updating plan:", err);

    if (err instanceof Stripe.errors.StripeError) {
      return jsonResponse({ error: `Stripe error: ${err.message}` }, 400);
    }

    return jsonResponse({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});
