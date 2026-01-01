import { createClient } from 'jsr:@supabase/supabase-js@2'
import JSZip from 'npm:jszip@3.10.1';
import { corsHeaders } from '../_helpers.ts';
import { ParseThemeZipRequestSchema, z } from '../_shared/schemas.ts';

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

    // Parse and validate request body with Zod
    let body;
    try {
      const bodyText = await req.text();
      const parsed = JSON.parse(bodyText);
      body = ParseThemeZipRequestSchema.parse(parsed);
    } catch (parseError) {
      console.error('[parseThemeZip] Validation error:', parseError);
      const error = parseError instanceof z.ZodError
        ? `Validation error: ${parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        : `Invalid request: ${parseError.message}`;
      return new Response(
        JSON.stringify({ error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { file_url } = body;

    // Download the ZIP file
    const response = await fetch(file_url);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to download file' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Find style.css file (WordPress theme identifier)
    let styleContent = null;
    let themeFolder = '';

    for (const [path, file] of Object.entries(zip.files)) {
      if (path.endsWith('style.css') && !file.dir) {
        // Check if it's the main style.css (in root or one level deep)
        const parts = path.split('/');
        if (parts.length <= 2) {
          styleContent = await file.async('string');
          themeFolder = parts.length === 2 ? parts[0] : '';
          break;
        }
      }
    }

    if (!styleContent) {
      return new Response(
        JSON.stringify({ 
        success: false, 
        error: 'Could not find style.css. Please ensure this is a valid WordPress theme.' 
      }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse theme header from style.css
    const parseThemeHeader = (content) => {
      const headers = {
        name: '',
        slug: '',
        version: '1.0.0',
        description: '',
        author: '',
        author_url: '',
        theme_uri: '',
        text_domain: ''
      };

      // Theme Name
      const nameMatch = content.match(/Theme Name:\s*(.+)/i);
      if (nameMatch) {
        headers.name = nameMatch[1].trim();
        headers.slug = headers.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }

      // Version
      const versionMatch = content.match(/Version:\s*(.+)/i);
      if (versionMatch) {
        headers.version = versionMatch[1].trim();
      }

      // Description
      const descMatch = content.match(/Description:\s*(.+)/i);
      if (descMatch) {
        headers.description = descMatch[1].trim();
      }

      // Author
      const authorMatch = content.match(/Author:\s*(.+)/i);
      if (authorMatch) {
        headers.author = authorMatch[1].trim();
      }

      // Author URI
      const authorUriMatch = content.match(/Author URI:\s*(.+)/i);
      if (authorUriMatch) {
        headers.author_url = authorUriMatch[1].trim();
      }

      // Theme URI
      const themeUriMatch = content.match(/Theme URI:\s*(.+)/i);
      if (themeUriMatch) {
        headers.theme_uri = themeUriMatch[1].trim();
      }

      // Text Domain (can be used as slug)
      const textDomainMatch = content.match(/Text Domain:\s*(.+)/i);
      if (textDomainMatch) {
        headers.text_domain = textDomainMatch[1].trim();
        if (!headers.slug || headers.slug === '') {
          headers.slug = headers.text_domain;
        }
      }

      return headers;
    };

    const themeData = parseThemeHeader(styleContent);

    // Use folder name as slug if not found in headers
    if (!themeData.slug && themeFolder) {
      themeData.slug = themeFolder.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    if (!themeData.name) {
      themeData.name = themeFolder || 'Unknown Theme';
    }

    // Try to find and upload screenshot
    let screenshotUrl = '';
    console.log('[parseThemeZip] Looking for screenshot in theme files...');
    
    for (const [path, file] of Object.entries(zip.files)) {
      console.log('[parseThemeZip] Found file:', path, 'isDir:', file.dir);
      const fileName = path.toLowerCase();
      
      if ((fileName.includes('screenshot.png') || fileName.includes('screenshot.jpg') || fileName.includes('screenshot.jpeg')) && !file.dir) {
        const parts = path.split('/');
        console.log('[parseThemeZip] Found potential screenshot:', path, 'parts:', parts.length);
        
        // Accept screenshots from theme root or first level folder
        if (parts.length <= 2) {
          try {
            console.log('[parseThemeZip] Processing screenshot:', path);
            const screenshotData = await file.async('arraybuffer');
            console.log('[parseThemeZip] Screenshot size:', screenshotData.byteLength, 'bytes');
            
            const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
            const uploadPath = `${themeData.slug}${ext}`;
            
            console.log('[parseThemeZip] Uploading screenshot:', uploadPath, 'contentType:', fileName.includes('.png') ? 'image/png' : 'image/jpeg');
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('Theme')
              .upload(uploadPath, screenshotData, {
                contentType: fileName.includes('.png') ? 'image/png' : 'image/jpeg',
                upsert: true
              });

            if (uploadError) {
              console.error('[parseThemeZip] Screenshot upload error:', uploadError);
            } else {
              console.log('[parseThemeZip] Upload successful:', uploadData);
              const { data: { publicUrl } } = supabase.storage
                .from('Theme')
                .getPublicUrl(uploadPath);
              screenshotUrl = publicUrl;
              console.log('[parseThemeZip] Screenshot public URL:', screenshotUrl);
            }
          } catch (screenshotError) {
            console.error('[parseThemeZip] Error processing screenshot:', screenshotError);
          }
          break;
        }
      }
    }
    
    console.log('[parseThemeZip] Final screenshotUrl:', screenshotUrl);

    return new Response(
        JSON.stringify({
      success: true,
      theme: {
        name: themeData.name,
        slug: themeData.slug,
        version: themeData.version,
        description: themeData.description,
        author: themeData.author,
        author_url: themeData.author_url,
        theme_uri: themeData.theme_uri,
        screenshot_url: screenshotUrl
      }
    }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

  } catch (error) {
    console.error('Parse theme error:', error);
    return new Response(
        JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to parse theme' 
    }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
});