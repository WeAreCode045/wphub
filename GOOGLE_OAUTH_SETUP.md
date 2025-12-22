# Google OAuth Setup voor WP Hub

## Stap 1: Google Cloud Console

1. Ga naar [Google Cloud Console](https://console.cloud.google.com/)
2. Maak een nieuw project aan of selecteer een bestaand project
3. Ga naar **APIs & Services** > **Credentials**
4. Klik op **Create Credentials** > **OAuth client ID**
5. Kies **Web application** als applicatie type
6. Vul de volgende gegevens in:
   - **Name**: WP Hub
   - **Authorized JavaScript origins**: 
     - `http://localhost:5173` (voor development)
     - `https://jouw-domein.nl` (voor productie)
   - **Authorized redirect URIs**:
     - `https://ossyxxlplvqakowiwbok.supabase.co/auth/v1/callback`
     - `http://localhost:5173/auth/callback` (optioneel voor local testing)

7. Klik op **Create**
8. Kopieer de **Client ID** en **Client Secret**

## Stap 2: Supabase Dashboard

1. Ga naar [Supabase Dashboard](https://app.supabase.com/)
2. Selecteer je project: **ossyxxlplvqakowiwbok**
3. Ga naar **Authentication** > **Providers**
4. Scroll naar **Google** en klik erop
5. Schakel **Enable Sign in with Google** in
6. Vul de gegevens in:
   - **Client ID**: Plak de Client ID van Google
   - **Client Secret**: Plak de Client Secret van Google
7. Klik op **Save**

## Stap 3: Site URL configureren (indien nodig)

1. In Supabase Dashboard: **Authentication** > **URL Configuration**
2. Zet de **Site URL** op:
   - Development: `http://localhost:5173`
   - Productie: `https://jouw-domein.nl`
3. Voeg **Redirect URLs** toe:
   - `http://localhost:5173/dashboard`
   - `https://jouw-domein.nl/dashboard`

## Testen

1. Start de development server: `npm run dev`
2. Ga naar `http://localhost:5173/login`
3. Klik op **Doorgaan met Google**
4. Log in met je Google account
5. Je wordt doorgestuurd naar `/dashboard`

## Troubleshooting

### Error: "redirect_uri_mismatch"
- Controleer of de redirect URI in Google Cloud Console exact overeenkomt met de Supabase callback URL
- Zorg dat er geen extra spaties of trailing slashes zijn

### Error: "Invalid login credentials"
- Controleer of de Client ID en Client Secret correct zijn ingevoerd in Supabase
- Ververs de pagina en probeer opnieuw

### Gebruiker wordt niet aangemaakt in database
- Check of de database trigger `handle_auth_user_created` actief is
- Controleer de Supabase logs: **Database** > **Logs**

## Automatische user sync

De database trigger `handle_auth_user_created` zorgt automatisch voor:
- Aanmaken van een user record in de `public.users` tabel
- Koppelen van auth.users aan public.users via `id`
- Automatisch invullen van email en metadata

Geen extra configuratie nodig! 🎉
