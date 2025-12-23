import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      message_id, 
      action, 
      transfer_plugins = [],
      non_transfer_action = 'disconnect' // 'disconnect' or 'uninstall'
    } = await req.json();

    if (!message_id || !action) {
      return Response.json({ 
        error: 'Message ID en actie zijn verplicht' 
      }, { status: 400 });
    }

    if (!['accept', 'reject'].includes(action)) {
      return Response.json({ 
        error: 'Ongeldige actie. Gebruik "accept" of "reject"' 
      }, { status: 400 });
    }

    // Get the transfer request message
    const message = await base44.asServiceRole.entities.Message.get(message_id);

    if (!message || message.category !== 'site_transfer_request') {
      return Response.json({ 
        error: 'Overdrachtverzoek niet gevonden' 
      }, { status: 404 });
    }

    if (message.status !== 'open') {
      return Response.json({ 
        error: 'Dit overdrachtverzoek is al afgehandeld' 
      }, { status: 400 });
    }

    // Verify user is the recipient (site owner)
    if (message.recipient_id !== user.id) {
      return Response.json({ 
        error: 'Je bent niet gemachtigd om dit verzoek af te handelen' 
      }, { status: 403 });
    }

    const { site_id, requesting_user_id, requesting_user_name, requesting_user_email } = message.context;

    // Get site and requesting user
    const site = await base44.asServiceRole.entities.Site.get(site_id);
    const requestingUser = await base44.asServiceRole.entities.User.get(requesting_user_id);

    if (!site || !requestingUser) {
      return Response.json({ 
        error: 'Site of aanvragende gebruiker niet gevonden' 
      }, { status: 404 });
    }

    if (action === 'reject') {
      // Reject the transfer
      await base44.asServiceRole.entities.Message.update(message_id, {
        status: 'resolved'
      });

      // Send rejection message to requester
      await base44.asServiceRole.entities.Message.create({
        subject: `Overdrachtverzoek afgewezen: ${site.name}`,
        message: `Je overdrachtverzoek voor site "${site.name}" is afgewezen door ${user.full_name}.`,
        sender_id: user.id,
        sender_email: user.email,
        sender_name: user.full_name,
        recipient_type: 'user',
        recipient_id: requesting_user_id,
        recipient_email: requesting_user_email,
        is_read: false,
        priority: 'normal',
        status: 'open',
        category: 'general'
      });

      // Log activity
      await base44.asServiceRole.entities.ActivityLog.create({
        user_email: user.email,
        action: `Overdrachtverzoek afgewezen voor site: ${site.name}`,
        entity_type: 'site',
        entity_id: site.id,
        details: `Verzoek van ${requesting_user_name} afgewezen`
      });

      return Response.json({
        success: true,
        message: 'Overdrachtverzoek afgewezen'
      });
    }

    // Accept the transfer
    // Get all plugins installed on this site
    const allPlugins = await base44.asServiceRole.entities.Plugin.list();
    const sitePlugins = allPlugins.filter(p => 
      p.installed_on?.some(install => install.site_id === site_id)
    );

    const errors = [];
    const pluginsToTransfer = [];
    const pluginsToDisconnect = [];

    // Validate plugin transfers
    for (const pluginId of transfer_plugins) {
      const plugin = allPlugins.find(p => p.id === pluginId);
      
      if (!plugin) {
        errors.push(`Plugin met ID ${pluginId} niet gevonden`);
        continue;
      }

      // Check if plugin is only installed on this site
      const installCount = plugin.installed_on?.length || 0;
      
      if (installCount > 1) {
        errors.push(`Plugin "${plugin.name}" is geïnstalleerd op meerdere sites en kan niet worden overgedragen`);
        continue;
      }

      pluginsToTransfer.push(plugin);
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return Response.json({ 
        error: 'Validatiefouten gevonden',
        errors 
      }, { status: 400 });
    }

    // Determine which plugins to disconnect (not transfer)
    for (const plugin of sitePlugins) {
      if (!transfer_plugins.includes(plugin.id)) {
        pluginsToDisconnect.push(plugin);
      }
    }

    // Transfer the site
    await base44.asServiceRole.entities.Site.update(site_id, {
      owner_type: 'user',
      owner_id: requesting_user_id
    });

    // Transfer selected plugins
    for (const plugin of pluginsToTransfer) {
      await base44.asServiceRole.entities.Plugin.update(plugin.id, {
        owner_type: 'user',
        owner_id: requesting_user_id
      });
    }

    // Handle plugins that are NOT transferred
    for (const plugin of pluginsToDisconnect) {
      // Remove site from installed_on list
      const updatedInstalledOn = (plugin.installed_on || []).filter(
        install => install.site_id !== site_id
      );
      
      await base44.asServiceRole.entities.Plugin.update(plugin.id, {
        installed_on: updatedInstalledOn
      });

      // If uninstall is requested, call uninstall function
      if (non_transfer_action === 'uninstall') {
        try {
          await base44.asServiceRole.functions.invoke('uninstallPlugin', {
            site_id: site_id,
            plugin_slug: plugin.slug,
            plugin_id: plugin.id
          });
        } catch (error) {
          console.error(`Failed to uninstall plugin ${plugin.name}:`, error);
          // Continue with other plugins even if one fails
        }
      }
      // If 'disconnect', just remove from installed_on (already done above)
    }

    // Update message status
    await base44.asServiceRole.entities.Message.update(message_id, {
      status: 'resolved'
    });

    // Send confirmation to requester
    await base44.asServiceRole.entities.Message.create({
      subject: `Site succesvol overgedragen: ${site.name}`,
      message: `Goed nieuws! ${user.full_name} heeft je overdrachtverzoek geaccepteerd. De site "${site.name}" is nu van jou.${
        pluginsToTransfer.length > 0 
          ? `\n\nDe volgende plugins zijn mee overgedragen: ${pluginsToTransfer.map(p => p.name).join(', ')}`
          : ''
      }`,
      sender_id: user.id,
      sender_email: user.email,
      sender_name: user.full_name,
      recipient_type: 'user',
      recipient_id: requesting_user_id,
      recipient_email: requesting_user_email,
      is_read: false,
      priority: 'high',
      status: 'open',
      category: 'general'
    });

    // Send confirmation to original owner
    await base44.asServiceRole.entities.Message.create({
      subject: `Site overgedragen: ${site.name}`,
      message: `Je hebt de site "${site.name}" succesvol overgedragen aan ${requesting_user_name}.${
        pluginsToTransfer.length > 0 
          ? `\n\nDe volgende plugins zijn mee overgedragen: ${pluginsToTransfer.map(p => p.name).join(', ')}`
          : ''
      }${
        pluginsToDisconnect.length > 0
          ? `\n\nDe volgende plugins zijn ontkoppeld van de site: ${pluginsToDisconnect.map(p => p.name).join(', ')}`
          : ''
      }`,
      sender_id: user.id,
      sender_email: user.email,
      sender_name: user.full_name,
      recipient_type: 'user',
      recipient_id: user.id,
      recipient_email: user.email,
      is_read: false,
      priority: 'normal',
      status: 'open',
      category: 'general'
    });

    // Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      user_email: user.email,
      action: `Site overgedragen: ${site.name}`,
      entity_type: 'site',
      entity_id: site.id,
      details: `Site overgedragen aan ${requesting_user_name}. ${pluginsToTransfer.length} plugin(s) mee overgedragen, ${pluginsToDisconnect.length} plugin(s) ontkoppeld`
    });

    return Response.json({
      success: true,
      message: 'Site succesvol overgedragen',
      transferred_plugins: pluginsToTransfer.length,
      disconnected_plugins: pluginsToDisconnect.length
    });

  } catch (error) {
    console.error('Handle site transfer request error:', error);
    return Response.json({ 
      error: error.message || 'Failed to handle site transfer request' 
    }, { status: 500 });
  }
});