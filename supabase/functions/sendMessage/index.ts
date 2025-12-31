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

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      subject, 
      message, 
      context,
      to_user_id,
      to_team_id,
      to_team_member_id,
      is_team_inbox,
      is_project_inbox,
      project_id
    } = await req.json();

    if (!subject || !message) {
      return new Response(
        JSON.stringify({ 
        error: 'Subject and message are required' 
      }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = user.role === 'admin';

    // Determine recipient details based on context
    let recipient_type;
    let recipient_id;
    let recipient_email;
    let team_id;

    // Admin can send to any context
    if (isAdmin && context) {
      if (context.type === 'user' && to_user_id) {
        const { data: targetUser, error: targetUserError } = await supabase.from('users').select().eq('id', to_user_id).single();
        recipient_type = 'user';
        recipient_id = to_user_id;
        recipient_email = targetUser.email;
      } else if (context.type === 'plugin' && context.id) {
        // Get plugin owner
        const { data: plugin, error: pluginError } = await supabase.from('plugins').select().eq('id', context.id).single();
        if (plugin.owner_type === 'user') {
          const { data: owner, error: ownerError } = await supabase.from('users').select().eq('id', plugin.owner_id).single();
          recipient_type = 'user';
          recipient_id = plugin.owner_id;
          recipient_email = owner.email;
        } else if (plugin.owner_type === 'team') {
          const { data: team, error: teamError } = await supabase.from('teams').select().eq('id', plugin.owner_id).single();
          recipient_type = 'team';
          recipient_id = team.id;
          recipient_email = null;
          team_id = team.id;
        }
      } else if (context.type === 'site' && context.id) {
        // Get site owner
        const { data: site, error: siteError } = await supabase.from('sites').select().eq('id', context.id).single();
        if (site.owner_type === 'user') {
          const { data: owner, error: ownerError } = await supabase.from('users').select().eq('id', site.owner_id).single();
          recipient_type = 'user';
          recipient_id = site.owner_id;
          recipient_email = owner.email;
        } else if (site.owner_type === 'team') {
          const { data: team, error: teamError } = await supabase.from('teams').select().eq('id', site.owner_id).single();
          recipient_type = 'team';
          recipient_id = team.id;
          recipient_email = null;
          team_id = team.id;
        }
      } else if (context.type === 'team' && to_team_id) {
        const { data: team, error: teamError } = await supabase.from('teams').select().eq('id', to_team_id).single();
        const { data: owner, error: ownerError } = await supabase.from('users').select().eq('id', team.owner_id).single();
        recipient_type = 'user';
        recipient_id = team.owner_id;
        recipient_email = owner.email;
      }
    }
    // Regular users can only send within teams/projects
    else if (!isAdmin) {
      // Verify user is part of the team/project
      if (is_team_inbox && to_team_id) {
        const { data: teams, error: teamsError } = await supabase.from('teams').select().eq('id', to_team_id);
                if (teamsError || !teams) {
            return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        if (teams.length === 0) {
          return new Response(
        JSON.stringify({ error: 'Team not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        
        const isMember = teams[0].owner_id === user.id || 
          teams[0].members?.some(m => m.user_id === user.id && m.status === 'active');
        
        if (!isMember) {
          return new Response(
        JSON.stringify({ error: 'You are not a member of this team' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        
        recipient_type = 'team';
        recipient_id = to_team_id;
        team_id = to_team_id;
      } else if (is_project_inbox && project_id) {
        const { data: projects, error: projectsError } = await supabase.from('projects').select().eq('id', project_id);
                if (projectsError || !projects) {
            return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        if (projects.length === 0) {
          return new Response(
        JSON.stringify({ error: 'Project not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        
        const project = projects[0];
        const { data: teams, error: teamsError } = await supabase.from('teams').select().eq('id', project.team_id);
                if (teamsError || !teams) {
            return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        if (teams.length === 0) {
          return new Response(
        JSON.stringify({ error: 'Project team not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        
        const team = teams[0];
        const isMember = team.owner_id === user.id || 
          team.members?.some(m => m.user_id === user.id && m.status === 'active');
        
        if (!isMember) {
          return new Response(
        JSON.stringify({ error: 'You are not a member of this project team' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        
        recipient_type = 'team';
        recipient_id = project.team_id;
        team_id = project.team_id;
      } else if (to_team_member_id && to_team_id) {
        // Sending to specific team member
        const { data: teams, error: teamsError } = await supabase.from('teams').select().eq('id', to_team_id);
                if (teamsError || !teams) {
            return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        if (teams.length === 0) {
          return new Response(
        JSON.stringify({ error: 'Team not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        
        const team = teams[0];
        const isSenderMember = team.owner_id === user.id || 
          team.members?.some(m => m.user_id === user.id && m.status === 'active');
        
        if (!isSenderMember) {
          return new Response(
        JSON.stringify({ error: 'You are not a member of this team' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        
        const isRecipientMember = team.owner_id === to_team_member_id || 
          team.members?.some(m => m.user_id === to_team_member_id && m.status === 'active');
        
        if (!isRecipientMember) {
          return new Response(
        JSON.stringify({ error: 'Recipient is not a member of this team' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        
        const { data: targetUser, error: targetUserError } = await supabase.from('users').select().eq('id', to_team_member_id).single();
        recipient_type = 'user';
        recipient_id = to_team_member_id;
        recipient_email = targetUser.email;
      } else if (to_user_id && to_team_id) {
        // Sending to team owner
        const { data: teams, error: teamsError } = await supabase.from('teams').select().eq('id', to_team_id);
                if (teamsError || !teams) {
            return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        if (teams.length === 0) {
          return new Response(
        JSON.stringify({ error: 'Team not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        
        const team = teams[0];
        const isMember = team.owner_id === user.id || 
          team.members?.some(m => m.user_id === user.id && m.status === 'active');
        
        if (!isMember) {
          return new Response(
        JSON.stringify({ error: 'You are not a member of this team' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        
        if (team.owner_id !== to_user_id) {
          return new Response(
        JSON.stringify({ error: 'Invalid recipient' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }
        
        const { data: targetUser, error: targetUserError } = await supabase.from('users').select().eq('id', to_user_id).single();
        recipient_type = 'user';
        recipient_id = to_user_id;
        recipient_email = targetUser.email;
      } else {
        return new Response(
        JSON.stringify({ 
          error: 'Invalid recipient configuration for regular user' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      }
    } else {
      return new Response(
        JSON.stringify({ 
        error: 'Invalid message configuration' 
      }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the message
    const messageData = {
      subject,
      message,
      sender_id: user.id,
      sender_email: user.email,
      sender_name: user.full_name,
      recipient_type,
      recipient_id,
      recipient_email,
      team_id,
      is_read: false,
      is_archived: false,
      priority: 'normal',
      status: 'open',
      category: 'general',
      context: context || {}
    };

    const { data: createdMessage, error: createdMessageError } = await supabase.from('messages').insert(messageData);

    // Create activity log
    await supabase.from('activitylogs').insert({
      user_email: user.email,
      action: `Bericht verzonden: ${subject}`,
      entity_type: 'user',
      entity_id: user.id,
      details: `Naar ${recipient_type}: ${recipient_email || recipient_id}`
    });

    return new Response(
        JSON.stringify({
      success: true,
      message: 'Bericht succesvol verzonden',
      message_id: createdMessage.id
    }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

  } catch (error) {
    console.error('Send message error:', error);
    return new Response(
        JSON.stringify({ 
      error: (error as any).message || 'Failed to send message' 
    }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
});
