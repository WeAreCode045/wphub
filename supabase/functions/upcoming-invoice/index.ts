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

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  if (req.method !== "GET") {
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

    // Get user's current subscription
    const { data: userSub } = await supabase
      .from("user_subscriptions")
      .select("subscription_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!userSub?.subscription_id) {
      return error("User does not have an active subscription", 404);
    }

    // Fetch upcoming invoices for this subscription
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      subscription: userSub.subscription_id,
      expand: ["lines"],
    });

    if (!upcomingInvoice) {
      return error("No upcoming invoices found", 404);
    }

    return success({
      id: upcomingInvoice.id,
      subscription_id: upcomingInvoice.subscription,
      customer_id: upcomingInvoice.customer,
      status: upcomingInvoice.status,
      period_start: upcomingInvoice.period_start,
      period_end: upcomingInvoice.period_end,
      amount_due: upcomingInvoice.amount_due,
      amount_paid: upcomingInvoice.amount_paid,
      currency: upcomingInvoice.currency,
      due_date: upcomingInvoice.due_date,
      next_payment_attempt: upcomingInvoice.next_payment_attempt,
      lines: upcomingInvoice.lines?.data || [],
      metadata: {
        message: "This is the upcoming invoice for your subscription",
        will_be_charged: new Date(
          (upcomingInvoice.next_payment_attempt || upcomingInvoice.period_end) *
            1000
        ).toISOString(),
      },
    });
  } catch (err) {
    console.error("Error fetching upcoming invoice:", err);

    if (err instanceof Stripe.errors.StripeError) {
      if (err.statusCode === 404) {
        return error("No upcoming invoices found", 404);
      }
      return error(`Stripe error: ${err.message}`, err.statusCode || 400);
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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization",
  };
}
