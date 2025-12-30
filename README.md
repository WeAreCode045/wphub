# Base44 Preview Template for MicroVM sandbox

This template is used by the server to preview user-apps.

## user files
server creates the user-app files in the __components__, __pages__ folders

## server injected data
server injects app related data to __app.config.js__, which is used by App.jsx to render the components in the files.


## Shim removal and migration notes

- The previous Base44 compatibility shim has been removed from the codebase now that the database uses the canonical Supabase `id` values.
- Frontend code no longer uses the Base44 shim; server-side compatibility is provided by `supabase/functions/supabaseClientServer.js` for edge functions that still expect a `createClientFromRequest` shape.
- Migration scripts that referenced Base44 are archived under `scripts/migration-archive/`.
- A number of `.bak` backup files created during batch edits were removed from the workspace; if you need the backups for rollback, please restore from your VCS history or contact the team.

If you run into issues with server functions, consider migrating individual functions to use a canonical server-side client implementation (see `src/api/supabaseClientDirect.js`) instead of the compatibility bridge.

## Production: Supabase Service Role Key

This project requires a Supabase Service Role Key for server-side operations (Edge Functions, scripts).
Do NOT expose this key to the browser. Do NOT add it to client-side `VITE_` variables in production.

- Recommended: set the secret in Supabase (Edge Functions) or your host/CI environment.

Example: set as a Supabase secret (preferred):

```bash
supabase secrets set SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY> --project-ref ossyxxlplvqakowiwbok
```

Verify the key (service key is not a user JWT — a 200 response is not required for `/auth/v1/user`):

```bash
curl -i -X GET "https://ossyxxlplvqakowiwbok.supabase.co/auth/v1/user" \
  -H "apikey: <YOUR_SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <YOUR_SERVICE_ROLE_KEY>"
```

If you deploy with Docker or a host that requires env vars at runtime, expose only a runtime env in the host (not baked into the client build):

```bash
# example: docker run
docker run -e SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" -p 80:80 your-image:tag
```

CI/Host tips:
- On CI (GitHub Actions/GitLab CI), set the secret in the repository/organization secret store and inject it during deploy/test steps.
- For Fly, Vercel, or similar, add the secret in the project settings as a runtime secret.

Nginx proxy note:
- `nginx.conf` already forwards `Authorization` to the Supabase functions endpoint using `proxy_set_header Authorization $http_authorization;` — ensure your host forwards headers if you use a different proxy.

Security reminder:
- Never commit the service role key to the repository. Remove any `VITE_SUPABASE_SERVICE_ROLE_KEY` from production builds.
# Base44 Preview Template for MicroVM sandbox

This template is used by the server to preview user-apps.

## user files
server creates the user-app files in the __components__, __pages__ folders

## server injected data
server injects app related data to __app.config.js__, which is used by App.jsx to render the components in the files.
