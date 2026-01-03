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

interface UpdatePaymentMethodRequest {
  subscription_id: string;
  payment_method_id: string;
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

    const body = (await req.json()) as UpdatePaymentMethodRequest;
    const { subscription_id, payment_method_id } = body;

    if (!subscription_id || !payment_method_id) {
      return error("subscription_id and payment_method_id are required", 400);
    }

    // Get user's Stripe customer ID from public.users
    const { data: user } = await supabase
      .from("public.users")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (!user?.stripe_customer_id) {
      return error("User does not have a Stripe customer", 400);
    }

    // Verify that the subscription belongs to the user
    const subscription = await stripe.subscriptions.retrieve(subscription_id);

    if (subscription.customer !== user.stripe_customer_id) {
      return error("Subscription does not belong to this user", 403);
    }

    // Attach payment method to customer if not already attached
    const paymentMethod = await stripe.paymentMethods.retrieve(
      payment_method_id
    );

    if (!paymentMethod.customer) {
      await stripe.paymentMethods.attach(payment_method_id, {
        customer: user.stripe_customer_id,
      });
    }

    // Update subscription with new payment method
    const updatedSubscription = await stripe.subscriptions.update(
      subscription_id,
      {
        default_payment_method: payment_method_id,
        metadata: {
          ...subscription.metadata,
          payment_method_updated_at: new Date().toISOString(),
          updated_by: userId,
        },
      }
    );

    return success({
      subscription_id: updatedSubscription.id,
      default_payment_method: updatedSubscription.default_payment_method,
      message: "Payment method updated successfully",
    });
  } catch (err) {
    console.error("Error updating payment method:", err);

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
