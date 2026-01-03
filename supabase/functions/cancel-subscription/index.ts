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

interface CancelSubscriptionRequest {
  subscription_id: string;
  cancel_immediately?: boolean;
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

    const body = (await req.json()) as CancelSubscriptionRequest;
    const { subscription_id, cancel_immediately = false } = body;

    if (!subscription_id) {
      return error("subscription_id is required", 400);
    }

    // Verify that the subscription belongs to the user
    const subscription = await stripe.subscriptions.retrieve(subscription_id);

    const { data: user } = await supabase
      .from("public.users")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (subscription.customer !== user?.stripe_customer_id) {
      return error("Subscription does not belong to this user", 403);
    }

    // Cancel the subscription
    let canceledSubscription;

    if (cancel_immediately) {
      // Cancel immediately (stop access right now)
      canceledSubscription = await stripe.subscriptions.del(subscription_id);
    } else {
      // Cancel at period end (access until billing period ends)
      canceledSubscription = await stripe.subscriptions.update(
        subscription_id,
        {
          cancel_at_period_end: true,
          metadata: {
            ...subscription.metadata,
            cancellation_requested_at: new Date().toISOString(),
            cancellation_requested_by: userId,
          },
        }
      );
    }

    // Update user's subscription_updated_at timestamp in public.users
    await supabase
      .from("public.users")
      .update({ subscription_updated_at: new Date().toISOString() })
      .eq("id", userId);

    return success({
      subscription_id: canceledSubscription.id,
      status: canceledSubscription.status,
      canceled_at: canceledSubscription.canceled_at,
      cancel_at: canceledSubscription.cancel_at,
      cancel_at_period_end: canceledSubscription.cancel_at_period_end,
      message: cancel_immediately
        ? "Subscription canceled immediately"
        : "Subscription scheduled for cancellation at period end",
    });
  } catch (err) {
    console.error("Error canceling subscription:", err);

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
