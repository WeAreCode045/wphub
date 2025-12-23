import { authMeWithToken, extractBearerFromReq, uploadToStorage, jsonResponse } from '../_helpers.ts';

// Converts the acceptSiteTransfer function to Supabase Edge Function
Deno.serve(async (req: Request) => {
  try {
    const token = extractBearerFromReq(req);
    const user = await authMeWithToken(token);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const { site_id, scheduled_transfer_date = null, transfer_plugins = [], non_transfer_action = 'disconnect' } = body;
    if (!site_id) return jsonResponse({ error: 'Site ID is required' }, 400);

    const supa = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY');

    const siteRes = await fetch(`${supa}/rest/v1/sites?id=eq.${encodeURIComponent(String(site_id))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!siteRes.ok) return jsonResponse({ error: 'Failed to load site' }, 500);
    const sites = await siteRes.json();
    if (!Array.isArray(sites) || sites.length === 0) return jsonResponse({ error: 'Site not found' }, 404);
    const site = sites[0];

    if (!site.transfer_request || site.transfer_request.status !== 'pending') return jsonResponse({ error: 'No pending transfer request for this site' }, 400);
    if (site.owner_type !== 'user' || site.owner_id !== user.id) return jsonResponse({ error: 'Only current site owner can accept transfer' }, 403);

    const requesterId = site.transfer_request.requested_by_user_id;

    if (scheduled_transfer_date) {
      // PATCH site.transfer_request.status
      await fetch(`${supa}/rest/v1/sites?id=eq.${encodeURIComponent(String(site_id))}`, {
        method: 'PATCH', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ transfer_request: { ...site.transfer_request, status: 'accepted', scheduled_transfer_date } })
      });

      // create message if mailboxes exist
      const requesterUserRes = await fetch(`${supa}/rest/v1/users?id=eq.${encodeURIComponent(String(requesterId))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      const requesterUserArr = await requesterUserRes.json();
      const requesterUser = requesterUserArr?.[0];

      const senderUserRes = await fetch(`${supa}/rest/v1/users?id=eq.${encodeURIComponent(String(user.id))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      const senderUserArr = await senderUserRes.json();
      const senderUser = senderUserArr?.[0];

      const requesterInbox = requesterUser?.mailboxes?.find((m:any)=>m.type==='userinbox');
      const senderOutbox = senderUser?.mailboxes?.find((m:any)=>m.type==='useroutbox');
      if (requesterInbox && senderOutbox) {
        await fetch(`${supa}/rest/v1/messages`, { method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: 'Site Overdracht Geaccepteerd (Gepland)', message: `${user.full_name} heeft je overdrachtverzoek voor site "${site.name}" geaccepteerd.\n\nDe overdracht is gepland voor: ${new Date(scheduled_transfer_date).toLocaleString('nl-NL')}`, sender_id: user.id, sender_email: user.email, sender_name: user.full_name, to_mailbox_id: requesterInbox.id, from_mailbox_id: senderOutbox.id, from_admin_outbox: false, category: 'site_transfer_request', context: { type: 'site', id: site_id, name: site.name } }) });
      }

      return jsonResponse({ success: true, message: 'Transfer request accepted and scheduled', scheduled_date: scheduled_transfer_date });
    }

    // Immediate transfer
    const pluginsRes = await fetch(`${supa}/rest/v1/plugins`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const allPlugins = await pluginsRes.json();
    const sitePlugins = (allPlugins||[]).filter((p:any)=>p.installed_on?.some((i:any)=>i.site_id===site_id));

    for (const plugin of sitePlugins) {
      const shouldTransfer = transfer_plugins.includes(plugin.id);
      if (shouldTransfer) {
        await fetch(`${supa}/rest/v1/plugins?id=eq.${encodeURIComponent(String(plugin.id))}`, { method: 'PATCH', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ owner_id: requesterId, owner_type: 'user' }) });
      } else {
        const updatedInstalledOn = (plugin.installed_on || []).filter((install:any)=>install.site_id !== site_id);
        if (non_transfer_action === 'uninstall') {
          // invoke uninstall via platform function endpoint
          try { await fetch(`/functions/uninstallPlugin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site_id, plugin_slug: plugin.slug, plugin_id: plugin.id }) }); } catch(e){ console.error('invoke uninstall failed', e); }
        }
        await fetch(`${supa}/rest/v1/plugins?id=eq.${encodeURIComponent(String(plugin.id))}`, { method: 'PATCH', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ installed_on: updatedInstalledOn }) });
      }
    }

    // Remove from teams
    const teamsRes = await fetch(`${supa}/rest/v1/teams`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const allTeams = await teamsRes.json();
    for (const team of (allTeams||[])) {
      if (team.shared_sites?.includes(site_id)) {
        const updatedShares = team.shared_sites.filter((id:any)=>id !== site_id);
        await fetch(`${supa}/rest/v1/teams?id=eq.${encodeURIComponent(String(team.id))}`, { method: 'PATCH', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ shared_sites: updatedShares }) });
      }
    }

    // Delete projects referencing site
    const projectsRes = await fetch(`${supa}/rest/v1/projects`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const allProjects = await projectsRes.json();
    for (const project of (allProjects||[])) {
      if (project.site_id === site_id) {
        await fetch(`${supa}/rest/v1/projects?id=eq.${encodeURIComponent(String(project.id))}`, { method: 'DELETE', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      }
    }

    // Finalize site update
    await fetch(`${supa}/rest/v1/sites?id=eq.${encodeURIComponent(String(site_id))}`, { method: 'PATCH', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ owner_type: 'user', owner_id: requesterId, shared_sites: [], transfer_request: null }) });

    // Create message and activity log
    const requesterUserRes2 = await fetch(`${supa}/rest/v1/users?id=eq.${encodeURIComponent(String(requesterId))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const requesterUser2 = (await requesterUserRes2.json())?.[0];
    const senderUserRes2 = await fetch(`${supa}/rest/v1/users?id=eq.${encodeURIComponent(String(user.id))}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const senderUser2 = (await senderUserRes2.json())?.[0];
    const requesterInbox2 = requesterUser2?.mailboxes?.find((m:any)=>m.type==='userinbox');
    const senderOutbox2 = senderUser2?.mailboxes?.find((m:any)=>m.type==='useroutbox');
    if (requesterInbox2 && senderOutbox2) {
      await fetch(`${supa}/rest/v1/messages`, { method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: 'Site Overdracht Voltooid', message: `${user.full_name} heeft de overdracht van site "${site.name}" voltooid. Je bent nu de eigenaar van deze site.`, sender_id: user.id, sender_email: user.email, sender_name: user.full_name, to_mailbox_id: requesterInbox2.id, from_mailbox_id: senderOutbox2.id, from_admin_outbox: false, category: 'site_transfer_request', context: { type: 'site', id: site_id, name: site.name } }) });
    }

    await fetch(`${supa}/rest/v1/activity_logs`, { method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_email: user.email, action: `Site overdracht geaccepteerd: ${site.name}`, entity_type: 'site', entity_id: site_id, details: `Overgedragen aan ${requesterUser2?.full_name || requesterId}` }) });

    return jsonResponse({ success: true, message: 'Site transfer completed successfully' });

  } catch (err:any) {
    console.error('acceptSiteTransfer error', err);
    return jsonResponse({ success: false, error: err.message || String(err) }, 500);
  }
});

export {};
