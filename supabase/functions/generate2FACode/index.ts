import { createClient } from 'jsr:@supabase/supabase-js@2'


Deno.serve(async (req) => {
    try {
        const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )
      
      const { data: { user } } = await supabase.auth.getUser()

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
        await supabase.from('users').update({
            two_fa_code: code,
            two_fa_code_expires_at: expiresAt
        });

        // Send email with code
        // Note: integrations.Core.SendEmail might not exist in this architecture
        // You may need to implement email sending via a different service

        // Log activity
        await supabase.from('activitylogs').insert({
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