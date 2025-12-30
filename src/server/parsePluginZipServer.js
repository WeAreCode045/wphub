#!/usr/bin/env node
import http from 'http';
import JSZip from 'jszip';
import fetch from 'node-fetch';

// Minimal server handler for parsing plugin ZIPs.
// Accepts POST /api/parsePluginZip with JSON body: { file_url }

async function parsePluginZip(fileUrl) {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Failed to fetch ${fileUrl}: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const fileNames = Object.keys(zip.files);
  // try to read main plugin php file to extract headers (Name, Version)
  let pluginMeta = { name: null, version: null, author: null };
  for (const name of fileNames) {
    if (name.endsWith('.php')) {
      try {
        const content = await zip.file(name).async('string');
        const nameMatch = content.match(/^[ \t\/*#@\n\r]*\*?\s*Name:\s*(.+)$/mi);
        const versionMatch = content.match(/^[ \t\/*#@\n\r]*\*?\s*Version:\s*(.+)$/mi);
        const authorMatch = content.match(/^[ \t\/*#@\n\r]*\*?\s*Author:\s*(.+)$/mi);
        if (nameMatch) pluginMeta.name = nameMatch[1].trim();
        if (versionMatch) pluginMeta.version = versionMatch[1].trim();
        if (authorMatch) pluginMeta.author = authorMatch[1].trim();
        if (pluginMeta.name || pluginMeta.version) break;
      } catch (e) {
        // ignore
      }
    }
  }

  return { fileNames, pluginMeta };
}

function jsonResponse(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/parsePluginZip') {
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const data = JSON.parse(body || '{}');
      const { file_url: fileUrl } = data;
      if (!fileUrl) return jsonResponse(res, 400, { success: false, error: 'file_url required' });

      const result = await parsePluginZip(fileUrl);
      return jsonResponse(res, 200, { success: true, ...result });
    } catch (err) {
      return jsonResponse(res, 500, { success: false, error: String(err) });
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

if (process.env.NODE_ENV !== 'test') {
  const port = process.env.PORT || 3001;
  server.listen(port, () => console.log(`parsePluginZipServer listening on http://localhost:${port}`));
}

export { parsePluginZip };
