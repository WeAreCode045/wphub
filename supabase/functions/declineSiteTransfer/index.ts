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

    const { site_id } = await req.json();

    if (!site_id) {
      return new Response(
        JSON.stringify({ 
        error: 'Site ID is verplicht' 
      }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the site
    const { data: site, error: siteError } = await supabase.from('sites').select().eq('id', site_id).single();

    if (!site) {
      return new Response(
        JSON.stringify({ 
        error: 'Site niet gevonden' 
      }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is the site owner
    if (site.owner_type !== 'user' || site.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ 
        error: 'Je bent niet gemachtigd om dit verzoek af te handelen' 
      }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if there's a pending transfer request
    if (!site.transfer_request || site.transfer_request.status !== 'pending') {
      return new Response(
        JSON.stringify({ 
        error: 'Geen openstaand overdrachtverzoek gevonden' 
      }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { requested_by_user_id, requested_by_user_email, requested_by_user_name } = site.transfer_request;

    // Update site to remove transfer request
    await supabase.from('sites').update({
      transfer_request: {
        ...site.transfer_request,
        status: 'declined'
      }
    });

    // Send rejection message to requester
    await supabase.from('messages').insert({
      subject: `Overdrachtverzoek afgewezen: ${site.name}`,
      message: `Je overdrachtverzoek voor site "${site.name}" is afgewezen door ${user.full_name}.`,
      sender_id: user.id,
      sender_email: user.email,
      sender_name: user.full_name,
      recipient_type: 'user',
      recipient_id: requested_by_user_id,
      recipient_email: requested_by_user_email,
      is_read: false,
      priority: 'normal',
      status: 'open',
      category: 'general'
    });

    // Send notification to requester
    await supabase.from('notifications').insert({
      recipient_id: requested_by_user_id,
      recipient_email: requested_by_user_email,
      title: `Overdrachtverzoek afgewezen: ${site.name}`,
      message: `Je overdrachtverzoek voor "${site.name}" is afgewezen.`,
      type: 'warning'
    });

    // Log activity
    await supabase.from('activitylogs').insert({
      user_email: user.email,
      action: `Overdrachtverzoek afgewezen voor site: ${site.name}`,
      entity_type: 'site',
      entity_id: site.id,
      details: `Verzoek van ${requested_by_user_name} afgewezen`
    });

    return new Response(
        JSON.stringify({
      success: true,
      message: 'Overdrachtverzoek afgewezen'
    }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

  } catch (error) {
    console.error('Decline site transfer error:', error);
    return new Response(
        JSON.stringify({ 
      error: error.message || 'Failed to decline site transfer' 
    }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
});