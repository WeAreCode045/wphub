import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_helpers.ts';
import { Verify2FACodeRequestSchema, z } from '../_shared/schemas.ts';


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
        JSON.stringify({ 
                success: false,
                error: 'Unauthorized' 
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        // Parse and validate request body
        let body;
        try {
          const rawBody = await req.json();
          body = Verify2FACodeRequestSchema.parse(rawBody);
        } catch (parseError) {
          console.error('[verify2FACode] Validation error:', parseError);
          const error = parseError instanceof z.ZodError
            ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
            : `Invalid request: ${parseError.message}`;
          return new Response(
            JSON.stringify({ success: false, error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { code } = body;

        if (!user.two_fa_enabled) {
            return new Response(
        JSON.stringify({ 
                success: false,
                error: '2FA is not enabled' 
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        if (!user.two_fa_code) {
            return new Response(
        JSON.stringify({ 
                success: false,
                error: 'No 2FA code found. Please request a new code.' 
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const expiresAt = new Date(user.two_fa_code_expires_at);
        if (expiresAt < new Date()) {
            return new Response(
        JSON.stringify({ 
                success: false,
                error: 'Code has expired. Please request a new code.' 
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        if (user.two_fa_code !== code) {
            await supabase.from('activitylogs').insert({
                user_email: user.email,
                action: '2FA verificatie mislukt - onjuiste code',
                entity_type: "user",
                entity_id: user.id
            });

            return new Response(
        JSON.stringify({ 
                success: false,
                error: 'Invalid code' 
            }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
        }

        const sessionId = crypto.randomUUID();

        await supabase.from('users').update({
            two_fa_verified_session: sessionId,
            two_fa_code: null,
            two_fa_code_expires_at: null
        });

        await supabase.from('activitylogs').insert({
            user_email: user.email,
            action: '2FA verificatie succesvol',
            entity_type: "user",
            entity_id: user.id
        });

        return new Response(
        JSON.stringify({
            success: true,
            message: '2FA verification successful',
            session_id: sessionId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
        console.error('[verify2FACode] Error:', error.message);
        return new Response(
        JSON.stringify({ 
            success: false,
            error: error.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
});
