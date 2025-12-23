import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ 
                success: false,
                error: 'Unauthorized' 
            }, { status: 401 });
        }

        // Check if 2FA is enabled for this user
        if (!user.two_fa_enabled) {
            return Response.json({ 
                success: false,
                error: '2FA is not enabled for this user' 
            }, { status: 400 });
        }

        // Generate random 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Set expiration to 10 minutes from now
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // Update user with code and expiration
        await base44.asServiceRole.entities.User.update(user.id, {
            two_fa_code: code,
            two_fa_code_expires_at: expiresAt
        });

        // Send email with code
        await base44.asServiceRole.integrations.Core.SendEmail({
            to: user.email,
            subject: 'Je 2FA Verificatiecode',
            body: `
Hallo ${user.full_name},

Je 2FA verificatiecode is: ${code}

Deze code is 10 minuten geldig.

Als je deze code niet hebt aangevraagd, negeer deze email dan.

Met vriendelijke groet,
Het Team
            `.trim()
        });

        // Log activity
        await base44.asServiceRole.entities.ActivityLog.create({
            user_email: user.email,
            action: '2FA code aangevraagd',
            entity_type: "user",
            entity_id: user.id
        });

        return Response.json({
            success: true,
            message: 'Verificatiecode verzonden naar ' + user.email
        });

    } catch (error) {
        console.error('[generate2FACode] Error:', error.message);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});