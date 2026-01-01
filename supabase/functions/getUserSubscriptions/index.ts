import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Check authentication
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    // Extract token and verify it
    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("Auth error:", authError)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    // Handle request based on action
    const { action, filters = {}, orderBy = "created_at", ascending = false } = await req.json()

    let response
    
    switch (action) {
      case "list":
        // List all subscriptions (admin only)
        const { data: adminUser } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single()

        if (adminUser?.role !== "admin") {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          })
        }

        response = await supabase
          .from("user_subscriptions")
          .select("*")
          .order(orderBy, { ascending })

        break

      case "getByUserId":
        // Get subscriptions for current user
        const { data: userData } = await supabase
          .from("users")
          .select("stripe_customer_id")
          .eq("id", user.id)
          .single()

        if (!userData?.stripe_customer_id) {
          return new Response(JSON.stringify([]), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          })
        }

        response = await supabase
          .from("user_subscriptions")
          .select("*")
          .eq("customer", userData.stripe_customer_id)
          .order(orderBy, { ascending })

        break

      case "getInvoices":
        // Get invoices for current user
        const { data: userInvoiceData } = await supabase
          .from("users")
          .select("stripe_customer_id")
          .eq("id", user.id)
          .single()

        if (!userInvoiceData?.stripe_customer_id) {
          return new Response(JSON.stringify([]), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          })
        }

        response = await supabase
          .from("invoices")
          .select("*")
          .eq("customer", userInvoiceData.stripe_customer_id)
          .order(orderBy, { ascending })

        break

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        })
    }

    if (response.error) {
      throw response.error
    }

    return new Response(JSON.stringify(response.data || []), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (error) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    )
  }
})
