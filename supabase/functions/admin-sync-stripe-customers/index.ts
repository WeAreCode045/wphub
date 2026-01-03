import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

interface SyncResult {
  user_id: string;
  email: string;
  status: 'created' | 'error';
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

    // Initialize Supabase with SERVICE_ROLE_KEY for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!serviceRoleKey) {
      return jsonResponse({ error: 'Service role key not configured' }, 500);
    }

    // Use SERVICE_ROLE_KEY to bypass RLS
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);
    
    // Also create a client with explicit POST method for direct REST API updates
    const supabaseApiUrl = supabaseUrl.replace(/\/$/, '');

    // Verify admin - check role field
    let adminUser = null;
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('id, role, email')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Admin check error:', error);
        return jsonResponse({ 
          error: 'Failed to verify admin status: ' + error.message 
        }, 403);
      }

      adminUser = data;
    } catch (err) {
      console.error('Admin verification failed:', err);
      return jsonResponse({ error: 'Admin verification failed' }, 403);
    }

    // Check if user is admin (role = 'admin')
    if (!adminUser || adminUser?.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required. User role = ' + (adminUser?.role || 'null')
      }, 403);
    }

    // Initialize Supabase API URL
    const supabaseApiUrl = supabaseUrl.replace(/\/$/, '');

    // Helper function to call create-stripe-customer edge function for a user
    const createStripeCustomerForUser = async (userId: string, userEmail: string): Promise<{ success: boolean; customerId?: string; error?: string }> => {
      try {
        // Create a temporary access token for the user to call create-stripe-customer
        const { data: tokenData, error: tokenError } = await supabaseClient.auth.admin.generateLink({
          type: 'magiclink',
          email: userEmail,
        });

        if (tokenError || !tokenData) {
          console.error(`Failed to generate token for user ${userId}:`, tokenError);
          return { success: false, error: 'Failed to generate auth token' };
        }

        // Call create-stripe-customer edge function
        const createCustomerResponse = await fetch(
          `${supabaseApiUrl}/functions/v1/create-stripe-customer`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${tokenData.properties.action_link.split('access_token=')[1]?.split('&')[0] || serviceRoleKey}`,
              'apikey': serviceRoleKey,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!createCustomerResponse.ok) {
          const errorBody = await createCustomerResponse.text();
          console.error(`create-stripe-customer failed for user ${userId}:`, errorBody);
          return { success: false, error: `Edge function error: ${createCustomerResponse.status}` };
        }

        const result = await createCustomerResponse.json();
        
        if (result.customer_id) {
          return { success: true, customerId: result.customer_id };
        } else {
          return { success: false, error: 'No customer_id returned' };
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to create customer for user ${userId}:`, errMsg);
        return { success: false, error: errMsg };
      }
    };

    // Get all users without stripe_customer_id
    const { data: usersWithoutStripe, error: usersError } = await supabaseClient
      .from('users')
      .select('id, email')
      .is('stripe_customer_id', null);

    if (usersError) {
      console.error('Failed to fetch users:', usersError);
      return jsonResponse({ error: 'Failed to fetch users: ' + usersError.message }, 500);
    }

    console.log(`Found ${usersWithoutStripe?.length || 0} users without stripe_customer_id`);

    if (!usersWithoutStripe || usersWithoutStripe.length === 0) {
      return jsonResponse({
        success: true,
        message: 'No users without Stripe customer ID found',
        results: [],
        summary: {
          total: 0,
          created: 0,
          errors: 0,
        },
      }, 200);
    }

    const results: SyncResult[] = [];
    let created = 0;
    let errors = 0;

    // Process each user
    for (const userRecord of usersWithoutStripe) {
      try {
        console.log(`Processing user ${userRecord.id} with email ${userRecord.email}`);
        
        // Call create-stripe-customer edge function for this user
        const createResult = await createStripeCustomerForUser(userRecord.id, userRecord.email);

        if (!createResult.success) {
          console.error(`Failed to create customer for user ${userRecord.id}:`, createResult.error);
          results.push({
            user_id: userRecord.id,
            email: userRecord.email,
            status: 'error',
            error: 'Failed to create Stripe customer: ' + createResult.error,
          });
          errors++;
        } else {
          console.log(`Successfully created Stripe customer ${createResult.customerId} for user ${userRecord.id}`);
          results.push({
            user_id: userRecord.id,
            email: userRecord.email,
            status: 'created',
            stripe_customer_id: createResult.customerId,
          });
          created++;
        }
      } catch (error) {
        console.error(`Error processing user ${userRecord.id}:`, error);
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
