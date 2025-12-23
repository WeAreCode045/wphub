
import { createClientFromRequest } from './base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authenticate user
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const {
            subject,
            message,
            context = {},
            to_user_id,
            to_team_id,
            to_team_member_id,
            is_team_inbox,
            is_project_inbox,
            project_id,
            is_admin_action = false,
            to_platform_admin = false,
            // Reply parameters
            reply_to_message_id = null,
            thread_id = null
        } = body;

        // Validation
        if (!subject || !message) {
            return Response.json({ error: 'Subject and message are required' }, { status: 400 });
        }

        // Get admin global inbox ID from settings
        const settings = await base44.entities.SiteSettings.list();
        const adminGlobalInboxId = settings.find(s => s.setting_key === 'admin_global_inbox_id')?.setting_value;

        if (!adminGlobalInboxId) {
            return Response.json({ error: 'Admin inbox not configured. Please run initializeMailboxes function first.' }, { status: 500 });
        }

        // Get sender's mailboxes
        const senderUser = await base44.entities.User.get(user.id);
        if (!senderUser.mailboxes || senderUser.mailboxes.length === 0) {
            return Response.json({ error: 'Sender mailboxes not initialized' }, { status: 500 });
        }

        // Determine from_mailbox_id based on is_admin_action
        let fromMailboxId;
        let fromAdminOutbox = false;

        if (is_admin_action && user.role === 'admin') {
            const adminOutbox = senderUser.mailboxes.find(m => m.type === 'adminoutbox');
            if (!adminOutbox) {
                return Response.json({ error: 'Admin outbox not found for user' }, { status: 500 });
            }
            fromMailboxId = adminOutbox.id;
            fromAdminOutbox = true;
        } else {
            const userOutbox = senderUser.mailboxes.find(m => m.type === 'useroutbox');
            if (!userOutbox) {
                return Response.json({ error: 'User outbox not found for sender' }, { status: 500 });
            }
            fromMailboxId = userOutbox.id;
        }

        // Determine to_mailbox_id(s)
        let toMailboxIds = [];

        if (to_platform_admin) {
            toMailboxIds.push(adminGlobalInboxId);
        } else if (to_user_id) {
            const recipientUser = await base44.entities.User.get(to_user_id);
            const userInbox = recipientUser.mailboxes?.find(m => m.type === 'userinbox');
            if (!userInbox) {
                return Response.json({ error: 'Recipient inbox not found' }, { status: 500 });
            }
            toMailboxIds.push(userInbox.id);
        } else if (to_team_id || is_team_inbox) {
            const teamId = to_team_id || (context?.type === 'team' ? context.id : null);
            if (!teamId) {
                return Response.json({ error: 'Team ID required for team messages' }, { status: 400 });
            }
            
            const team = await base44.entities.Team.get(teamId);
            if (!team.inbox_id) {
                return Response.json({ error: 'Team inbox not initialized' }, { status: 500 });
            }
            toMailboxIds.push(team.inbox_id);
        } else if (project_id || is_project_inbox) {
            const projectIdToUse = project_id || (context?.type === 'project' ? context.id : null);
            if (!projectIdToUse) {
                return Response.json({ error: 'Project ID required for project messages' }, { status: 400 });
            }
            
            const project = await base44.entities.Project.get(projectIdToUse);
            if (!project.inbox_id) {
                return Response.json({ error: 'Project inbox not initialized' }, { status: 500 });
            }
            toMailboxIds.push(project.inbox_id);
        } else if (to_team_member_id) {
            const recipientUser = await base44.entities.User.get(to_team_member_id);
            const userInbox = recipientUser.mailboxes?.find(m => m.type === 'userinbox');
            if (!userInbox) {
                return Response.json({ error: 'Recipient inbox not found' }, { status: 500 });
            }
            toMailboxIds.push(userInbox.id);
        } else {
            return Response.json({ error: 'No valid recipient specified' }, { status: 400 });
        }

        // Handle reply logic
        let finalSubject = subject;
        let originalMessageQuote = null;
        let finalThreadId = thread_id;

        if (reply_to_message_id) {
            // This is a reply - get original message
            const originalMessage = await base44.entities.Message.get(reply_to_message_id);
            
            // Add RE: prefix if not already present
            if (!subject.startsWith('RE:')) {
                finalSubject = `RE: ${originalMessage.subject.replace(/^RE:\s*/, '')}`;
            }
            
            // Create quote of original message
            originalMessageQuote = `\n\n--- Origineel bericht ---\nVan: ${originalMessage.sender_name} (${originalMessage.sender_email})\nOnderwerp: ${originalMessage.subject}\n\n${originalMessage.message}`;
            
            // Set thread_id - use original's thread_id if it exists, otherwise use original message's id
            finalThreadId = originalMessage.thread_id || originalMessage.id;
        }

        // Add quote to message body
        const finalMessage = originalMessageQuote ? message + originalMessageQuote : message;

        // Create message(s) for each recipient mailbox
        const createdMessages = [];

        for (const toMailboxId of toMailboxIds) {
            const messageData = {
                subject: finalSubject,
                message: finalMessage,
                sender_id: user.id,
                sender_email: user.email,
                sender_name: user.full_name,
                to_mailbox_id: toMailboxId,
                from_mailbox_id: fromMailboxId,
                from_admin_outbox: fromAdminOutbox,
                context,
                priority: body.priority || 'normal',
                category: body.category || 'general',
                is_read: false,
                status: 'open',
                attachments: body.attachments || [],
                
                // Thread and reply fields
                thread_id: finalThreadId,
                reply_to_message_id: reply_to_message_id,
                original_message_quote: originalMessageQuote,
                
                // Legacy fields for backwards compatibility
                recipient_type: to_platform_admin ? 'admin' : (to_team_id || is_team_inbox) ? 'team' : (project_id || is_project_inbox) ? 'project' : 'user',
                recipient_id: to_user_id || to_team_member_id || to_team_id || project_id,
                team_id: to_team_id
            };

            const createdMessage = await base44.entities.Message.create(messageData);
            
            // If this is the first message (not a reply), set its thread_id to its own id
            if (!reply_to_message_id && !thread_id) {
                await base44.entities.Message.update(createdMessage.id, {
                    thread_id: createdMessage.id
                });
                createdMessage.thread_id = createdMessage.id;
            }
            
            createdMessages.push(createdMessage);
        }

        return Response.json({
            success: true,
            message: reply_to_message_id ? 'Reply sent successfully' : 'Message(s) sent successfully',
            message_ids: createdMessages.map(m => m.id),
            thread_id: createdMessages[0]?.thread_id
        });

    } catch (error) {
        console.error('Error sending message:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});
