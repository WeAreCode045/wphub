import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { site_id } = await req.json();

    if (!site_id) {
      return Response.json({ 
        error: 'Site ID is verplicht' 
      }, { status: 400 });
    }

    // Get the site
    const site = await base44.asServiceRole.entities.Site.get(site_id);

    if (!site) {
      return Response.json({ 
        error: 'Site niet gevonden' 
      }, { status: 404 });
    }

    // Verify user is the site owner
    if (site.owner_type !== 'user' || site.owner_id !== user.id) {
      return Response.json({ 
        error: 'Je bent niet gemachtigd om dit verzoek af te handelen' 
      }, { status: 403 });
    }

    // Check if there's a pending transfer request
    if (!site.transfer_request || site.transfer_request.status !== 'pending') {
      return Response.json({ 
        error: 'Geen openstaand overdrachtverzoek gevonden' 
      }, { status: 400 });
    }

    const { requested_by_user_id, requested_by_user_email, requested_by_user_name } = site.transfer_request;

    // Update site to remove transfer request
    await base44.asServiceRole.entities.Site.update(site_id, {
      transfer_request: {
        ...site.transfer_request,
        status: 'declined'
      }
    });

    // Send rejection message to requester
    await base44.asServiceRole.entities.Message.create({
      subject: `Overdrachtverzoek afgewezen: ${site.name}`,
      message: `Je overdrachtverzoek voor site "${site.name}" is afgewezen door ${user.full_name}.`,
      sender_id: user.id,
      sender_email: user.email,
      sender_name: user.full_name,
      recipient_type: 'user',
      recipient_id: requested_by_user_id,
      recipient_email: requested_by_user_email,
      is_read: false,
      priority: 'normal',
      status: 'open',
      category: 'general'
    });

    // Send notification to requester
    await base44.asServiceRole.entities.Notification.create({
      recipient_id: requested_by_user_id,
      recipient_email: requested_by_user_email,
      title: `Overdrachtverzoek afgewezen: ${site.name}`,
      message: `Je overdrachtverzoek voor "${site.name}" is afgewezen.`,
      type: 'warning'
    });

    // Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      user_email: user.email,
      action: `Overdrachtverzoek afgewezen voor site: ${site.name}`,
      entity_type: 'site',
      entity_id: site.id,
      details: `Verzoek van ${requested_by_user_name} afgewezen`
    });

    return Response.json({
      success: true,
      message: 'Overdrachtverzoek afgewezen'
    });

  } catch (error) {
    console.error('Decline site transfer error:', error);
    return Response.json({ 
      error: error.message || 'Failed to decline site transfer' 
    }, { status: 500 });
  }
});