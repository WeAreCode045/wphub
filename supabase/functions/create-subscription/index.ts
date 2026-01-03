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
  [key: string]: unknown;
}

interface CreateSubscriptionRequest {
  price_id: string;
  payment_method_id?: string;
  billing_cycle_anchor?: string;
  metadata?: Record<string, string>;
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
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return error("Missing Authorization header", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = jwtDecode<JWTPayload>(token);
    const userId = decoded.sub;

    if (!userId) {
      return error("Invalid token", 401);
    }

    const body = (await req.json()) as CreateSubscriptionRequest;
    const { price_id, payment_method_id, metadata } = body;

    if (!price_id) {
      return error("price_id is required", 400);
    }

    // Get user's Stripe customer ID from public.users
    const { data: user } = await supabase
      .from("public.users")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (!user?.stripe_customer_id) {
      return error(
        "User does not have a Stripe customer. Call create-stripe-customer first.",
        400
      );
    }

    const customerId = user.stripe_customer_id;

    // Fetch price details to get product info
    const price = await stripe.prices.retrieve(price_id);
    if (!price) {
      return error("Price not found", 404);
    }

    // Prepare subscription items
    const items = [{ price: price_id }];

    // Prepare subscription creation params
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items,
      metadata: {
        platform_user_id: userId,
        created_at: new Date().toISOString(),
        ...metadata,
      },
    };

    // Add payment method if provided
    if (payment_method_id) {
      subscriptionParams.default_payment_method = payment_method_id;
    }

    // Fetch plan to get trial days
    const plan = await supabase
      .from("subscription_plans")
      .select("trial_days")
      .eq("stripe_product_id", price.product)
      .single();

    if (plan.data?.trial_days && plan.data.trial_days > 0) {
      subscriptionParams.trial_period_days = plan.data.trial_days;
    }

    // Create subscription in Stripe
    const subscription = await stripe.subscriptions.create(subscriptionParams);

    if (!subscription.id) {
      throw new Error("Failed to create subscription");
    }

    // Update user's subscription_updated_at timestamp in public.users
    await supabase
      .from("public.users")
      .update({ subscription_updated_at: new Date().toISOString() })
      .eq("id", userId);

    return success({
      subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      trial_end: subscription.trial_end,
      message: "Subscription created successfully",
    });
  } catch (err) {
    console.error("Error creating subscription:", err);

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
