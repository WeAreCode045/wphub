import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_helpers.ts';
import { ReportCommandStatusRequestSchema, z } from '../_shared/types.ts';



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
            body = ReportCommandStatusRequestSchema.parse(parsed);
        } catch (parseError) {
            console.error('[reportCommandStatus] Validation error:', parseError);
            const error = parseError instanceof z.ZodError
                ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
                : `Invalid request: ${parseError.message}`;
            return new Response(
                JSON.stringify({ error }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { api_key, installation_id, status, error_message, version } = body;

        console.log(`[reportCommandStatus] Received: installation_id=${installation_id}, status=${status}, version=${version}`);
        console.log(`[reportCommandStatus] Error message:`, error_message);

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
            console.log(`[reportCommandStatus] Invalid API key`);
            return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const site = sites[0];
        console.log(`[reportCommandStatus] Site: ${site.name}`);

        // Build update data based on status
        const updateData = {
            last_sync: new Date().toISOString()
        };

        // Map WordPress status to our status enum
        switch (status) {
            case 'installed':
                updateData.status = 'installed';
                updateData.installed_version = version;
                updateData.is_active = false;
                console.log(`[reportCommandStatus] Plugin installed successfully`);
                break;
                
            case 'active':
                updateData.status = 'active';
                updateData.installed_version = version;
                updateData.is_active = true;
                console.log(`[reportCommandStatus] Plugin activated successfully`);
                break;
                
            case 'inactive':
                updateData.status = 'inactive';
                updateData.is_active = false;
                // Keep installed_version as is
                console.log(`[reportCommandStatus] Plugin deactivated successfully`);
                break;
                
            case 'uninstalled':
                updateData.status = 'available';
                updateData.installed_version = null;
                updateData.is_active = false;
                updateData.is_enabled = true;
                console.log(`[reportCommandStatus] Plugin uninstalled, back to available`);
                break;
                
            case 'error':
                updateData.status = 'error';
                updateData.installed_version = null;
                updateData.is_active = false;
                console.log(`[reportCommandStatus] Error status - clearing installation`);
                break;
                
            default:
                updateData.status = status;
                console.log(`[reportCommandStatus] Unknown status: ${status}`);
        }

        console.log(`[reportCommandStatus] Updating installation ${installation_id} with:`, updateData);

        await supabase.from('plugininstallations').update(updateData);

        // Log activity
        const { data: installation, error: installationError } = await supabase.from('plugininstallations').select().eq('id', installation_id);
        if (installation.length > 0) {
            const { data: plugins, error: pluginsError } = await supabase.from('plugins').select();
            const plugin = plugins.find(p => p.id === installation[0].plugin_id);
            
            if (plugin) {
                let action;
                switch (status) {
                    case 'installed':
                        action = `Plugin geïnstalleerd op ${site.name}: ${plugin.name}`;
                        break;
                    case 'active':
                        action = `Plugin geactiveerd op ${site.name}: ${plugin.name}`;
                        break;
                    case 'inactive':
                        action = `Plugin gedeactiveerd op ${site.name}: ${plugin.name}`;
                        break;
                    case 'uninstalled':
                        action = `Plugin gedeïnstalleerd op ${site.name}: ${plugin.name}`;
                        break;
                    case 'error':
                        action = `Plugin actie MISLUKT op ${site.name}: ${plugin.name}`;
                        break;
                    default:
                        action = `Plugin ${status} op ${site.name}: ${plugin.name}`;
                }
                
                await supabase.from('activitylogs').insert({
                    user_email: 'system',
                    action: action,
                    entity_type: 'installation',
                    entity_id: installation_id,
                    details: error_message || `Status: ${status}, Version: ${version || 'N/A'}`
                });
            }
        }

        console.log(`[reportCommandStatus] Successfully updated installation ${installation_id}`);

        return new Response(
        JSON.stringify({ 
            success: true,
            message: 'Status updated successfully'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[reportCommandStatus] Error:', error);
        return new Response(
        JSON.stringify({ 
            error: error.message,
            stack: error.stack
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});