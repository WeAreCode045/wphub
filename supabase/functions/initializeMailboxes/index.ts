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
        
        if (!user || user.user_metadata?.role !== 'admin') {
            return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const { data: settings, error: settingsError } = await supabase.from('sitesettingss').select();
        let adminGlobalInboxId = settings.find(s => s.setting_key === 'admin_global_inbox_id')?.setting_value;

        if (!adminGlobalInboxId) {
            adminGlobalInboxId = `admin_inbox_${crypto.randomUUID()}`;
            await supabase.from('sitesettingss').insert({ setting_key: 'admin_global_inbox_id', setting_value: adminGlobalInboxId, description: 'Globale inbox ID voor alle platform admins' });
        }

        const { data: allUsers, error: allUsersError } = await supabase.from('users').select();
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

            await supabase.from('users').update({ mailboxes });
            usersUpdated++;
        }

        const { data: allTeams, error: allTeamsError } = await supabase.from('teams').select();
        let teamsUpdated = 0;

        for (const team of allTeams) {
            if (team.inbox_id) continue;
            const inboxId = `teaminbox_${team.id}_${crypto.randomUUID()}`;
            await supabase.from('teams').update({ inbox_id: inboxId });
            teamsUpdated++;
        }

        const { data: allProjects, error: allProjectsError } = await supabase.from('projects').select();
        let projectsUpdated = 0;

        for (const project of allProjects) {
            if (project.inbox_id) continue;
            const inboxId = `projectinbox_${project.id}_${crypto.randomUUID()}`;
            await supabase.from('projects').update({ inbox_id: inboxId });
            projectsUpdated++;
        }

        return new Response(
        JSON.stringify({ success: true, message: 'Mailboxes successfully initialized', stats: { admin_global_inbox_id: adminGlobalInboxId, users_updated: usersUpdated, admins_updated: adminsUpdated, teams_updated: teamsUpdated, projects_updated: projectsUpdated } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('Error initializing mailboxes:', error);
        return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});