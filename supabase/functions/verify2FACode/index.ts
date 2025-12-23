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

        const body = await req.json();
        const { code } = body;

        if (!code) {
            return Response.json({ 
                success: false,
                error: 'Code is required' 
            }, { status: 400 });
        }

        if (!user.two_fa_enabled) {
            return Response.json({ 
                success: false,
                error: '2FA is not enabled' 
            }, { status: 400 });
        }

        if (!user.two_fa_code) {
            return Response.json({ 
                success: false,
                error: 'No 2FA code found. Please request a new code.' 
            }, { status: 400 });
        }

        const expiresAt = new Date(user.two_fa_code_expires_at);
        if (expiresAt < new Date()) {
            return Response.json({ 
                success: false,
                error: 'Code has expired. Please request a new code.' 
            }, { status: 400 });
        }

        if (user.two_fa_code !== code) {
            await base44.asServiceRole.entities.ActivityLog.create({
                user_email: user.email,
                action: '2FA verificatie mislukt - onjuiste code',
                entity_type: "user",
                entity_id: user.id
            });

            return Response.json({ 
                success: false,
                error: 'Invalid code' 
            }, { status: 400 });
        }

        const sessionId = crypto.randomUUID();

        await base44.asServiceRole.entities.User.update(user.id, {
            two_fa_verified_session: sessionId,
            two_fa_code: null,
            two_fa_code_expires_at: null
        });

        await base44.asServiceRole.entities.ActivityLog.create({
            user_email: user.email,
            action: '2FA verificatie succesvol',
            entity_type: "user",
            entity_id: user.id
        });

        return Response.json({
            success: true,
            message: '2FA verification successful',
            session_id: sessionId
        });

    } catch (error) {
        console.error('[verify2FACode] Error:', error.message);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});
