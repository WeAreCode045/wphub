
import { createClientFromRequest } from './base44Shim.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      site_id,
      scheduled_transfer_date = null,
      transfer_plugins = [],
      non_transfer_action = "disconnect"
    } = body;

    if (!site_id) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    const sites = await base44.entities.Site.filter({ id: site_id });
    if (sites.length === 0) {
      return Response.json({ error: 'Site not found' }, { status: 404 });
    }

    const site = sites[0];

    if (!site.transfer_request || site.transfer_request.status !== 'pending') {
      return Response.json({ error: 'No pending transfer request for this site' }, { status: 400 });
    }

    if (site.owner_type !== 'user' || site.owner_id !== user.id) {
      return Response.json({ error: 'Only current site owner can accept transfer' }, { status: 403 });
    }

    const requesterId = site.transfer_request.requested_by_user_id;

    if (scheduled_transfer_date) {
      await base44.entities.Site.update(site_id, {
        transfer_request: {
          ...site.transfer_request,
          status: 'accepted',
          scheduled_transfer_date: scheduled_transfer_date
        }
      });

      const requesterUser = await base44.entities.User.get(requesterId);
      const requesterInbox = requesterUser.mailboxes?.find(m => m.type === 'userinbox');
      const senderOutbox = (await base44.entities.User.get(user.id))?.mailboxes.find(m => m.type === 'useroutbox');

      if (!requesterInbox || !senderOutbox) {
          console.error("Could not find mailboxes for message creation.");
          // Decide how to handle this error: return a 500, or log and proceed.
          // For now, let's log and proceed, as the site transfer itself has been scheduled.
      } else {
        await base44.entities.Message.create({
          subject: 'Site Overdracht Geaccepteerd (Gepland)',
          message: `${user.full_name} heeft je overdrachtverzoek voor site "${site.name}" geaccepteerd.\n\nDe overdracht is gepland voor: ${new Date(scheduled_transfer_date).toLocaleString('nl-NL')}`,
          sender_id: user.id,
          sender_email: user.email,
          sender_name: user.full_name,
          to_mailbox_id: requesterInbox.id,
          from_mailbox_id: senderOutbox.id,
          from_admin_outbox: false,
          category: 'site_transfer_request',
          context: {
            type: 'site',
            id: site_id,
            name: site.name
          }
        });
      }

      return Response.json({
        success: true,
        message: 'Transfer request accepted and scheduled',
        scheduled_date: scheduled_transfer_date
      });
    }

    // Immediate transfer
    const allPlugins = await base44.entities.Plugin.list();
    const sitePlugins = allPlugins.filter(p =>
      p.installed_on?.some(install => install.site_id === site_id)
    );

    for (const plugin of sitePlugins) {
      const shouldTransfer = transfer_plugins.includes(plugin.id);

      if (shouldTransfer) {
        await base44.entities.Plugin.update(plugin.id, {
          owner_id: requesterId,
          owner_type: 'user'
        });
      } else {
        const updatedInstalledOn = (plugin.installed_on || []).filter(install => install.site_id !== site_id);

        if (non_transfer_action === "uninstall") {
          try {
            await base44.functions.invoke('uninstallPlugin', {
              site_id: site_id,
              plugin_slug: plugin.slug,
              plugin_id: plugin.id
            });
          } catch (error) {
            console.error(`Failed to invoke uninstall for plugin ${plugin.name} (${plugin.id}):`, error);
            // Decide whether to rethrow or continue. For now, continue.
          }
        }
        await base44.entities.Plugin.update(plugin.id, {
          installed_on: updatedInstalledOn
        });
      }
    }

    // Remove site from all teams and projects it's shared with
    const allTeams = await base44.entities.Team.list();
    for (const team of allTeams) {
      if (team.shared_sites?.includes(site_id)) { // Changed from shared_with_teams to shared_sites based on common schema patterns
        const updatedShares = team.shared_sites.filter(id => id !== site_id);
        await base44.entities.Team.update(team.id, {
          shared_sites: updatedShares
        });
      }
    }

    const allProjects = await base44.entities.Project.list();
    for (const project of allProjects) {
      if (project.site_id === site_id) {
        await base44.entities.Project.delete(project.id);
      }
    }

    // Remove site from site's shared_with_teams and complete transfer
    await base44.entities.Site.update(site_id, {
      owner_type: 'user',
      owner_id: requesterId,
      shared_sites: [], // Changed from shared_with_teams to shared_sites based on common schema patterns
      transfer_request: null
    });

    const requesterUser = await base44.entities.User.get(requesterId);
    const requesterInbox = requesterUser.mailboxes?.find(m => m.type === 'userinbox');
    const senderOutbox = (await base44.entities.User.get(user.id))?.mailboxes.find(m => m.type === 'useroutbox');

    if (!requesterInbox || !senderOutbox) {
        console.error("Could not find mailboxes for message creation during immediate transfer.");
        // Log and proceed
    } else {
      await base44.entities.Message.create({
        subject: 'Site Overdracht Voltooid',
        message: `${user.full_name} heeft de overdracht van site "${site.name}" voltooid. Je bent nu de eigenaar van deze site.`,
        sender_id: user.id,
        sender_email: user.email,
        sender_name: user.full_name,
        to_mailbox_id: requesterInbox.id,
        from_mailbox_id: senderOutbox.id,
        from_admin_outbox: false,
        category: 'site_transfer_request',
        context: {
          type: 'site',
          id: site_id,
          name: site.name
        }
      });
    }

    await base44.entities.ActivityLog.create({
      user_email: user.email,
      action: `Site overdracht geaccepteerd: ${site.name}`,
      entity_type: 'site',
      entity_id: site_id,
      details: `Overgedragen aan ${requesterUser?.full_name || requesterId}`
    });

    return Response.json({
      success: true,
      message: 'Site transfer completed successfully'
    });

  } catch (error) {
    console.error('Error accepting site transfer:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to accept site transfer'
    }, { status: 500 });
  }
});
