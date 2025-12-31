import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_helpers.ts';
import { TestSiteConnectionRequestSchema, z } from '../_shared/schemas.ts';



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
        // Parse and validate request body with Zod
        let body;
        try {
            const bodyText = await req.text();
            const parsed = JSON.parse(bodyText);
            body = TestSiteConnectionRequestSchema.parse(parsed);
        } catch (parseError) {
            console.error('[testSiteConnection] Validation error:', parseError);
            const error = parseError instanceof z.ZodError
                ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
                : `Invalid request: ${parseError.message}`;
            return new Response(
                JSON.stringify({ error }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { site_id, api_key } = body;

        let site;

        // Try to find site by ID or API key
        if (site_id) {
            const { data: sites, error: sitesError } = await supabase.from('sites').select().eq('id', site_id);
            site = sites[0];
        } else if (api_key) {
            const { data: sites, error: sitesError } = await supabase.from('sites').select().eq('api_key');
            site = sites[0];
        }
        
        if (!site) {
            return new Response(
        JSON.stringify({ 
                success: false,
                error: site_id ? 'Site not found' : 'Invalid API key' 
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        console.log('[testSiteConnection] Site found:', site.name, '(ID:', site.id, ')');

        // Test connection by calling connector's ping endpoint
        const connectorEndpoint = `${site.url}/wp-json/wphub/v1/ping`;
        console.log('[testSiteConnection] Testing endpoint:', connectorEndpoint);

        try {
            const wpResponse = await fetch(connectorEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    api_key: site.api_key
                })
            });

            console.log('[testSiteConnection] Response status:', wpResponse.status);

            if (wpResponse.ok) {
                const responseData = await wpResponse.json();
                
                console.log('[testSiteConnection] Response data:', responseData);
                
                // Update site status and WordPress version
                await supabase.from('sites').update({
                    last_connection: new Date().toISOString(),
                    status: 'active',
                    wp_version: responseData.wp_version || site.wp_version
                });

                return new Response(
        JSON.stringify({ 
                    success: true,
                    message: 'Verbinding succesvol!',
                    site_id: site.id,
                    site_name: responseData.site_name || site.name,
                    site_url: site.url,
                    wp_version: responseData.wp_version,
                    plugins_count: responseData.plugins_count || 0
                }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
            } else {
                const errorText = await wpResponse.text();
                console.error('[testSiteConnection] Error response:', errorText);
                
                // Update site status to error
                await supabase.from('sites').update({
                    status: 'error'
                });

                // Try to parse error as JSON
                let errorMessage = 'Verbinding mislukt';
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.code === 'rest_forbidden') {
                        errorMessage = 'API key is niet correct of connector plugin is niet geïnstalleerd';
                    } else {
                        errorMessage = errorJson.message || errorMessage;
                    }
                } catch (e) {
                    errorMessage = errorText || errorMessage;
                }

                return new Response(
        JSON.stringify({ 
                    success: false,
                    error: errorMessage,
                    site_id: site.id,
                    status: wpResponse.status,
                    details: errorText
                }, { status: wpResponse.status }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
            }
        } catch (fetchError) {
            console.error('[testSiteConnection] Fetch error:', fetchError);
            
            // Update site status to error
            await supabase.from('sites').update({
                status: 'error'
            });

            return new Response(
        JSON.stringify({ 
                success: false,
                error: 'Kan geen verbinding maken met WordPress site. Controleer of de connector plugin is geïnstalleerd en geactiveerd.',
                site_id: site.id,
                details: fetchError.message
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

    } catch (error) {
        console.error('[testSiteConnection] Error:', error);
        return new Response(
        JSON.stringify({ 
            error: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});