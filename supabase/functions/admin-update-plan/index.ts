import Stripe from "https://esm.sh/stripe@17.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Helper to extract JWT payload (already validated by Supabase)
function getJWTPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    console.error("Failed to parse JWT:", e);
    return null;
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

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
    // Get auth header and extract user ID from JWT payload
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No Authorization header");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = getJWTPayload(token);
    
    if (!payload || !payload.sub) {
      console.error("Invalid JWT payload");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userId = payload.sub;
    console.log("User ID from JWT:", userId);

    // Check if user is admin by querying the users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error("User lookup error:", userError.message);
      return jsonResponse({ error: "User not found" }, 404);
    }

    if (!userData || userData.role !== "admin") {
      console.log("User role:", userData?.role, "- Admin access required");
      return jsonResponse({ error: "Admin access required" }, 403);
    }

    console.log("Admin verified for user:", userId);

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
