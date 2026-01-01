import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_helpers.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supaUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supaUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supaUrl, serviceKey);

    // List all files in the connector bucket
    const { data: files, error } = await supabase.storage
      .from('wp-plugin-hub-connector')
      .list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse versions from filenames
    const versions = (files || [])
      .filter((file: any) => file.name.endsWith('.zip'))
      .map((file: any) => {
        // Extract version from filename: wp-plugin-hub-connector-1.0.0.zip
        const match = file.name.match(/wp-plugin-hub-connector-(.+)\.zip/);
        const version = match ? match[1] : 'unknown';
        
        const publicUrl = `${supaUrl}/storage/v1/object/public/wp-plugin-hub-connector/${file.name}`;

        return {
          version,
          filename: file.name,
          url: publicUrl,
          size: file.metadata?.size || 0,
          created_at: file.created_at,
          updated_at: file.updated_at,
        };
      });

    return new Response(
      JSON.stringify({
        success: true,
        versions: versions,
        count: versions.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error listing connector versions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
