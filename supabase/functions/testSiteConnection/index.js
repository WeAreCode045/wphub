import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { site_id, api_key } = await req.json();

        console.log('[testSiteConnection] Testing connection with:', { 
            has_site_id: !!site_id, 
            has_api_key: !!api_key 
        });

        if (!site_id && !api_key) {
            return Response.json({ error: 'Site ID or API key is required' }, { status: 400 });
        }

        let site;

        // Try to find site by ID or API key
        if (site_id) {
            const sites = await base44.asServiceRole.entities.Site.filter({ id: site_id });
            site = sites[0];
        } else if (api_key) {
            const sites = await base44.asServiceRole.entities.Site.filter({ api_key });
            site = sites[0];
        }
        
        if (!site) {
            return Response.json({ 
                success: false,
                error: site_id ? 'Site not found' : 'Invalid API key' 
            }, { status: 404 });
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
                await base44.asServiceRole.entities.Site.update(site.id, {
                    last_connection: new Date().toISOString(),
                    status: 'active',
                    wp_version: responseData.wp_version || site.wp_version
                });

                return Response.json({ 
                    success: true,
                    message: 'Verbinding succesvol!',
                    site_id: site.id,
                    site_name: responseData.site_name || site.name,
                    site_url: site.url,
                    wp_version: responseData.wp_version,
                    plugins_count: responseData.plugins_count || 0
                });
            } else {
                const errorText = await wpResponse.text();
                console.error('[testSiteConnection] Error response:', errorText);
                
                // Update site status to error
                await base44.asServiceRole.entities.Site.update(site.id, {
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

                return Response.json({ 
                    success: false,
                    error: errorMessage,
                    site_id: site.id,
                    status: wpResponse.status,
                    details: errorText
                }, { status: wpResponse.status });
            }
        } catch (fetchError) {
            console.error('[testSiteConnection] Fetch error:', fetchError);
            
            // Update site status to error
            await base44.asServiceRole.entities.Site.update(site.id, {
                status: 'error'
            });

            return Response.json({ 
                success: false,
                error: 'Kan geen verbinding maken met WordPress site. Controleer of de connector plugin is geïnstalleerd en geactiveerd.',
                site_id: site.id,
                details: fetchError.message
            }, { status: 502 });
        }

    } catch (error) {
        console.error('[testSiteConnection] Error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});