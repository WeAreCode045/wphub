import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    console.log('[parsePluginZip] === REQUEST RECEIVED ===');
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            console.error('[parsePluginZip] No user authenticated');
            return Response.json({ 
                success: false,
                error: 'Unauthorized' 
            }, { status: 401 });
        }

        console.log('[parsePluginZip] User:', user.email);

        // Parse request body
        let body;
        try {
            const bodyText = await req.text();
            body = JSON.parse(bodyText);
        } catch (parseError) {
            console.error('[parsePluginZip] Failed to parse JSON body:', parseError.message);
            return Response.json({ 
                success: false,
                error: 'Invalid JSON in request body: ' + parseError.message 
            }, { status: 400 });
        }

        const { file_url } = body;

        if (!file_url) {
            console.error('[parsePluginZip] No file_url in body');
            return Response.json({ 
                success: false,
                error: 'File URL is required' 
            }, { status: 400 });
        }

        console.log('[parsePluginZip] File URL:', file_url);

        // Download the file
        console.log('[parsePluginZip] Downloading file...');
        const response = await fetch(file_url);
        
        if (!response.ok) {
            console.error('[parsePluginZip] Download failed:', response.status);
            return Response.json({ 
                success: false,
                error: `Failed to download file: ${response.status}` 
            }, { status: 400 });
        }

        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        console.log('[parsePluginZip] File downloaded, size:', uint8Array.length);

        // Parse ZIP
        console.log('[parsePluginZip] Loading ZIP...');
        const JSZip = (await import('https://cdn.skypack.dev/jszip@3.10.1')).default;
        const zip = await JSZip.loadAsync(uint8Array);

        // Helper function to decode string if needed
        const decodeString = (str) => {
            if (typeof str === 'string' && /^[\d,]+$/.test(str)) {
                try {
                    return str.split(',').map(Number).map(char => String.fromCharCode(char)).join('');
                } catch (e) {
                    return str;
                }
            }
            return str;
        };

        // Get all file entries and decode them
        const rawEntries = Object.keys(zip.files);
        console.log('[parsePluginZip] Raw entries count:', rawEntries.length);
        
        // Create mapping of decoded filename -> raw key
        const fileMapping = {};
        rawEntries.forEach(rawKey => {
            const decodedName = decodeString(rawKey);
            fileMapping[decodedName] = rawKey;
        });

        const decodedEntries = Object.keys(fileMapping);
        console.log('[parsePluginZip] Decoded entries count:', decodedEntries.length);
        console.log('[parsePluginZip] First 10 decoded files:', decodedEntries.slice(0, 10));

        if (decodedEntries.length === 0) {
            return Response.json({ 
                success: false,
                error: 'ZIP file is empty' 
            }, { status: 400 });
        }

        // Find PHP files only in root or 1 level deep
        const phpFiles = decodedEntries.filter(entry => {
            if (!entry.endsWith('.php')) return false;
            if (entry.endsWith('/')) return false;
            
            const parts = entry.split('/').filter(p => p.length > 0);
            return parts.length === 1 || parts.length === 2;
        });

        console.log('[parsePluginZip] Found', phpFiles.length, 'eligible PHP files (root or 1 level deep)');
        console.log('[parsePluginZip] PHP files:', phpFiles);

        if (phpFiles.length === 0) {
            return Response.json({ 
                success: false,
                error: 'No PHP files found in root or first-level directory of ZIP' 
            }, { status: 400 });
        }

        // Search through PHP files for the one with "Plugin Name:" header
        let pluginFile = null;
        let pluginContent = null;

        for (const decodedFilename of phpFiles) {
            try {
                console.log('[parsePluginZip] Checking:', decodedFilename);
                
                const rawKey = fileMapping[decodedFilename];
                
                if (!rawKey) {
                    console.error('[parsePluginZip] ERROR: No raw key found');
                    continue;
                }
                
                const zipEntry = zip.files[rawKey];
                
                if (!zipEntry || zipEntry.dir) {
                    console.log('[parsePluginZip] Entry not found or is directory');
                    continue;
                }
                
                console.log('[parsePluginZip] Reading file as uint8array...');
                
                // Read as uint8array instead of text to avoid encoding issues
                const uint8Content = await zipEntry.async('uint8array');
                console.log('[parsePluginZip] Read uint8array, length:', uint8Content.length);
                
                // Decode to text using TextDecoder
                const decoder = new TextDecoder('utf-8');
                let content = decoder.decode(uint8Content);
                
                console.log('[parsePluginZip] ✅ Decoded to text, length:', content.length);
                console.log('[parsePluginZip] First 300 chars:', content.substring(0, 300));
                
                // Check for Plugin Name header
                const pluginNameMatch = content.match(/Plugin\s+Name:\s*(.+)/i);
                
                if (pluginNameMatch) {
                    console.log('[parsePluginZip] ✅ FOUND main plugin file:', decodedFilename);
                    console.log('[parsePluginZip] Plugin Name:', pluginNameMatch[1].trim());
                    pluginFile = decodedFilename;
                    pluginContent = content;
                    break;
                } else {
                    console.log('[parsePluginZip] No "Plugin Name:" header found in this file');
                }
            } catch (error) {
                console.error('[parsePluginZip] Error reading file:', decodedFilename);
                console.error('[parsePluginZip] Error message:', error.message);
                console.error('[parsePluginZip] Error stack:', error.stack);
            }
        }

        if (!pluginFile || !pluginContent) {
            console.error('[parsePluginZip] ❌ No plugin file with "Plugin Name:" header found');
            console.error('[parsePluginZip] Checked', phpFiles.length, 'PHP files:', phpFiles);
            return Response.json({ 
                success: false,
                error: 'Could not find WordPress plugin file with "Plugin Name:" header in root or first-level directory. Make sure your ZIP contains a valid WordPress plugin.'
            }, { status: 400 });
        }

        // Extract slug from the path
        const pathParts = pluginFile.split('/').filter(p => p.length > 0);
        let slug = '';

        if (pathParts.length === 1) {
            slug = pathParts[0].replace('.php', '');
        } else {
            slug = pathParts[0];
        }

        console.log('[parsePluginZip] Extracted slug:', slug);

        // Parse plugin headers
        const header = {
            slug: slug,
            download_url: file_url
        };

        const patterns = {
            name: /Plugin\s+Name:\s*(.+)/i,
            version: /Version:\s*(.+)/i,
            description: /Description:\s*(.+)/i,
            author: /Author:\s*(.+)/i,
            author_url: /Author\s+URI:\s*(.+)/i,
        };

        for (const [key, regex] of Object.entries(patterns)) {
            const match = pluginContent.match(regex);
            if (match) {
                header[key] = match[1].trim();
                console.log(`[parsePluginZip] ${key}:`, header[key]);
            }
        }

        console.log('[parsePluginZip] === SUCCESS ===');
        console.log('[parsePluginZip] Final header:', header);

        return Response.json({
            success: true,
            plugin: header
        });

    } catch (error) {
        console.error('[parsePluginZip] ❌ UNEXPECTED ERROR:', error.message);
        console.error('[parsePluginZip] Stack:', error.stack);
        return Response.json({ 
            success: false,
            error: 'Unexpected error: ' + error.message,
            stack: error.stack
        }, { status: 500 });
    }
});