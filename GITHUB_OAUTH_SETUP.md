# GitHub OAuth Setup for WP Hub

Follow these steps to enable GitHub sign-in via Supabase:

1. Go to https://github.com/settings/developers and click **New OAuth App**.
2. Fill in:
   - **Application name**: WP Hub
   - **Homepage URL**: `http://localhost:5173` (dev) or `https://your-domain` (prod)
   - **Authorization callback URL**: `https://ossyxxlplvqakowiwbok.supabase.co/auth/v1/callback`
3. Register the application and save the **Client ID** and **Client Secret**.

4. In Supabase Dashboard → **Authentication** → **Providers**, open **GitHub** and:
   - Enable GitHub sign in
   - Paste the Client ID and Client Secret
   - Save

5. Add redirect URLs in **Authentication → URL Configuration** (see `GOOGLE_OAUTH_SETUP.md`).

6. Test locally by running `npm run dev` and visiting `http://localhost:5173/login`, then click **Doorgaan met GitHub**.

Notes:
- For organization-scoped apps you may need additional permissions.
- Ensure the callback URL exactly matches the one configured in Supabase.
