import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
      return Response.json({ 
        error: 'Subject and message are required' 
      }, { status: 400 });
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
        const targetUser = await base44.asServiceRole.entities.User.get(to_user_id);
        recipient_type = 'user';
        recipient_id = to_user_id;
        recipient_email = targetUser.email;
      } else if (context.type === 'plugin' && context.id) {
        // Get plugin owner
        const plugin = await base44.asServiceRole.entities.Plugin.get(context.id);
        if (plugin.owner_type === 'user') {
          const owner = await base44.asServiceRole.entities.User.get(plugin.owner_id);
          recipient_type = 'user';
          recipient_id = plugin.owner_id;
          recipient_email = owner.email;
        } else if (plugin.owner_type === 'team') {
          const team = await base44.asServiceRole.entities.Team.get(plugin.owner_id);
          recipient_type = 'team';
          recipient_id = team.id;
          recipient_email = null;
          team_id = team.id;
        }
      } else if (context.type === 'site' && context.id) {
        // Get site owner
        const site = await base44.asServiceRole.entities.Site.get(context.id);
        if (site.owner_type === 'user') {
          const owner = await base44.asServiceRole.entities.User.get(site.owner_id);
          recipient_type = 'user';
          recipient_id = site.owner_id;
          recipient_email = owner.email;
        } else if (site.owner_type === 'team') {
          const team = await base44.asServiceRole.entities.Team.get(site.owner_id);
          recipient_type = 'team';
          recipient_id = team.id;
          recipient_email = null;
          team_id = team.id;
        }
      } else if (context.type === 'team' && to_team_id) {
        const team = await base44.asServiceRole.entities.Team.get(to_team_id);
        const owner = await base44.asServiceRole.entities.User.get(team.owner_id);
        recipient_type = 'user';
        recipient_id = team.owner_id;
        recipient_email = owner.email;
      }
    }
    // Regular users can only send within teams/projects
    else if (!isAdmin) {
      // Verify user is part of the team/project
      if (is_team_inbox && to_team_id) {
        const team = await base44.asServiceRole.entities.Team.filter({ id: to_team_id });
        if (team.length === 0) {
          return Response.json({ error: 'Team not found' }, { status: 404 });
        }
        
        const isMember = team[0].owner_id === user.id || 
          team[0].members?.some(m => m.user_id === user.id && m.status === 'active');
        
        if (!isMember) {
          return Response.json({ error: 'You are not a member of this team' }, { status: 403 });
        }
        
        recipient_type = 'team';
        recipient_id = to_team_id;
        team_id = to_team_id;
      } else if (is_project_inbox && project_id) {
        const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
        if (projects.length === 0) {
          return Response.json({ error: 'Project not found' }, { status: 404 });
        }
        
        const project = projects[0];
        const teams = await base44.asServiceRole.entities.Team.filter({ id: project.team_id });
        if (teams.length === 0) {
          return Response.json({ error: 'Project team not found' }, { status: 404 });
        }
        
        const team = teams[0];
        const isMember = team.owner_id === user.id || 
          team.members?.some(m => m.user_id === user.id && m.status === 'active');
        
        if (!isMember) {
          return Response.json({ error: 'You are not a member of this project team' }, { status: 403 });
        }
        
        recipient_type = 'team';
        recipient_id = project.team_id;
        team_id = project.team_id;
      } else if (to_team_member_id && to_team_id) {
        // Sending to specific team member
        const teams = await base44.asServiceRole.entities.Team.filter({ id: to_team_id });
        if (teams.length === 0) {
          return Response.json({ error: 'Team not found' }, { status: 404 });
        }
        
        const team = teams[0];
        const isSenderMember = team.owner_id === user.id || 
          team.members?.some(m => m.user_id === user.id && m.status === 'active');
        
        if (!isSenderMember) {
          return Response.json({ error: 'You are not a member of this team' }, { status: 403 });
        }
        
        const isRecipientMember = team.owner_id === to_team_member_id || 
          team.members?.some(m => m.user_id === to_team_member_id && m.status === 'active');
        
        if (!isRecipientMember) {
          return Response.json({ error: 'Recipient is not a member of this team' }, { status: 403 });
        }
        
        const targetUser = await base44.asServiceRole.entities.User.get(to_team_member_id);
        recipient_type = 'user';
        recipient_id = to_team_member_id;
        recipient_email = targetUser.email;
      } else if (to_user_id && to_team_id) {
        // Sending to team owner
        const teams = await base44.asServiceRole.entities.Team.filter({ id: to_team_id });
        if (teams.length === 0) {
          return Response.json({ error: 'Team not found' }, { status: 404 });
        }
        
        const team = teams[0];
        const isMember = team.owner_id === user.id || 
          team.members?.some(m => m.user_id === user.id && m.status === 'active');
        
        if (!isMember) {
          return Response.json({ error: 'You are not a member of this team' }, { status: 403 });
        }
        
        if (team.owner_id !== to_user_id) {
          return Response.json({ error: 'Invalid recipient' }, { status: 403 });
        }
        
        const targetUser = await base44.asServiceRole.entities.User.get(to_user_id);
        recipient_type = 'user';
        recipient_id = to_user_id;
        recipient_email = targetUser.email;
      } else {
        return Response.json({ 
          error: 'Invalid recipient configuration for regular user' 
        }, { status: 403 });
      }
    } else {
      return Response.json({ 
        error: 'Invalid message configuration' 
      }, { status: 400 });
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

    const createdMessage = await base44.asServiceRole.entities.Message.create(messageData);

    // Create activity log
    await base44.asServiceRole.entities.ActivityLog.create({
      user_email: user.email,
      action: `Bericht verzonden: ${subject}`,
      entity_type: 'user',
      entity_id: user.id,
      details: `Naar ${recipient_type}: ${recipient_email || recipient_id}`
    });

    return Response.json({
      success: true,
      message: 'Bericht succesvol verzonden',
      message_id: createdMessage.id
    });

  } catch (error) {
    console.error('Send message error:', error);
    return Response.json({ 
      error: error.message || 'Failed to send message' 
    }, { status: 500 });
  }
});