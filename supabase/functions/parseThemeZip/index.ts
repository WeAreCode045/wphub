import { createClientFromRequest } from '../base44Shim.js';
import JSZip from 'npm:jszip@3.10.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url } = await req.json();

    if (!file_url) {
      return Response.json({ success: false, error: 'No file URL provided' });
    }

    // Download the ZIP file
    const response = await fetch(file_url);
    if (!response.ok) {
      return Response.json({ success: false, error: 'Failed to download file' });
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
      return Response.json({ 
        success: false, 
        error: 'Could not find style.css. Please ensure this is a valid WordPress theme.' 
      });
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

    // Try to find screenshot
    let screenshotUrl = '';
    for (const [path, file] of Object.entries(zip.files)) {
      const fileName = path.toLowerCase();
      if (fileName.endsWith('screenshot.png') || fileName.endsWith('screenshot.jpg') || fileName.endsWith('screenshot.jpeg')) {
        const parts = path.split('/');
        if (parts.length <= 2) {
          // Found screenshot at theme root level
          // Note: We can't easily extract and upload the screenshot here
          // The screenshot_url would need to be set separately if needed
          break;
        }
      }
    }

    return Response.json({
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
    });

  } catch (error) {
    console.error('Parse theme error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Failed to parse theme' 
    });
  }
});