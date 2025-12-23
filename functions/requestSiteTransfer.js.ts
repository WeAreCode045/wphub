import { createClientFromRequest } from './base44Shim.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { site_id, site_url } = await req.json();

    if (!site_id && !site_url) {
      return Response.json({ 
        error: 'Site ID of URL is verplicht' 
      }, { status: 400 });
    }

    // Get the site
    let site;
    if (site_id) {
      site = await base44.asServiceRole.entities.Site.get(site_id);
    } else {
      const sites = await base44.asServiceRole.entities.Site.filter({ url: site_url });
      site = sites[0];
    }

    if (!site) {
      return Response.json({ 
        error: 'Site niet gevonden' 
      }, { status: 404 });
    }

    // Check if user is not already the owner
    if (site.owner_type === 'user' && site.owner_id === user.id) {
      return Response.json({ 
        error: 'Je bent al de eigenaar van deze site' 
      }, { status: 400 });
    }

    // Check if there's already a pending transfer request on the site itself
    if (site.transfer_request && site.transfer_request.status === 'pending') {
      return Response.json({ 
        error: 'Er is al een openstaand overdrachtverzoek voor deze site' 
      }, { status: 400 });
    }

    // Get the owner
    let ownerUser = null;
    if (site.owner_type === 'user') {
      ownerUser = await base44.asServiceRole.entities.User.get(site.owner_id);
    } else {
      // Team-owned site
      const team = await base44.asServiceRole.entities.Team.get(site.owner_id);
      ownerUser = await base44.asServiceRole.entities.User.get(team.owner_id);
    }

    if (!ownerUser) {
      return Response.json({ 
        error: 'Eigenaar van de site niet gevonden' 
      }, { status: 404 });
    }

    // Update site with transfer request
    await base44.asServiceRole.entities.Site.update(site.id, {
      transfer_request: {
        requested_by_user_id: user.id,
        requested_by_user_email: user.email,
        requested_by_user_name: user.full_name,
        request_date: new Date().toISOString(),
        status: 'pending'
      }
    });

    // Create notification message
    const message = await base44.asServiceRole.entities.Message.create({
      subject: `Overdrachtverzoek voor site: ${site.name}`,
      message: `${user.full_name} (${user.email}) verzoekt om overdracht van de site "${site.name}" (${site.url}). Ga naar de site detailpagina om dit verzoek te accepteren of weigeren.`,
      sender_id: user.id,
      sender_email: user.email,
      sender_name: user.full_name,
      recipient_type: 'user',
      recipient_id: ownerUser.id,
      recipient_email: ownerUser.email,
      is_read: false,
      priority: 'high',
      status: 'open',
      category: 'site_transfer_request',
      context: {
        type: 'site',
        id: site.id,
        name: site.name
      }
    });

    // Send notification to owner
    await base44.asServiceRole.entities.Notification.create({
      recipient_id: ownerUser.id,
      recipient_email: ownerUser.email,
      title: `Overdrachtverzoek voor site: ${site.name}`,
      message: `${user.full_name} verzoekt om overdracht van je site "${site.name}". Bekijk de site detailpagina voor meer informatie.`,
      type: 'warning',
      context: {
        type: 'site',
        id: site.id,
        name: site.name
      }
    });

    // Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      user_email: user.email,
      action: `Overdrachtverzoek ingediend voor site: ${site.name}`,
      entity_type: 'site',
      entity_id: site.id,
      details: `Verzoek gericht aan ${ownerUser.full_name}`
    });

    return Response.json({
      success: true,
      message: 'Overdrachtverzoek succesvol verzonden',
      message_id: message.id
    });

  } catch (error) {
    console.error('Request site transfer error:', error);
    return Response.json({ 
      error: error.message || 'Failed to request site transfer' 
    }, { status: 500 });
  }
});