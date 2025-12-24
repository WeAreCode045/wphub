const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');
// Accept multiple secret env names: prefer explicit SERVICE_ROLE_KEY, then SUPABASE_SERVICE_ROLE_KEY
const SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.warn('[base44Shim] SUPABASE_URL or SERVICE_ROLE_KEY not set - functions will fail if called without proper env');
}

function tableNameFromEntity(entityName) {
  if (!entityName) return '';
  const name = entityName.toLowerCase();
  if (name.endsWith('s')) return name;
  return `${name}s`;
}

async function supabaseRequest(method, table, query = '', body) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const opts = { method, headers };
  if (body) {
    opts.body = JSON.stringify(body);
    // Ask for representation on updates
    if (method === 'PATCH') headers['Prefer'] = 'return=representation';
  }

  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase request failed ${res.status}: ${text}`);
  }
  const text = await res.text();
  try { return JSON.parse(text || 'null'); } catch { return text; }
}

function buildFilterQuery(params) {
  if (!params || Object.keys(params).length === 0) return '';
  const parts = Object.entries(params).map(([k,v]) => {
    return `${k}=eq.${encodeURIComponent(String(v))}`;
  });
  return `?${parts.join('&')}`;
}

function getBearerTokenFromReq(req) {
  if (!req) return null;
  const headers = req.headers || req || {};
  let authHeader = null;
  if (typeof headers.get === 'function') {
    authHeader = headers.get('authorization') || headers.get('Authorization');
  } else {
    authHeader = headers.authorization || headers.Authorization;
  }
  if (!authHeader) return null;
  const m = authHeader.match(/Bearer\s+(.+)/i);
  return m ? m[1] : null;
}

async function authMeWithToken(token) {
  if (!token) return null;
  // If token equals the service role key, treat as privileged service user
  if (SERVICE_KEY && token === SERVICE_KEY) {
    return {
      id: 'service-role',
      role: 'service_role',
      email: null,
      service_role: true
    };
  }

  // Otherwise validate against Supabase auth endpoint
  const url = `${SUPABASE_URL}/auth/v1/user`;
  const headers = {
    Authorization: `Bearer ${token}`,
    apikey: SERVICE_KEY,
    'Content-Type': 'application/json'
  };
  const res = await fetch(url, { headers });
  if (!res.ok) {
    try { const txt = await res.text(); console.warn('[base44Shim] auth.me failed', res.status, txt); } catch(e){}
    return null;
  }
  try {
    return await res.json();
  } catch { return null; }
}

export function createClientFromRequest(_req) {
  // _req kept for compatibility with original signature
  // build the entities proxy once so we can reuse it for top-level and asServiceRole
  const entitiesProxy = new Proxy({}, {
    get(_, entityName) {
      const table = tableNameFromEntity(entityName);
      return {
        async filter(params) {
          const q = buildFilterQuery(params);
          return await supabaseRequest('GET', table, q);
        },
        async list() {
          return await supabaseRequest('GET', table, '');
        },
        async get(id) {
          const q = `?id=eq.${encodeURIComponent(String(id))}`;
          const data = await supabaseRequest('GET', table, q);
          return Array.isArray(data) ? data[0] : data;
        },
        async create(payload) {
          const res = await supabaseRequest('POST', table, '', payload);
          return res;
        },
        async update(idOrQuery, payload) {
          // if idOrQuery is an id string/number use id filter
          let q = '';
          if (typeof idOrQuery === 'string' || typeof idOrQuery === 'number') {
            q = `?id=eq.${encodeURIComponent(String(idOrQuery))}`;
          } else if (typeof idOrQuery === 'object') {
            q = buildFilterQuery(idOrQuery);
          }
          return await supabaseRequest('PATCH', table, q, payload);
        },
        async delete(id) {
          const q = `?id=eq.${encodeURIComponent(String(id))}`;
          return await supabaseRequest('DELETE', table, q);
        }
      };
    }
  });

  return {
    auth: {
      async me(req) {
        const token = getBearerTokenFromReq(req || _req);
        return await authMeWithToken(token);
      }
    },
    // expose entities at top-level for compatibility with older code that used `base44.entities`.
    entities: entitiesProxy,
    asServiceRole: {
      entities: entitiesProxy
    },
    // minimal functions.invoke stub: logs and returns null. Specific functions should be refactored
    // to not rely on remote invocation or to call underlying implementations directly.
    functions: {
      async invoke(name, payload) {
        console.log('[base44Shim] functions.invoke called for', name);
        // best-effort: try to dynamically import local function module from ./<name>{.js,.ts}
        const tryPaths = [
          `./${name}.js`,
          `./${name}.ts`,
          `./${name}/index.js`,
          `./${name}/index.ts`,
          `./${name}`
        ];
        for (const p of tryPaths) {
          try {
            const mod = await import(p);
            const fn = mod.invoke || mod.handler || mod.default;
            if (typeof fn === 'function') {
              try {
                return await fn(payload);
              } catch (err) {
                console.error('[base44Shim] invoked module threw:', err);
                throw err;
              }
            }
          } catch (err) {
            // ignore import errors and try next path
            // console.debug('[base44Shim] import failed for', p, err.message);
          }
        }
        console.warn('[base44Shim] functions.invoke: no local handler found for', name, '- falling back to remote functions endpoint');

        // Fallback: call the Supabase Edge Functions HTTP endpoint directly using the service role key
        if (!SUPABASE_URL || !SERVICE_KEY) {
          console.error('[base44Shim] cannot call remote function: SUPABASE_URL or SERVICE_KEY missing');
          return null;
        }

        try {
          const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${encodeURIComponent(name)}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SERVICE_KEY,
              'Authorization': `Bearer ${SERVICE_KEY}`
            },
            body: JSON.stringify(payload || {})
          });

          const text = await res.text();
          let parsed;
          try { parsed = text ? JSON.parse(text) : null; } catch(e) { parsed = text; }

          if (!res.ok) {
            console.error('[base44Shim] remote function call failed', res.status, parsed);
            // throw an Error with attached response for callers to inspect
            const err = new Error(`Remote function ${name} failed: ${res.status}`);
            err.response = parsed;
            throw err;
          }

          return parsed;
        } catch (err) {
          console.error('[base44Shim] remote invoke error:', err?.message || err);
          return null;
        }
      }
    },
    // minimal integrations shim
    integrations: {
      Core: {
        async UploadFile({ file, bucket = 'uploads' } = {}) {
          if (!file) throw new Error('No file provided to UploadFile');
          // normalize to Uint8Array
          let bytes;
          try {
            if (typeof Blob !== 'undefined' && file instanceof Blob) {
              bytes = new Uint8Array(await file.arrayBuffer());
            } else if (file.arrayBuffer && typeof file.arrayBuffer === 'function') {
              bytes = new Uint8Array(await file.arrayBuffer());
            } else if (file instanceof Uint8Array) {
              bytes = file;
            } else if (file.buffer && file.buffer instanceof ArrayBuffer) {
              bytes = new Uint8Array(file.buffer);
            } else if (file.data && (file.data instanceof Uint8Array)) {
              bytes = file.data;
            } else {
              throw new Error('Unsupported file type for UploadFile');
            }
          } catch (e) {
            console.warn('[base44Shim] failed to read file bytes:', e);
            throw e;
          }

          const name = (file.name && String(file.name)) || `upload-${Date.now()}`;
          const path = `${Date.now()}-${name}`;
          const uploadUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`;

          const headers = {
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
            'Content-Type': (file.type || 'application/octet-stream')
          };

          const res = await fetch(uploadUrl, {
            method: 'PUT',
            headers,
            body: bytes
          });

          if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error(`Supabase storage upload failed ${res.status}: ${txt}`);
          }

          // public URL for the object (assuming bucket is configured for public access as per setup script)
          const publicUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`;
          return { file_url: publicUrl, path };
        }
      }
    }
  };
}

export default { createClientFromRequest };