import Stripe from "https://esm.sh/stripe@17.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jwtDecode } from "https://esm.sh/jwt-decode@4.0.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface JWTPayload {
  sub: string;
  user_metadata?: {
    role?: string;
  };
  [key: string]: unknown;
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
    return new Response("ok", { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return error("Method not allowed", 405);
  }

  try {
    // Verify JWT and check admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return error("Missing Authorization header", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = jwtDecode<JWTPayload>(token);
    const userId = decoded.sub;
    const isAdmin = decoded.user_metadata?.role === "admin";

    if (!userId || !isAdmin) {
      return error("Unauthorized: admin role required", 403);
    }

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

    return success({
      plan_id: plan.id,
      stripe_product_id: product.id,
      stripe_price_monthly_id: monthlyPrice.id,
      stripe_price_yearly_id: yearlyPrice.id,
      message: "Subscription plan created successfully",
    });
  } catch (err) {
    console.error("Error creating plan:", err);

    if (err instanceof Stripe.errors.StripeError) {
      return error(`Stripe error: ${err.message}`, 400);
    }

    return error(
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
});

function success(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: corsHeaders(),
  });
}

function error(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: corsHeaders(),
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
}
