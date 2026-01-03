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

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Debug: Log environment variables
  console.log("=== ENVIRONMENT CHECK ===");
  console.log("SUPABASE_URL:", Deno.env.get("SUPABASE_URL") || "NOT SET");
  console.log("VITE_SUPABASE_URL:", Deno.env.get("VITE_SUPABASE_URL") || "NOT SET");
  console.log("SERVICE_ROLE_KEY exists:", Deno.env.get("SERVICE_ROLE_KEY") ? "YES" : "NO");
  console.log("SUPABASE_SERVICE_ROLE_KEY exists:", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? "YES" : "NO");
  console.log("STRIPE_SECRET_KEY exists:", Deno.env.get("STRIPE_SECRET_KEY") ? "YES" : "NO");
  console.log("========================");

  try {
    // Verify token and check admin role
    const token = extractBearerFromReq(req);
    console.log("Token extracted:", token ? "Yes (length: " + token.length + ")" : "No");
    
    const caller = await authMeWithToken(token);
    console.log("Auth result:", caller ? "Success - User ID: " + caller.id : "Failed");
    
    if (!caller) {
      console.error("authMeWithToken returned null - token invalid or expired");
      return jsonResponse({ error: "Unauthorized - invalid or expired token" }, 401);
    }

    // Check if caller is admin by querying users table
    console.log("Checking admin status for user:", caller.id);
    console.log("SUPABASE_URL:", SUPABASE_URL);
    console.log("SERVICE_KEY exists:", SERVICE_KEY ? "Yes" : "No");
    
    const adminRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(caller.id)}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    console.log("Admin check response status:", adminRes.status);
    
    if (!adminRes.ok) {
      console.error("Failed to verify admin status - HTTP", adminRes.status);
      const errorText = await adminRes.text();
      console.error("Error response:", errorText);
      return jsonResponse({ error: "Failed to verify admin" }, 500);
    }
    const adminArr = await adminRes.json();
    console.log("Admin query result:", adminArr);
    const admin = adminArr?.[0];
    if (!admin || admin.role !== "admin") {
      console.log("User role:", admin?.role, "User ID:", caller.id);
      return jsonResponse({ error: "Admin access required" }, 403);
    }
    
    console.log("Admin verified successfully");

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
      return error(
        "name, monthly_price_cents, yearly_price_cents, and features are required",
        400
      );
    }

    // Create Stripe Product
    const product = await stripe.products.create({
      name,
      description,
      type: "service",
      metadata: {
        created_by: userId,
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

    // Create monthly price
    const monthlyPrice = await stripe.prices.create({
      currency: "usd",
      unit_amount: monthly_price_cents,
      recurring: {
        interval: "month",
        usage_type: "licensed",
      },
      product: product.id,
      nickname: `${name} - Monthly`,
      lookup_key: `${name.toLowerCase().replace(/\s+/g, "_")}_monthly`,
      metadata: {
        billing_period: "monthly",
      },
    });

    // Create yearly price
    const yearlyPrice = await stripe.prices.create({
      currency: "usd",
      unit_amount: yearly_price_cents,
      recurring: {
        interval: "year",
        usage_type: "licensed",
      },
      product: product.id,
      nickname: `${name} - Yearly`,
      lookup_key: `${name.toLowerCase().replace(/\s+/g, "_")}_yearly`,
      metadata: {
        billing_period: "yearly",
      },
    });

    // Store plan in Supabase
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
  } catch (err) {
    console.error("Error creating plan:", err);

    if (err instanceof Stripe.errors.StripeError) {
      return jsonResponse({ error: `Stripe error: ${err.message}` }, 400);
    }

    return jsonResponse({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});
