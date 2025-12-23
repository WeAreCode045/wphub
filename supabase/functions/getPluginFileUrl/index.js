import { createClientFromRequest } from './base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { api_key, plugin_id, version_id } = await req.json();

        if (!api_key) {
            return Response.json({ error: 'API key is required' }, { status: 401 });
        }

        // Verify API key
        const sites = await base44.asServiceRole.entities.Site.filter({ api_key });
        
        if (sites.length === 0) {
            return Response.json({ error: 'Invalid API key' }, { status: 401 });
        }

        // Get the plugin version
        const versions = await base44.asServiceRole.entities.PluginVersion.filter({ 
            id: version_id,
            plugin_id: plugin_id
        });

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