// Shared helpers for Supabase Edge Functions
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.warn('[supabase/functions] SUPABASE_URL or SERVICE_ROLE_KEY not set - functions will fail without env');
}

export async function authMeWithToken(token: string | null) {
  if (!token) return null;
  // If token equals the service role key, treat as privileged service user
  if (SERVICE_KEY && token === SERVICE_KEY) {
    return { id: 'service-role', role: 'service_role', email: null, service_role: true };
  }
  const url = `${SUPABASE_URL}/auth/v1/user`;
  const headers: Record<string,string> = {
    Authorization: `Bearer ${token}`,
    apikey: SERVICE_KEY,
    'Content-Type': 'application/json'
  };
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

export async function uploadToStorage(fileName: string, bytes: Uint8Array, bucket = 'uploads', contentType = 'application/octet-stream') {
  const path = `${Date.now()}-${fileName}`;
  const uploadUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`;
  const headers: Record<string,string> = {
    Authorization: `Bearer ${SERVICE_KEY}`,
    apikey: SERVICE_KEY,
    'Content-Type': contentType
  };
  const res = await fetch(uploadUrl, { method: 'PUT', headers, body: bytes });
  if (!res.ok) {
    const txt = await res.text().catch(()=>'');
    throw new Error(`Supabase storage upload failed ${res.status}: ${txt}`);
  }
  const publicUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`;
  return { file_url: publicUrl, path };
}

export function extractBearerFromReq(req: Request) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const m = auth.match(/Bearer\s+(.+)/i);
  return m ? m[1] : null;
}

export function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export default {};
