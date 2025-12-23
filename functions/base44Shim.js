const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY');

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
  return {
    auth: {
      async me(req) {
        const token = getBearerTokenFromReq(req || _req);
        return await authMeWithToken(token);
      }
    },
    asServiceRole: {
      entities: new Proxy({}, {
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
      })
    }
  };
}

export default { createClientFromRequest };
