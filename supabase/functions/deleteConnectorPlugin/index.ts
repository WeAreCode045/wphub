import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

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
        const connectors = await base44.entities.Connector.filter({ id: connector_id });
        
        if (connectors.length === 0) {
            return Response.json({ error: 'Connector not found' }, { status: 404 });
        }

        const connector = connectors[0];

        // Delete from database
        await base44.entities.Connector.delete(connector_id);

        console.log('[deleteConnectorPlugin] Deleted from database');

        // Log activity
        await base44.entities.ActivityLog.create({
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