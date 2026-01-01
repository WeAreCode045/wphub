import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_helpers.ts';
import { ExecutePluginActionRequestSchema, z } from '../_shared/schemas.ts';



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
        // Parse and validate request body
        let body;
        try {
          const rawBody = await req.json();
          body = ExecutePluginActionRequestSchema.parse(rawBody);
        } catch (parseError) {
          console.error('[executePluginAction] Validation error:', parseError);
          const error = parseError instanceof z.ZodError
            ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
            : `Invalid request: ${parseError.message}`;
          return new Response(
            JSON.stringify({ error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { site_id, installation_id, action, file_url, plugin_slug } = body;

        console.log('[executePluginAction] === START ===');
        console.log('[executePluginAction] Site ID:', site_id);
        console.log('[executePluginAction] Installation ID:', installation_id);
        console.log('[executePluginAction] Action:', action);
        console.log('[executePluginAction] Plugin Slug:', plugin_slug);
        console.log('[executePluginAction] File URL:', file_url);

        // Get site details
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
        console.log('[executePluginAction] Site:', site.name, site.url);

        // Create Basic Auth header
        const username = site.wp_username || 'admin';
        const authHeader = 'Basic ' + btoa(username + ':' + site.api_key);

        let result;

        switch (action) {
            case 'install':
                result = await installPlugin(site, plugin_slug, file_url, authHeader);
                break;
            case 'activate':
                result = await activatePlugin(site, plugin_slug, authHeader);
                break;
            case 'deactivate':
                result = await deactivatePlugin(site, plugin_slug, authHeader);
                break;
            case 'uninstall':
                result = await uninstallPlugin(site, plugin_slug, authHeader);
                break;
            case 'update':
                // First uninstall, then install new version
                await deactivatePlugin(site, plugin_slug, authHeader);
                await uninstallPlugin(site, plugin_slug, authHeader);
                result = await installPlugin(site, plugin_slug, file_url, authHeader);
                if (result.success) {
                    result = await activatePlugin(site, plugin_slug, authHeader);
                }
                break;
            default:
                return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        // Update installation status in database
        if (result.success) {
            const updateData = {
                last_sync: new Date().toISOString()
            };

            if (action === 'install') {
                updateData.status = 'inactive';
                updateData.installed_version = result.version;
                updateData.is_active = false;
            } else if (action === 'activate') {
                updateData.status = 'active';
                updateData.is_active = true;
            } else if (action === 'deactivate') {
                updateData.status = 'inactive';
                updateData.is_active = false;
            } else if (action === 'uninstall') {
                updateData.status = 'available';
                updateData.installed_version = null;
                updateData.is_active = false;
            } else if (action === 'update') {
                updateData.status = 'active';
                updateData.installed_version = result.version;
                updateData.is_active = true;
            }

            await supabase.from('plugininstallations').update(updateData);
            
            console.log('[executePluginAction] ✅ Database updated');
        } else {
            // Update status to error
            await supabase.from('plugininstallations').update({
                status: 'error',
                last_sync: new Date().toISOString()
            });
            
            console.error('[executePluginAction] ❌ Action failed:', result.error);
        }

        console.log('[executePluginAction] === END ===');

        return new Response(
        JSON.stringify({
            success: result.success,
            message: result.message,
            error: result.error,
            version: result.version
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[executePluginAction] ❌ ERROR:', error.message);
        console.error('[executePluginAction] Stack:', error.stack);
        return new Response(
        JSON.stringify({ 
            success: false,
            error: error.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});

async function installPlugin(site, plugin_slug, file_url, authHeader) {
    console.log('[installPlugin] Installing plugin:', plugin_slug);
    console.log('[installPlugin] File URL:', file_url);
    console.log('[installPlugin] Site URL:', site.url);

    try {
        // Call the connector plugin's installPlugin REST endpoint
        const connectorEndpoint = `${site.url}/wp-json/wphub/v1/installPlugin`;
        console.log('[installPlugin] Calling connector endpoint:', connectorEndpoint);
        
        const response = await fetch(connectorEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
            },
            body: JSON.stringify({
                api_key: site.api_key,
                file_url: file_url,
                plugin_slug: plugin_slug
            })
        });

        const data = await response.json();
        console.log('[installPlugin] Connector response:', JSON.stringify(data));
        
        if (!response.ok) {
            console.error('[installPlugin] Error response:', data);
            return {
                success: false,
                error: data.message || data.code || 'Installation failed',
                message: data.message || 'Installation failed'
            };
        }

        console.log('[installPlugin] ✅ Success');
        
        return {
            success: true,
            message: 'Plugin successfully installed',
            version: data.version
        };
    } catch (error) {
        console.error('[installPlugin] ❌ Error:', error.message);
        return {
            success: false,
            error: error.message,
            message: error.message
        };
    }
}

async function activatePlugin(site, plugin_slug, authHeader) {
    console.log('[activatePlugin] Activating plugin:', plugin_slug);

    try {
        // Need to find the full plugin path first
        const listResponse = await fetch(`${site.url}/wp-json/wp/v2/plugins`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            }
        });

        const plugins = await listResponse.json();
        console.log('[activatePlugin] Found', plugins.length, 'plugins on site');
        
        const plugin = plugins.find(p => p.plugin.split('/')[0] === plugin_slug);
        
        if (!plugin) {
            console.error('[activatePlugin] Plugin not found. Available plugins:', 
                plugins.map(p => p.plugin.split('/')[0]).join(', '));
            return {
                success: false,
                error: 'Plugin not found on site',
                message: 'Plugin not found on site'
            };
        }

        console.log('[activatePlugin] Found plugin:', plugin.plugin);

        // Now activate it
        const wpEndpoint = `${site.url}/wp-json/wp/v2/plugins/${encodeURIComponent(plugin.plugin)}`;
        
        const response = await fetch(wpEndpoint, {
            method: 'PUT',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                status: 'active'
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('[activatePlugin] Error:', data);
            return {
                success: false,
                error: data.message || 'Activation failed',
                message: data.message || 'Activation failed'
            };
        }

        console.log('[activatePlugin] ✅ Success');
        
        return {
            success: true,
            message: 'Plugin successfully activated',
            version: data.version
        };
    } catch (error) {
        console.error('[activatePlugin] ❌ Error:', error.message);
        return {
            success: false,
            error: error.message,
            message: error.message
        };
    }
}

async function deactivatePlugin(site, plugin_slug, authHeader) {
    console.log('[deactivatePlugin] Deactivating plugin:', plugin_slug);

    try {
        // Need to find the full plugin path first
        const listResponse = await fetch(`${site.url}/wp-json/wp/v2/plugins`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            }
        });

        const plugins = await listResponse.json();
        const plugin = plugins.find(p => p.plugin.split('/')[0] === plugin_slug);
        
        if (!plugin) {
            return {
                success: false,
                error: 'Plugin not found on site',
                message: 'Plugin not found on site'
            };
        }

        // Now deactivate it
        const wpEndpoint = `${site.url}/wp-json/wp/v2/plugins/${encodeURIComponent(plugin.plugin)}`;
        
        const response = await fetch(wpEndpoint, {
            method: 'PUT',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                status: 'inactive'
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('[deactivatePlugin] Error:', data);
            return {
                success: false,
                error: data.message || 'Deactivation failed',
                message: data.message || 'Deactivation failed'
            };
        }

        console.log('[deactivatePlugin] ✅ Success');
        
        return {
            success: true,
            message: 'Plugin successfully deactivated',
            version: data.version
        };
    } catch (error) {
        console.error('[deactivatePlugin] ❌ Error:', error.message);
        return {
            success: false,
            error: error.message,
            message: error.message
        };
    }
}

async function uninstallPlugin(site, plugin_slug, authHeader) {
    console.log('[uninstallPlugin] Uninstalling plugin:', plugin_slug);

    try {
        // Need to find the full plugin path first
        const listResponse = await fetch(`${site.url}/wp-json/wp/v2/plugins`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            }
        });

        const plugins = await listResponse.json();
        const plugin = plugins.find(p => p.plugin.split('/')[0] === plugin_slug);
        
        if (!plugin) {
            return {
                success: true,  // Already uninstalled
                message: 'Plugin already uninstalled'
            };
        }

        // First deactivate if active
        if (plugin.status === 'active') {
            await deactivatePlugin(site, plugin_slug, authHeader);
        }

        // Now delete it
        const wpEndpoint = `${site.url}/wp-json/wp/v2/plugins/${encodeURIComponent(plugin.plugin)}`;
        
        const response = await fetch(wpEndpoint, {
            method: 'DELETE',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('[uninstallPlugin] Error:', data);
            return {
                success: false,
                error: data.message || 'Uninstall failed',
                message: data.message || 'Uninstall failed'
            };
        }

        console.log('[uninstallPlugin] ✅ Success');
        
        return {
            success: true,
            message: 'Plugin successfully uninstalled'
        };
    } catch (error) {
        console.error('[uninstallPlugin] ❌ Error:', error.message);
        return {
            success: false,
            error: error.message,
            message: error.message
        };
    }
}
