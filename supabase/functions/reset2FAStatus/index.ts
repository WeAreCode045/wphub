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

        if (!user.two_fa_enabled) {
            return Response.json({ 
                success: false,
                error: '2FA is not enabled for this user' 
            }, { status: 400 });
        }

        await supabase.from('users').update({
            two_fa_verified_session: null
        });

        await supabase.from('activitylogs').insert({
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
