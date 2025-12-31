import { createClient } from 'jsr:@supabase/supabase-js@2'


Deno.serve(async (req) => {
    try {
        const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )
      
      const { data: { user } } = await supabase.auth.getUser()

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        console.log('[syncAllSitesPlugins] === START ===');
        console.log('[syncAllSitesPlugins] Started by:', user.email);

        const { data: allSites, error: allSitesError } = await supabase.from('sites').select();
        console.log('[syncAllSitesPlugins] Found', allSites.length, 'sites');

        const results = { total_sites: allSites.length, successful_sites: 0, failed_sites: 0, total_plugins_synced: 0, new_plugins_created: 0, site_results: [] };

        for (const site of allSites) {
            console.log(`[syncAllSitesPlugins] Processing site: ${site.name} (${site.id})`);

            const siteResult = { site_id: site.id, site_name: site.name, site_url: site.url, status: 'pending', plugins_found: 0, plugins_synced: 0, new_plugins: 0, error: null };

            try {
                const wpEndpoint = `${site.url}/wp-json/wphub/v1/getInstalledPlugins`;
                console.log(`[syncAllSitesPlugins] Calling: ${wpEndpoint}`);

                const wpResponse = await fetch(wpEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: site.api_key }) });

                if (!wpResponse.ok) throw new Error(`WordPress API error: ${wpResponse.status}`);

                const wpData = await wpResponse.json();

                if (!wpData.success || !wpData.plugins) throw new Error('Invalid response from WordPress');

                console.log(`[syncAllSitesPlugins] Found ${wpData.plugins.length} plugins on ${site.name}`);
                siteResult.plugins_found = wpData.plugins.length;

                const { data: allPlatformPlugins, error: allPlatformPluginsError } = await supabase.from('plugins').select();

                const sitePluginsArray = [];
                
                for (const wpPlugin of wpData.plugins) {
                    let platformPlugin = allPlatformPlugins.find(p => p.slug === wpPlugin.slug);

                    if (!platformPlugin) {
                        console.log(`[syncAllSitesPlugins] Creating new external plugin: ${wpPlugin.name}`);
                        platformPlugin = await supabase.from('plugins').insert({ name: wpPlugin.name, slug: wpPlugin.slug, description: wpPlugin.description || '', owner_type: site.owner_type, owner_id: site.owner_id, latest_version: wpPlugin.version, is_external: true, manage_from_hub: true, versions: [], shared_with_teams: site.shared_with_teams || [] });
                        siteResult.new_plugins++;
                        results.new_plugins_created++;
                    }

                    sitePluginsArray.push({ plugin_id: platformPlugin.id, version: wpPlugin.version, is_installed: 1, is_activated: wpPlugin.is_active ? 1 : 0 });
                    siteResult.plugins_synced++;
                }

                await supabase.from('sites').update({ plugins: sitePluginsArray, last_connection: new Date().toISOString(), status: 'active' });

                siteResult.status = 'success';
                results.successful_sites++;
                results.total_plugins_synced += siteResult.plugins_synced;

                console.log(`[syncAllSitesPlugins] ✅ Successfully synced ${site.name}`);

            } catch (error) {
                console.error(`[syncAllSitesPlugins] ❌ Error syncing ${site.name}:`, error.message);
                siteResult.status = 'failed';
                siteResult.error = error.message;
                results.failed_sites++;
            }

            results.site_results.push(siteResult);
        }

        await supabase.from('activitylogs').insert({ user_email: user.email, action: 'Platform-wide plugin sync uitgevoerd', entity_type: 'site', details: `${results.successful_sites} sites succesvol, ${results.failed_sites} gefaald, ${results.new_plugins_created} nieuwe plugins` });

        console.log('[syncAllSitesPlugins] === END ===');

        return Response.json({ success: true, message: `Sync voltooid: ${results.successful_sites}/${results.total_sites} sites succesvol`, results: results });

    } catch (error) {
        console.error('[syncAllSitesPlugins] ❌ FATAL ERROR:', error.message);
        console.error('[syncAllSitesPlugins] Stack:', error.stack);
        return Response.json({ success: false, error: error.message, stack: error.stack }, { status: 500 });
    }
});