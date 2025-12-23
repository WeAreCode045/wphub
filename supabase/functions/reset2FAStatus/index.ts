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

        if (!user.two_fa_enabled) {
            return Response.json({ 
                success: false,
                error: '2FA is not enabled for this user' 
            }, { status: 400 });
        }

        await base44.asServiceRole.entities.User.update(user.id, {
            two_fa_verified_session: null
        });

        await base44.asServiceRole.entities.ActivityLog.create({
            user_email: user.email,
            action: '2FA status gereset',
            entity_type: "user",
            entity_id: user.id
        });

        return Response.json({
            success: true,
            message: '2FA status reset'
        });

    } catch (error) {
        console.error('[reset2FAStatus] Error:', error.message);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});
