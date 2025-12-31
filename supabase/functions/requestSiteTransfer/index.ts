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

    const { site_id, site_url } = await req.json();

    if (!site_id && !site_url) {
      return new Response(
        JSON.stringify({ 
        error: 'Site ID of URL is verplicht' 
      }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the site
    let site;
    if (site_id) {
      site = await supabase.from('sites').select().eq('id', site_id).single();
    } else {
      const { data: sites, error: sitesError } = await supabase.from('sites').select().eq('url', site_url);
      site = sites[0];
    }

    if (!site) {
      return new Response(
        JSON.stringify({ 
        error: 'Site niet gevonden' 
      }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is not already the owner
    if (site.owner_type === 'user' && site.owner_id === user.id) {
      return new Response(
        JSON.stringify({ 
        error: 'Je bent al de eigenaar van deze site' 
      }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if there's already a pending transfer request
    const { data: existingRequests, error: requestsError } = await supabase
      .from('messages')
      .select()
      .eq('recipient_type', 'user')
      .eq('recipient_id', site.owner_type === 'user' ? site.owner_id : null)
      .eq('category', 'site_transfer_request')
      .eq('status', 'open');

    const pendingRequest = existingRequests?.find(msg => 
      msg.context?.site_id === site.id && 
      msg.context?.requesting_user_id === user.id
    );

    if (pendingRequest) {
      return new Response(
        JSON.stringify({ 
        error: 'Er is al een openstaand overdrachtverzoek voor deze site' 
      }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the owner
    let ownerUser = null;
    if (site.owner_type === 'user') {
      ownerUser = await supabase.from('users').select().eq('id', site.owner_id).single();
    } else {
      // Team-owned site
      const { data: team, error: teamError } = await supabase.from('teams').select().eq('id', site.owner_id).single();
      ownerUser = await supabase.from('users').select().eq('id', team.owner_id).single();
    }

    if (!ownerUser) {
      return new Response(
        JSON.stringify({ 
        error: 'Eigenaar van de site niet gevonden' 
      }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the transfer request message
    const message = await supabase.from('messages').insert({
      subject: `Overdrachtverzoek voor site: ${site.name}`,
      message: `${user.full_name} (${user.email}) verzoekt om overdracht van de site "${site.name}" (${site.url}). Klik op "Accepteren" om de overdracht te starten, of "Weigeren" om het verzoek af te wijzen.`,
      sender_id: user.id,
      sender_email: user.email,
      sender_name: user.full_name,
      recipient_type: 'user',
      recipient_id: ownerUser.id,
      recipient_email: ownerUser.email,
      is_read: false,
      priority: 'high',
      status: 'open',
      category: 'site_transfer_request',
      context: {
        type: 'site_transfer_request',
        site_id: site.id,
        site_name: site.name,
        site_url: site.url,
        requesting_user_id: user.id,
        requesting_user_name: user.full_name,
        requesting_user_email: user.email,
        current_owner_id: site.owner_id,
        current_owner_type: site.owner_type
      }
    });

    // Send notification to owner
    await supabase.from('notifications').insert({
      recipient_id: ownerUser.id,
      recipient_email: ownerUser.email,
      title: `Overdrachtverzoek voor site: ${site.name}`,
      message: `${user.full_name} verzoekt om overdracht van je site "${site.name}". Bekijk je berichten voor meer details.`,
      type: 'warning'
    });

    // Log activity
    await supabase.from('activitylogs').insert({
      user_email: user.email,
      action: `Overdrachtverzoek ingediend voor site: ${site.name}`,
      entity_type: 'site',
      entity_id: site.id,
      details: `Verzoek gericht aan ${ownerUser.full_name}`
    });

    return new Response(
        JSON.stringify({
      success: true,
      message: 'Overdrachtverzoek succesvol verzonden',
      message_id: message.id
    }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

  } catch (error) {
    console.error('Request site transfer error:', error);
    return new Response(
        JSON.stringify({ 
      error: error.message || 'Failed to request site transfer' 
    }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
});