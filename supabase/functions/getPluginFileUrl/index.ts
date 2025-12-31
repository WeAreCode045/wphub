import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_helpers.ts';


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
        const { api_key, plugin_id, version_id } = await req.json();

        if (!api_key) {
            return new Response(
        JSON.stringify({ error: 'API key is required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        // Verify API key
        const { data: sites, error: sitesError } = await supabase.from('sites').select().eq('api_key');
        
                if (sitesError || !sites) {
            return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        if (sites.length === 0) {
            return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        // Get the plugin version
        const { data: versions, error: versionsError } = await supabase
            .from('pluginversions')
            .select()
            .eq('id', version_id)
            .eq('plugin_id', plugin_id);

                if (versionsError || !versions) {
            return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        if (versions.length === 0) {
            return new Response(
        JSON.stringify({ error: 'Plugin version not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const version = versions[0];

        return new Response(
        JSON.stringify({ 
            success: true,
            file_url: version.file_url,
            version: version.version
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('Error in getPluginFileUrl:', error);
        return new Response(
        JSON.stringify({ 
            error: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});