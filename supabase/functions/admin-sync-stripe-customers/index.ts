import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

interface SyncResult {
  user_id: string;
  email: string;
  status: 'created' | 'linked' | 'error';
  stripe_customer_id?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // Authenticate user and verify admin
    const token = extractBearerFromReq(req);
    const user = await authMeWithToken(token);
    
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Initialize Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Verify admin
    const { data: adminUser, error: adminError } = await supabaseClient
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (adminError || !adminUser?.is_admin) {
      return jsonResponse({ error: 'Admin access required' }, 403);
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return jsonResponse({ error: 'Stripe secret key not configured' }, 500);
    }
    
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    // Get all users without stripe_customer_id
    const { data: usersWithoutStripe, error: usersError } = await supabaseClient
      .from('users')
      .select('id, email')
      .is('stripe_customer_id', null);

    if (usersError) {
      return jsonResponse({ error: 'Failed to fetch users: ' + usersError.message }, 500);
    }

    if (!usersWithoutStripe || usersWithoutStripe.length === 0) {
      return jsonResponse({
        success: true,
        message: 'No users without Stripe customer ID found',
        results: [],
        summary: {
          total: 0,
          created: 0,
          linked: 0,
          errors: 0,
        },
      }, 200);
    }

    const results: SyncResult[] = [];
    let created = 0;
    let linked = 0;
    let errors = 0;

    // Process each user
    for (const userRecord of usersWithoutStripe) {
      try {
        let stripeCustomerId: string;

        // Check if customer exists with this email
        const existingCustomers = await stripe.customers.list({
          email: userRecord.email,
          limit: 1,
        });

        if (existingCustomers.data.length > 0) {
          // Customer exists, link it
          stripeCustomerId = existingCustomers.data[0].id;

          const { error: updateError } = await supabaseClient
            .from('users')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('id', userRecord.id);

          if (updateError) {
            results.push({
              user_id: userRecord.id,
              email: userRecord.email,
              status: 'error',
              error: 'Failed to update user: ' + updateError.message,
            });
            errors++;
          } else {
            results.push({
              user_id: userRecord.id,
              email: userRecord.email,
              status: 'linked',
              stripe_customer_id: stripeCustomerId,
            });
            linked++;
          }
        } else {
          // Create new customer
          const newCustomer = await stripe.customers.create({
            email: userRecord.email,
            metadata: {
              platform_user_id: userRecord.id,
            },
          });

          stripeCustomerId = newCustomer.id;

          const { error: updateError } = await supabaseClient
            .from('users')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('id', userRecord.id);

          if (updateError) {
            results.push({
              user_id: userRecord.id,
              email: userRecord.email,
              status: 'error',
              error: 'Failed to update user: ' + updateError.message,
            });
            errors++;
          } else {
            results.push({
              user_id: userRecord.id,
              email: userRecord.email,
              status: 'created',
              stripe_customer_id: stripeCustomerId,
            });
            created++;
          }
        }
      } catch (error) {
        results.push({
          user_id: userRecord.id,
          email: userRecord.email,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        errors++;
      }
    }

    return jsonResponse({
      success: true,
      message: `Processed ${results.length} users`,
      results: results,
      summary: {
        total: results.length,
        created: created,
        linked: linked,
        errors: errors,
      },
    }, 200);

  } catch (error) {
    console.error('Error syncing Stripe customers:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
