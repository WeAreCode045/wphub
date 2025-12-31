import { createClient } from 'jsr:@supabase/supabase-js@2'


Deno.serve(async (req) => {
    try {
        const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )
      
      const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { site_id, plugin_slug, plugin_id, download_url } = await req.json();

        console.log('[updatePlugin] === START ===');
        console.log('[updatePlugin] Site ID:', site_id);
        console.log('[updatePlugin] Plugin slug:', plugin_slug);
        console.log('[updatePlugin] Plugin ID:', plugin_id);
        console.log('[updatePlugin] Download URL:', download_url);

        if (!site_id || !plugin_slug) {
            return Response.json({ error: 'Site ID and plugin slug are required' }, { status: 400 });
        }

        // Get site details
        const { data: sites, error: sitesError } = await supabase.from('sites').select().eq('id', site_id);
                if (sitesError || !sites) {
            return Response.json({ error: 'Database error' }, { status: 500 });
        }
        if (sites.length === 0) {
            return Response.json({ error: 'Site not found' }, { status: 404 });
        }
        const site = sites[0];

        console.log('[updatePlugin] Site:', site.name);

        // Call connector endpoint
        const connectorUrl = `${site.url}/wp-json/wphub/v1/updatePlugin`;
        console.log('[updatePlugin] Calling connector:', connectorUrl);

        const payload = {
            api_key: site.api_key,
            plugin_slug: plugin_slug
        };

        if (download_url) {
            payload.file_url = download_url;
        }

        const response = await fetch(connectorUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[updatePlugin] Connector error:', errorText);
            return Response.json({ success: false, error: `Connector error: ${response.status} - ${errorText}` }, { status: 500 });
        }

        const result = await response.json();
        console.log('[updatePlugin] Connector response:', result);

        if (result.success && plugin_id && result.version) {
            const { data: plugins, error: pluginsError } = await supabase.from('plugins').select().eq('id', plugin_id);
            if (plugins.length > 0) {
                const plugin = plugins[0];
                const currentInstalledOn = plugin.installed_on || [];
                const existingEntry = currentInstalledOn.find(entry => entry.site_id === site_id);
                
                if (existingEntry) {
                    existingEntry.version = result.version;
                    await supabase.from('plugins').update({ installed_on: currentInstalledOn });
                    console.log('[updatePlugin] ✅ Updated version in installed_on to:', result.version);
                }
            }
        }

        console.log('[updatePlugin] === END ===');

        return Response.json({ success: result.success, message: result.message, version: result.version });

    } catch (error) {
        console.error('[updatePlugin] ❌ ERROR:', error.message);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});