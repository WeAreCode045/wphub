import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';


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
      )
      
      const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        // Check if user is admin
        if (user.role !== 'admin') {
            return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const { connector_id } = await req.json();

        if (!connector_id) {
            return new Response(
        JSON.stringify({ error: 'Connector ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        console.log('[deleteConnectorPlugin] Deleting connector:', connector_id);

        // Get connector
        const { data: connectors, error: connectorsError } = await supabase.from('connectors').select().eq('id', connector_id);
        
                if (connectorsError || !connectors) {
            return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        if (connectors.length === 0) {
            return new Response(
        JSON.stringify({ error: 'Connector not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const connector = connectors[0];

        // Delete from database
        await supabase.from('connectors').delete(connector_id);

        console.log('[deleteConnectorPlugin] Deleted from database');

        // Log activity
        await supabase.from('activitylogs').insert({
            user_email: user.email,
            action: `Connector Plugin v${connector.version} verwijderd`,
            entity_type: 'connector',
            details: connector.file_url
        });

        return new Response(
        JSON.stringify({ 
            success: true,
            message: `Connector Plugin v${connector.version} succesvol verwijderd`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[deleteConnectorPlugin] ❌ ERROR:', error.message);
        return new Response(
        JSON.stringify({ 
            error: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});