import Stripe from "https://esm.sh/stripe@17.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_helpers.ts';

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!stripeSecretKey || !supabaseUrl || !serviceRoleKey) {
  console.error("Missing environment variables:", {
    hasStripeKey: !!stripeSecretKey,
    hasUrl: !!supabaseUrl,
    hasServiceKey: !!serviceRoleKey,
  });
}

const stripe = new Stripe(stripeSecretKey || "");
const supabase = createClient(supabaseUrl || "", serviceRoleKey || "");

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

  try {
    console.log("=== START: admin-create-plan ===");
    console.log("Environment check - has stripe key:", !!stripeSecretKey, "has url:", !!supabaseUrl, "has role key:", !!serviceRoleKey);
    
    // Get auth header and extract user ID from JWT payload
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", authHeader ? "yes" : "no");
    
    if (!authHeader) {
      console.error("No Authorization header - returning 401");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Token extracted, length:", token.length);
    
    let payload;
    try {
      payload = getJWTPayload(token);
      console.log("JWT payload parsed successfully:", !!payload);
    } catch (e) {
      console.error("Error parsing JWT payload:", e);
      return jsonResponse({ error: "Invalid token format" }, 401);
    }
    
    if (!payload || !payload.sub) {
      console.error("Invalid JWT payload - returning 401");
      console.log("Payload:", payload);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userId = payload.sub;
    console.log("User ID from JWT:", userId);

    // Check if user is admin by querying the users table
    let userData;
    let userError;
    try {
      const result = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .single();
      
      userData = result.data;
      userError = result.error;
      
      console.log("User lookup result - error:", userError?.message, "data:", userData);
    } catch (e) {
      console.error("Exception during user lookup:", e);
      return jsonResponse({ error: "Database query failed" }, 500);
    }

    if (userError) {
      console.error("User lookup error:", userError.message);
      return jsonResponse({ error: "User not found" }, 404);
    }

    if (!userData || userData.role !== "admin") {
      console.log("User role:", userData?.role, "- Admin access required");
      return jsonResponse({ error: "Admin access required" }, 403);
    }

    console.log("Admin verified for user:", userId);

    let body;
    try {
      body = (await req.json()) as CreatePlanRequest;
      console.log("Request body parsed successfully");
    } catch (e) {
      console.error("Failed to parse request body:", e);
      return jsonResponse({ error: "Invalid request body" }, 400);
    }

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
