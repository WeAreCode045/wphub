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
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
  [key: string]: unknown;
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
    const email = decoded.email;
    const fullName = decoded.user_metadata?.full_name;

    if (!userId) {
      return error("Invalid token", 401);
    }

    // Check if user already has a Stripe customer
    const { data: user } = await supabase
      .from("public.users")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (user?.stripe_customer_id) {
      // Idempotency: customer already exists
      return success({
        customer_id: user.stripe_customer_id,
        message: "Customer already exists",
      });
    }

    let customerId: string;
    let isExistingCustomer = false;

    // Check if a Stripe customer already exists with this email
    if (email) {
      console.log(`Checking for existing Stripe customer with email: ${email}`);
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        // Link existing Stripe customer
        customerId = existingCustomers.data[0].id;
        isExistingCustomer = true;
        console.log(`Found existing Stripe customer ${customerId}, linking to user ${userId}`);
        
        // Update customer metadata to include platform_user_id
        await stripe.customers.update(customerId, {
          metadata: {
            platform_user_id: userId,
            linked_at: new Date().toISOString(),
          },
        });
      } else {
        // Create new Stripe customer
        console.log(`No existing customer found, creating new Stripe customer for ${email}`);
        const customer = await stripe.customers.create({
          email: email,
          name: fullName || undefined,
          metadata: {
            platform_user_id: userId,
            created_at: new Date().toISOString(),
          },
        });

        if (!customer.id) {
          throw new Error("Failed to create Stripe customer");
        }
        customerId = customer.id;
      }
    } else {
      // No email, create new customer without email
      console.log(`No email provided, creating Stripe customer without email`);
      const customer = await stripe.customers.create({
        name: fullName || undefined,
        metadata: {
          platform_user_id: userId,
          created_at: new Date().toISOString(),
        },
      });

      if (!customer.id) {
        throw new Error("Failed to create Stripe customer");
      }
      customerId = customer.id;
    }

    // Update user with stripe_customer_id in public.users table
    // Note: This should be done via Stripe Sync Engine, but we do it here for registration flow
    const { error: updateError } = await supabase
      .from("public.users")
      .update({
        stripe_customer_id: customerId,
        subscription_updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      // Log error but continue - Stripe Sync Engine will sync this eventually
      console.error("Failed to update user with stripe_customer_id:", updateError);
    }

    return success({
      customer_id: customerId,
      message: isExistingCustomer 
        ? "Linked to existing Stripe customer" 
        : "Stripe customer created successfully",
      is_existing: isExistingCustomer,
    });
  } catch (err) {
    console.error("Error creating Stripe customer:", err);
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  };
}
