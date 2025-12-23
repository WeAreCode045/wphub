import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { site_id } = await req.json();

        console.log('[updateConnectorPlugin] === START ===');
        console.log('[updateConnectorPlugin] Site ID:', site_id);

        if (!site_id) {
            return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const sites = await base44.entities.Site.filter({ id: site_id });
        if (sites.length === 0) {
            return Response.json({ error: 'Site not found' }, { status: 404 });
        }
        const site = sites[0];

        const settings = await base44.asServiceRole.entities.SiteSettings.list();
        const activeVersion = settings.find(s => s.setting_key === 'active_connector_version')?.setting_value;

        if (!activeVersion) {
            return Response.json({ error: 'No active connector version found' }, { status: 404 });
        }

        const connectors = await base44.asServiceRole.entities.Connector.list();
        const activeConnector = connectors.find(c => c.version === activeVersion);

        if (!activeConnector) {
            return Response.json({ error: 'Active connector not found' }, { status: 404 });
        }

        console.log('[updateConnectorPlugin] Active connector version:', activeVersion);
        console.log('[updateConnectorPlugin] File URL:', activeConnector.file_url);

        const connectorUrl = `${site.url}/wp-json/wphub/v1/updateSelf`;
        console.log('[updateConnectorPlugin] Calling connector:', connectorUrl);

        const response = await fetch(connectorUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: site.api_key, file_url: activeConnector.file_url, new_version: activeVersion }) });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[updateConnectorPlugin] Connector error:', errorText);
            return Response.json({ success: false, error: `Connector error: ${response.status} - ${errorText}` }, { status: 500 });
        }

        const result = await response.json();
        console.log('[updateConnectorPlugin] Connector response:', result);

        if (result.success) {
            await base44.entities.ActivityLog.create({ user_email: user.email, action: `Connector plugin geüpdatet op site ${site.name}`, entity_type: "site", details: `Nieuwe versie: ${activeVersion}` });
            console.log('[updateConnectorPlugin] ✅ Success');
        }

        console.log('[updateConnectorPlugin] === END ===');

        return Response.json({ success: result.success, message: result.message, new_version: activeVersion });

    } catch (error) {
        console.error('[updateConnectorPlugin] ❌ ERROR:', error.message);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});