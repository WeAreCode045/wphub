import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';
import { UpdateConnectorPluginRequestSchema, z } from '../_shared/schemas.ts';


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

        // Parse and validate request body
        let body;
        try {
          const bodyText = await req.text();
          const parsed = JSON.parse(bodyText);
          body = UpdateConnectorPluginRequestSchema.parse(parsed);
        } catch (parseError) {
          console.error('[updateConnectorPlugin] Validation error:', parseError);
          const error = parseError instanceof z.ZodError
            ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
            : `Invalid request: ${parseError.message}`;
          return new Response(
            JSON.stringify({ error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { site_id } = body;

        console.log('[updateConnectorPlugin] === START ===');
        console.log('[updateConnectorPlugin] Site ID:', site_id);

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

        const { data: settings, error: settingsError } = await supabase.from('sitesettingss').select();
        const activeVersion = settings.find(s => s.setting_key === 'active_connector_version')?.setting_value;

        if (!activeVersion) {
            return new Response(
        JSON.stringify({ error: 'No active connector version found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const { data: connectors, error: connectorsError } = await supabase.from('connectors').select();
        const activeConnector = connectors.find(c => c.version === activeVersion);

        if (!activeConnector) {
            return new Response(
        JSON.stringify({ error: 'Active connector not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        console.log('[updateConnectorPlugin] Active connector version:', activeVersion);
        console.log('[updateConnectorPlugin] File URL:', activeConnector.file_url);

        const connectorUrl = `${site.url}/wp-json/wphub/v1/updateSelf`;
        console.log('[updateConnectorPlugin] Calling connector:', connectorUrl);

        const response = await fetch(connectorUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: site.api_key, file_url: activeConnector.file_url, new_version: activeVersion }) });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[updateConnectorPlugin] Connector error:', errorText);
            return new Response(
        JSON.stringify({ success: false, error: `Connector error: ${response.status} - ${errorText}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const result = await response.json();
        console.log('[updateConnectorPlugin] Connector response:', result);

        if (result.success) {
            await supabase.from('activitylogs').insert({ user_email: user.email, action: `Connector plugin geüpdatet op site ${site.name}`, entity_type: "site", details: `Nieuwe versie: ${activeVersion}` });
            console.log('[updateConnectorPlugin] ✅ Success');
        }

        console.log('[updateConnectorPlugin] === END ===');

        return new Response(
        JSON.stringify({ success: result.success, message: result.message, new_version: activeVersion }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[updateConnectorPlugin] ❌ ERROR:', error.message);
        return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});