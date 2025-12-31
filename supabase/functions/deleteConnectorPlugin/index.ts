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

        // Check if user is admin
        if (user.role !== 'admin') {
            return Response.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }

        const { connector_id } = await req.json();

        if (!connector_id) {
            return Response.json({ error: 'Connector ID is required' }, { status: 400 });
        }

        console.log('[deleteConnectorPlugin] Deleting connector:', connector_id);

        // Get connector
        const { data: connectors, error: connectorsError } = await supabase.from('connectors').select().eq('id', connector_id);
        
                if (connectorsError || !connectors) {
            return Response.json({ error: 'Database error' }, { status: 500 });
        }
        if (connectors.length === 0) {
            return Response.json({ error: 'Connector not found' }, { status: 404 });
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

        return Response.json({ 
            success: true,
            message: `Connector Plugin v${connector.version} succesvol verwijderd`
        });

    } catch (error) {
        console.error('[deleteConnectorPlugin] ❌ ERROR:', error.message);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});