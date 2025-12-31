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
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { site_id } = await req.json();

    if (!site_id) {
      return Response.json({ 
        error: 'Site ID is verplicht' 
      }, { status: 400 });
    }

    // Get the site
    const { data: site, error: siteError } = await supabase.from('sites').select().eq('id', site_id).single();

    if (!site) {
      return Response.json({ 
        error: 'Site niet gevonden' 
      }, { status: 404 });
    }

    // Verify user is the site owner
    if (site.owner_type !== 'user' || site.owner_id !== user.id) {
      return Response.json({ 
        error: 'Je bent niet gemachtigd om dit verzoek af te handelen' 
      }, { status: 403 });
    }

    // Check if there's a pending transfer request
    if (!site.transfer_request || site.transfer_request.status !== 'pending') {
      return Response.json({ 
        error: 'Geen openstaand overdrachtverzoek gevonden' 
      }, { status: 400 });
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

    return Response.json({
      success: true,
      message: 'Overdrachtverzoek afgewezen'
    });

  } catch (error) {
    console.error('Decline site transfer error:', error);
    return Response.json({ 
      error: error.message || 'Failed to decline site transfer' 
    }, { status: 500 });
  }
});