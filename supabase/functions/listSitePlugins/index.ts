import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_helpers.ts';
import { ListSitePluginsRequestSchema, z } from '../_shared/schemas.ts';

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
        );
        
        const { data: { user } } = await supabase.auth.getUser();

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
            body = ListSitePluginsRequestSchema.parse(parsed);
        } catch (parseError) {
            console.error('[listSitePlugins] Validation error:', parseError);
            const error = parseError instanceof z.ZodError
                ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
                : `Invalid request: ${parseError.message}`;
            return new Response(
                JSON.stringify({ error }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { site_id } = body;

        console.log('[listSitePlugins] === START ===');
        console.log('[listSitePlugins] Site ID:', site_id);

        const { data: sites, error: sitesError } = await supabase.from('sites').select().eq('id', site_id);
        
        if (sitesError || !sites) {
            return new Response(
                JSON.stringify({ error: 'Database error' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
        if (sites.length === 0) {
            console.log('[listSitePlugins] Site not found');
            return new Response(
                JSON.stringify({ error: 'Site not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const site = sites[0];
        console.log('[listSitePlugins] Site:', site.name, site.url);

        const wpEndpoint = `${site.url}/wp-json/wphub/v1/listPlugins`;
        console.log('[listSitePlugins] Calling WordPress connector:', wpEndpoint);

        const wpResponse = await fetch(wpEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: site.api_key }) });

        if (!wpResponse.ok) {
            const errorText = await wpResponse.text();
            console.error('[listSitePlugins] WordPress API error:', wpResponse.status, errorText);
            return new Response(
                JSON.stringify({ error: 'Failed to connect to WordPress site', details: errorText, status: wpResponse.status }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const result = await wpResponse.json();
        console.log('[listSitePlugins] WordPress returned', result.plugins?.length || 0, 'plugins');

        if (!result.success || !result.plugins) {
            return new Response(
                JSON.stringify({ error: 'Failed to get plugins from WordPress', details: result.message || 'Unknown error' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        await supabase.from('sites').update({ connection_status: 'active', connection_checked_at: new Date().toISOString() });

        const { data: allPlatformPlugins, error: allPlatformPluginsError } = await supabase.from('plugins').select();
        console.log('[listSitePlugins] Found', allPlatformPlugins.length, 'platform plugins');

        const wpPluginSlugs = result.plugins.map(p => p.slug);
        
        for (const platformPlugin of allPlatformPlugins) {
            const currentInstalledOn = platformPlugin.installed_on || [];
            let needsUpdate = false;
            let updatedInstalledOn = [...currentInstalledOn];

            const wpPlugin = result.plugins.find(p => p.slug === platformPlugin.slug);

            if (wpPlugin) {
                const existingEntry = updatedInstalledOn.find(entry => entry.site_id === site_id);
                
                if (!existingEntry) {
                    console.log('[listSitePlugins] Adding', platformPlugin.slug, 'to installed_on for site', site_id);
                    updatedInstalledOn.push({ site_id: site_id, version: wpPlugin.version });
                    needsUpdate = true;
                } else if (existingEntry.version !== wpPlugin.version) {
                    console.log('[listSitePlugins] Updating version for', platformPlugin.slug, 'on site', site_id, 'from', existingEntry.version, 'to', wpPlugin.version);
                    existingEntry.version = wpPlugin.version;
                    needsUpdate = true;
                }
            } else {
                const entryIndex = updatedInstalledOn.findIndex(entry => entry.site_id === site_id);
                if (entryIndex !== -1) {
                    console.log('[listSitePlugins] Removing', platformPlugin.slug, 'from installed_on for site', site_id);
                    updatedInstalledOn.splice(entryIndex, 1);
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                await supabase.from('plugins').update({ installed_on: updatedInstalledOn });
                console.log('[listSitePlugins] ✅ Updated installed_on for plugin:', platformPlugin.slug);
            }
        }

        console.log('[listSitePlugins] Reconciliation complete');
        console.log('[listSitePlugins] === END ===');

        return new Response(
            JSON.stringify({ success: true, plugins: result.plugins, total: result.plugins.length }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[listSitePlugins] ❌ ERROR:', error.message);
        console.error('[listSitePlugins] Stack:', error.stack);
        return new Response(
            JSON.stringify({ error: error.message, stack: error.stack }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});