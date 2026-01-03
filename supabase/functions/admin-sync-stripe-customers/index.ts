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
    console.log('[SYNC] Starting sync process...');
    
    const user = await authMeWithToken(token);
    
    if (!user) {
      console.error('[SYNC] No user authenticated');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    
    console.log('[SYNC] Authenticated user:', user.id);

    // Initialize Supabase with SERVICE_ROLE_KEY for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!serviceRoleKey) {
      return jsonResponse({ error: 'Service role key not configured' }, 500);
    }

    // Use SERVICE_ROLE_KEY to bypass RLS
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('[SYNC] Supabase client initialized with service role key');
    console.log('[SYNC] Using URL:', supabaseUrl);
    
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

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return jsonResponse({ error: 'Stripe secret key not configured' }, 500);
    }
    
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    // Helper function to update user with Stripe customer ID using raw REST API
    const updateUserWithCustomerId = async (userId: string, customerId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const updateResponse = await fetch(
          `${supabaseApiUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ stripe_customer_id: customerId }),
          }
        );

        if (!updateResponse.ok) {
          const errorBody = await updateResponse.text();
          console.error(`REST API update failed for user ${userId}:`, errorBody);
          return { success: false, error: `REST API error: ${updateResponse.status} ${errorBody}` };
        }

        return { success: true };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to update user ${userId}:`, errMsg);
        return { success: false, error: errMsg };
      }
    };

    // Get all users without stripe_customer_id using direct REST API
    console.log('[SYNC] Querying users without stripe_customer_id...');
    console.log('[SYNC] API URL:', supabaseApiUrl);
    
    let usersWithoutStripe: any[] = [];
    
    try {
      // First, get ALL users to see the data
      console.log('[SYNC] Step 1: Getting ALL users...');
      const allUsersUrl = `${supabaseApiUrl}/rest/v1/users?select=id,email,stripe_customer_id&limit=10`;
      console.log('[SYNC] All users URL:', allUsersUrl);
      
      const allUsersResponse = await fetch(allUsersUrl, {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
      });

      console.log('[SYNC] All users response status:', allUsersResponse.status);
      const allUsersText = await allUsersResponse.text();
      console.log('[SYNC] All users response:', allUsersText);
      
      let allUsers: any[] = [];
      try {
        allUsers = JSON.parse(allUsersText);
        console.log('[SYNC] Total users found:', allUsers.length);
        if (allUsers.length > 0) {
          console.log('[SYNC] Sample user:', allUsers[0]);
          // Check how many have null stripe_customer_id
          const usersWithNull = allUsers.filter(u => u.stripe_customer_id === null);
          console.log('[SYNC] Users with null stripe_customer_id:', usersWithNull.length);
          console.log('[SYNC] Sample user with null:', usersWithNull[0]);
        }
      } catch (parseErr) {
        console.error('[SYNC] Failed to parse all users:', parseErr);
      }
      
      // Now try the filtered query
      console.log('[SYNC] Step 2: Getting users with stripe_customer_id=is.null...');
      const queryUrl = `${supabaseApiUrl}/rest/v1/users?stripe_customer_id=is.null&select=id,email`;
      console.log('[SYNC] Query URL:', queryUrl);
      
      const restResponse = await fetch(queryUrl, {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
      });

      console.log('[SYNC] REST API response status:', restResponse.status);
      
      if (!restResponse.ok) {
        const errorText = await restResponse.text();
        console.error('[SYNC] REST API error:', restResponse.status, errorText);
        return jsonResponse({ 
          error: `REST API error: ${restResponse.status} ${errorText}` 
        }, 500);
      }

      const responseText = await restResponse.text();
      console.log('[SYNC] REST API response text:', responseText);
      
      try {
        usersWithoutStripe = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('[SYNC] Failed to parse response:', parseErr);
        usersWithoutStripe = [];
      }
      
      console.log(`[SYNC] Found ${usersWithoutStripe?.length || 0} users without stripe_customer_id`);
      
      if (usersWithoutStripe && usersWithoutStripe.length > 0) {
        console.log('[SYNC] First user:', usersWithoutStripe[0]);
      }
    } catch (fetchErr) {
      console.error('[SYNC] Fetch error:', fetchErr);
      return jsonResponse({ error: 'Failed to query users: ' + (fetchErr instanceof Error ? fetchErr.message : String(fetchErr)) }, 500);
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
        console.log(`[SYNC] ========================================`);
        console.log(`[SYNC] Processing user ${userRecord.id} with email ${userRecord.email}`);
        let stripeCustomerId: string;
        let isExisting = false;

        // Check if customer exists with this email in Stripe
        console.log(`[SYNC] Checking Stripe for existing customer with email ${userRecord.email}`);
        const existingCustomers = await stripe.customers.list({
          email: userRecord.email,
          limit: 1,
        });
        
        console.log(`[SYNC] Stripe search returned ${existingCustomers.data.length} customers`);

        if (existingCustomers.data.length > 0) {
          // Customer exists, link it
          stripeCustomerId = existingCustomers.data[0].id;
          isExisting = true;
          console.log(`[SYNC] ✓ Found existing Stripe customer ${stripeCustomerId}, will link it`);

          // Update customer metadata to include platform_user_id
          console.log(`[SYNC] Updating Stripe customer metadata...`);
          await stripe.customers.update(stripeCustomerId, {
            metadata: {
              platform_user_id: userRecord.id,
              linked_at: new Date().toISOString(),
            },
          });
          console.log(`[SYNC] ✓ Metadata updated`);

          console.log(`[SYNC] Updating database with customer ID...`);
          const updateResult = await updateUserWithCustomerId(userRecord.id, stripeCustomerId);

          if (!updateResult.success) {
            console.error(`[SYNC] ✗ Failed to link customer for user ${userRecord.id}:`, updateResult.error);
            results.push({
              user_id: userRecord.id,
              email: userRecord.email,
              status: 'error',
              error: 'Failed to update user: ' + updateResult.error,
            });
            errors++;
          } else {
            console.log(`[SYNC] ✓ Successfully linked user ${userRecord.id} to existing Stripe customer ${stripeCustomerId}`);
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
          console.log(`[SYNC] No existing customer found, creating new Stripe customer...`);
          const newCustomer = await stripe.customers.create({
            email: userRecord.email,
            metadata: {
              platform_user_id: userRecord.id,
              created_at: new Date().toISOString(),
            },
          });

          stripeCustomerId = newCustomer.id;
          console.log(`[SYNC] ✓ Created Stripe customer ${stripeCustomerId}`);

          console.log(`[SYNC] Updating database with customer ID...`);
          const updateResult = await updateUserWithCustomerId(userRecord.id, stripeCustomerId);

          if (!updateResult.success) {
            console.error(`[SYNC] ✗ Failed to save customer for user ${userRecord.id}:`, updateResult.error);
            results.push({
              user_id: userRecord.id,
              email: userRecord.email,
              status: 'error',
              error: 'Failed to update user: ' + updateResult.error,
            });
            errors++;
          } else {
            console.log(`[SYNC] ✓ Successfully saved Stripe customer ${stripeCustomerId} for user ${userRecord.id}`);
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
        console.error(`[SYNC] ✗ Error processing user ${userRecord.id}:`, error);
        console.error(`[SYNC] Error details:`, error instanceof Error ? error.stack : error);
        results.push({
          user_id: userRecord.id,
          email: userRecord.email,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        errors++;
      }
    }

    console.log(`[SYNC] ========================================`);
    console.log(`[SYNC] Sync complete! Created: ${created}, Linked: ${linked}, Errors: ${errors}`);

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
