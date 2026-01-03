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

interface UpdateSubscriptionRequest {
  subscription_id: string;
  price_id: string;
  proration_behavior?: "create_invoices" | "always_invoice" | "none";
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

    const body = (await req.json()) as UpdateSubscriptionRequest;
    const {
      subscription_id,
      price_id,
      proration_behavior = "create_invoices",
    } = body;

    if (!subscription_id || !price_id) {
      return error("subscription_id and price_id are required", 400);
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

    // Get current subscription item ID
    if (!subscription.items.data?.[0]?.id) {
      return error("Subscription has no items", 400);
    }

    const itemId = subscription.items.data[0].id;

    // Update subscription with new price and proration
    const updatedSubscription = await stripe.subscriptions.update(
      subscription_id,
      {
        items: [
          {
            id: itemId,
            price: price_id,
          },
        ],
        proration_behavior,
        metadata: {
          ...subscription.metadata,
          last_updated: new Date().toISOString(),
          updated_by: userId,
        },
      }
    );

    // Update user's subscription_updated_at timestamp in public.users
    await supabase
      .from("public.users")
      .update({ subscription_updated_at: new Date().toISOString() })
      .eq("id", userId);

    return success({
      subscription_id: updatedSubscription.id,
      status: updatedSubscription.status,
      current_period_start: updatedSubscription.current_period_start,
      current_period_end: updatedSubscription.current_period_end,
      message: "Subscription updated successfully",
    });
  } catch (err) {
    console.error("Error updating subscription:", err);

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
