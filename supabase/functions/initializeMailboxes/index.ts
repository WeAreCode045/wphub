import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
        }

        const settings = await base44.asServiceRole.entities.SiteSettings.list();
        let adminGlobalInboxId = settings.find(s => s.setting_key === 'admin_global_inbox_id')?.setting_value;

        if (!adminGlobalInboxId) {
            adminGlobalInboxId = `admin_inbox_${crypto.randomUUID()}`;
            await base44.asServiceRole.entities.SiteSettings.create({ setting_key: 'admin_global_inbox_id', setting_value: adminGlobalInboxId, description: 'Globale inbox ID voor alle platform admins' });
        }

        const allUsers = await base44.asServiceRole.entities.User.list();
        let usersUpdated = 0;
        let adminsUpdated = 0;

        for (const existingUser of allUsers) {
            if (existingUser.mailboxes && existingUser.mailboxes.length > 0) continue;

            const mailboxes = [ { type: 'userinbox', id: `userinbox_${existingUser.id}_${crypto.randomUUID()}` }, { type: 'useroutbox', id: `useroutbox_${existingUser.id}_${crypto.randomUUID()}` } ];

            if (existingUser.role === 'admin') {
                mailboxes.push({ type: 'admininbox', id: adminGlobalInboxId });
                mailboxes.push({ type: 'adminoutbox', id: `adminoutbox_${existingUser.id}_${crypto.randomUUID()}` });
                adminsUpdated++;
            }

            await base44.asServiceRole.entities.User.update(existingUser.id, { mailboxes });
            usersUpdated++;
        }

        const allTeams = await base44.asServiceRole.entities.Team.list();
        let teamsUpdated = 0;

        for (const team of allTeams) {
            if (team.inbox_id) continue;
            const inboxId = `teaminbox_${team.id}_${crypto.randomUUID()}`;
            await base44.asServiceRole.entities.Team.update(team.id, { inbox_id: inboxId });
            teamsUpdated++;
        }

        const allProjects = await base44.asServiceRole.entities.Project.list();
        let projectsUpdated = 0;

        for (const project of allProjects) {
            if (project.inbox_id) continue;
            const inboxId = `projectinbox_${project.id}_${crypto.randomUUID()}`;
            await base44.asServiceRole.entities.Project.update(project.id, { inbox_id: inboxId });
            projectsUpdated++;
        }

        return Response.json({ success: true, message: 'Mailboxes successfully initialized', stats: { admin_global_inbox_id: adminGlobalInboxId, users_updated: usersUpdated, admins_updated: adminsUpdated, teams_updated: teamsUpdated, projects_updated: projectsUpdated } });

    } catch (error) {
        console.error('Error initializing mailboxes:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});