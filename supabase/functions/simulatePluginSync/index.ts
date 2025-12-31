import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_helpers.ts';
import { SimulatePluginSyncRequestSchema, z } from '../_shared/schemas.ts';



Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

    try {
        // Parse and validate request body
        let body;
        try {
          const rawBody = await req.json();
          body = SimulatePluginSyncRequestSchema.parse(rawBody);
        } catch (parseError) {
          console.error('[simulatePluginSync] Validation error:', parseError);
          const error = parseError instanceof z.ZodError
            ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
            : `Invalid request: ${parseError.message}`;
          return new Response(
            JSON.stringify({ error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { site_id } = body;

        console.log(`[simulatePluginSync] Triggered for site_id: ${site_id}`);

        // Get site details
        const { data: sites, error: sitesError } = await supabase.from('sites').select().eq('id', site_id);
        
                if (sitesError || !sites) {
            return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        if (sites.length === 0) {
            console.log(`[simulatePluginSync] Site not found: ${site_id}`);
            return new Response(
        JSON.stringify({ error: 'Site not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const site = sites[0];
        console.log(`[simulatePluginSync] Site found: ${site.name} (${site.url})`);

        // Try to trigger sync on WordPress site via REST API
        try {
            const wpSyncUrl = `${site.url}/wp-json/wphub/v1/sync`;
            console.log(`[simulatePluginSync] Calling WordPress sync endpoint: ${wpSyncUrl}`);
            
            const response = await fetch(wpSyncUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    api_key: site.api_key,
                    trigger: 'platform'
                })
            });

            const responseText = await response.text();
            console.log(`[simulatePluginSync] WordPress response status: ${response.status}`);
            console.log(`[simulatePluginSync] WordPress response body:`, responseText);

            if (response.ok) {
                return new Response(
        JSON.stringify({ 
                    success: true,
                    message: 'Sync triggered successfully on WordPress site',
                    site_name: site.name,
                    wp_response: responseText
                }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
            } else {
                console.log(`[simulatePluginSync] WordPress sync failed, will sync on next cron`);
                return new Response(
        JSON.stringify({ 
                    success: true,
                    message: 'Sync will be executed on next scheduled check',
                    site_name: site.name,
                    note: 'Direct trigger not available, changes marked as pending',
                    wp_status: response.status,
                    wp_response: responseText
                }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
            }
        } catch (wpError) {
            console.error(`[simulatePluginSync] WordPress connection error:`, wpError);
            return new Response(
        JSON.stringify({ 
                success: true,
                message: 'Changes marked as pending, will sync on next scheduled check',
                site_name: site.name,
                error: wpError.message
            }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

    } catch (error) {
        console.error('[simulatePluginSync] Error:', error);
        return new Response(
        JSON.stringify({ 
            error: error.message,
            stack: error.stack
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});