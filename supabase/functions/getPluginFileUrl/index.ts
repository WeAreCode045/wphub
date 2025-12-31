
Deno.serve(async (req) => {
    try {
        const { api_key, plugin_id, version_id } = await req.json();

        if (!api_key) {
            return Response.json({ error: 'API key is required' }, { status: 401 });
        }

        // Verify API key
        const { data: sites, error: sitesError } = await supabase.from('sites').select().eq('api_key');
        
                if (sitesError || !sites) {
            return Response.json({ error: 'Database error' }, { status: 500 });
        }
        if (sites.length === 0) {
            return Response.json({ error: 'Invalid API key' }, { status: 401 });
        }

        // Get the plugin version
        const { data: versions, error: versionsError } = await supabase
            .from('pluginversions')
            .select()
            .eq('id', version_id)
            .eq('plugin_id', plugin_id);

                if (versionsError || !versions) {
            return Response.json({ error: 'Database error' }, { status: 500 });
        }
        if (versions.length === 0) {
            return Response.json({ error: 'Plugin version not found' }, { status: 404 });
        }

        const version = versions[0];

        return Response.json({ 
            success: true,
            file_url: version.file_url,
            version: version.version
        });

    } catch (error) {
        console.error('Error in getPluginFileUrl:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});