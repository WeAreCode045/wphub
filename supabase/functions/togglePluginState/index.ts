import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';
import { TogglePluginStateRequestSchema, z } from '../_shared/schemas.ts';

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

        // Parse and validate request body with Zod
        let body;
        try {
            const bodyText = await req.text();
            const parsed = JSON.parse(bodyText);
            body = TogglePluginStateRequestSchema.parse(parsed);
        } catch (parseError) {
            console.error('[togglePluginState] Validation error:', parseError);
            const error = parseError instanceof z.ZodError
                ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
                : `Invalid request: ${parseError.message}`;
            return new Response(
                JSON.stringify({ error }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { site_id, plugin_slug } = body;

        console.log('[togglePluginState] === START ===');
        console.log('[togglePluginState] Site ID:', site_id);
        console.log('[togglePluginState] Plugin slug:', plugin_slug);

        const { data: sites, error: sitesError } = await supabase.from('sites').select().eq('id', site_id);
        if (sitesError || !sites || sites.length === 0) {
            return new Response(
        JSON.stringify({ error: 'Site not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        const site = sites[0];

        console.log('[togglePluginState] Site:', site.name);
        console.log('[togglePluginState] Calling connector to toggle:', plugin_slug);

        const connectorUrl = `${site.url}/wp-json/wphub/v1/togglePlugin`;
        console.log('[togglePluginState] Calling connector:', connectorUrl);

        const response = await fetch(connectorUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: site.api_key,
                plugin_slug: plugin_slug
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[togglePluginState] Connector error:', errorText);
            return new Response(
        JSON.stringify({ 
                success: false,
                error: `Connector error: ${response.status} - ${errorText}` 
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const result = await response.json();
        console.log('[togglePluginState] Connector response:', result);

        console.log('[togglePluginState] === END ===');

        return new Response(
        JSON.stringify({
            success: result.success,
            message: result.message,
            new_status: result.new_status
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[togglePluginState] ❌ ERROR:', error.message);
        return new Response(
        JSON.stringify({ 
            success: false,
            error: error.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});
