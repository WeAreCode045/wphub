import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';


Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
    try {
        const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )
      
      const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const { site_id, wp_debug, wp_debug_log, wp_debug_display } = await req.json();

        console.log('[updateDebugSettings] Site ID:', site_id);
        console.log('[updateDebugSettings] Settings:', { wp_debug, wp_debug_log, wp_debug_display });

        if (!site_id) {
            return new Response(
        JSON.stringify({ error: 'Site ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const { data: sites, error: sitesError } = await supabase.from('sites').select().eq('id', site_id);
                if (sitesError || !sites) {
            return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        if (sites.length === 0) {
            return new Response(
        JSON.stringify({ error: 'Site not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        const site = sites[0];

        const connectorUrl = `${site.url}/wp-json/wphub/v1/updateDebugSettings`;
        const response = await fetch(connectorUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: site.api_key,
                wp_debug: wp_debug,
                wp_debug_log: wp_debug_log,
                wp_debug_display: wp_debug_display
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[updateDebugSettings] Connector error:', errorText);
            return new Response(
        JSON.stringify({ 
                success: false,
                error: `Failed to update debug settings: ${errorText}` 
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const result = await response.json();
        console.log('[updateDebugSettings] Result:', result);

        const healthCheck = site.health_check || {};
        healthCheck.debug_settings = {
            wp_debug: wp_debug,
            wp_debug_log: wp_debug_log,
            wp_debug_display: wp_debug_display
        };

        await supabase.from('sites').update({
            health_check: healthCheck
        });

        await supabase.from('activitylogs').insert({
            user_email: user.email,
            action: `Debug instellingen bijgewerkt voor site: ${site.name}`,
            entity_type: 'site',
            entity_id: site_id,
            details: `WP_DEBUG: ${wp_debug}, WP_DEBUG_LOG: ${wp_debug_log}, WP_DEBUG_DISPLAY: ${wp_debug_display}`
        });

        return new Response(
        JSON.stringify({
            success: true,
            message: 'Debug settings updated successfully'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[updateDebugSettings] Error:', error);
        return new Response(
        JSON.stringify({ 
            success: false,
            error: error.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});
