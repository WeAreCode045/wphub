# Supabase Authenticatie Setup 🔐

## Wat is er geconfigureerd?

### 1. Login Pagina
- **Route:** `/login`
- **Features:**
  - Email/wachtwoord login
  - Registratie functionaliteit
  - Automatische redirect naar `/dashboard` na login
  - Error handling met duidelijke meldingen

### 2. Protected Routes
Alle pagina's behalve `/login` zijn nu beveiligd:
- Niet-ingelogde users worden automatisch naar `/login` geredirect
- Na login wordt je teruggestuurd naar de pagina waar je wilde zijn

### 3. Logout Functionaliteit
- Logout knop in user menu (rechts boven)
- Maakt sessie ongeldig en redirect naar `/login`

### 4. User Synchronisatie (Bidirectioneel)
Users in `public.users` tabel zijn automatisch gelinkt aan `auth.users`:

**Database Triggers (voer uit in Supabase SQL Editor):**
```bash
# Voer dit SQL script uit in Supabase
cat scripts/sync-auth-users.sql
```

Dit zorgt voor:
- ✅ **Auth → Users:** Automatisch user record aanmaken bij signup
- ✅ **Users → Auth:** Automatisch auth user aanmaken bij user insert
- ✅ Email sync tussen auth.users en public.users
- ✅ Automatisch verwijderen bij account delete
- ✅ Linking van bestaande gemigreerde users

**Bestaande users synchroniseren:**
```bash
npm run sync-users-to-auth
```

Dit maakt auth accounts aan voor alle users die nog geen auth account hebben.

## Setup Stappen

### Stap 1: Voer SQL Scripts uit in Supabase

Ga naar [Supabase SQL Editor](https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/sql/new)

**A. Auth Synchronisatie:**
```sql
-- Plak inhoud van scripts/sync-auth-users.sql
```

**B. Storage Bucket (voor file uploads):**
```sql
-- Plak inhoud van scripts/setup-supabase-storage.sql
```

**C. Row Level Security (optioneel voor productie):**
```sql
-- Plak inhoud van scripts/setup-rls-policies.sql
```

### Stap 2: Sync bestaande users naar Auth

Als je al users hebt in de database (van de Base44 migratie):

```bash
npm run sync-users-to-auth
```

Dit maakt auth accounts aan voor alle bestaande users.

### Stap 3: Maak een Admin User aan

```bash
npm run create-admin
```

Volg de prompts:
- Email: `admin@example.com`
- Wachtwoord: `[veilig wachtwoord]`
- Naam: `Admin User`

### Stap 4: Configureer Supabase Auth Settings

In [Supabase Dashboard → Authentication → Settings](https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/auth/settings):

**Email Confirmatie uitschakelen (voor development):**
- Enable Email Confirmations: ❌ **UIT**
- Dit zorgt dat users direct kunnen inloggen na signup

**Site URL instellen:**
- Site URL: `http://localhost:5173`
- Redirect URLs: `http://localhost:5173/**`

Voor productie:
- Site URL: `https://jouw-productie-url.com`
- Redirect URLs: `https://jouw-productie-url.com/**`

### Stap 5: Test de Login

```bash
npm run dev
```

1. Ga naar http://localhost:5173
2. Je wordt automatisch geredirect naar `/login`
3. Log in met je admin account
4. Je wordt geredirect naar `/dashboard`

## User Flow

```
┌─────────────────────────────────────────────────┐
│  User bezoekt /dashboard (of andere pagina)    │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  Authenticated?     │
         └─────────┬───────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
      ✅ YES              ❌ NO
         │                   │
         ▼                   ▼
┌─────────────────┐  ┌──────────────────┐
│  Show Page      │  │  Redirect to     │
│  (Dashboard)    │  │  /login          │
└─────────────────┘  └────────┬─────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  Login Form     │
                     └────────┬────────┘
                              │
                   ┌──────────┴──────────┐
                   │ Login / Signup      │
                   └──────────┬──────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  Supabase Auth  │
                     │  (creates       │
                     │   auth.user)    │
                     └────────┬────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  Database       │
                     │  Trigger        │
                     │  (creates       │
                     │   public.user)  │
                     └────────┬────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  Redirect to    │
                     │  /dashboard     │
                     └─────────────────┘
```

## Database Schema

### auth.users (Supabase managed)
- `id` (UUID) - Primary key
- `email` (text)
- `encrypted_password` (text)
- `raw_user_meta_data` (jsonb) - Bevat full_name, role, etc.
- `created_at` (timestamp)

### public.users (Jouw app data)
- `id` (UUID) - Linked aan auth.users.id
- `email` (text)
- `full_name` (text)
- `role` (text) - 'admin' of 'user'
- `status` (text) - 'active', 'inactive', etc.
- `avatar_url` (text)
- `company` (text)
- `phone` (text)
- `two_fa_enabled` (boolean)
- `created_at` (timestamp)
- `updated_at` (timestamp)

## API Gebruik

### Login (automatisch via form)
```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});
```

### Signup (automatisch via form)
```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: {
      full_name: 'John Doe',
      role: 'user'
    }
  }
});
```

### Get Current User
```javascript
const { data: { user } } = await supabase.auth.getUser();

// Of via adapter
const user = await base44.auth.me();
```

### Logout
```javascript
await supabase.auth.signOut();

// Of via adapter
await base44.auth.logout();
```

### Check Session
```javascript
const { data: { session } } = await supabase.auth.getSession();
```

## Beveiliging

### RLS Policies (optioneel)
Row Level Security zorgt ervoor dat users alleen hun eigen data kunnen zien/wijzigen:

```sql
-- Users kunnen alleen hun eigen profiel zien
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Users kunnen alleen hun eigen profiel updaten
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = id);
```

### Service Role Key
Je app gebruikt momenteel de **Service Role Key** die alle RLS policies bypass.

Voor productie:
1. Gebruik **Publishable Key** voor client-side code
2. Gebruik **Service Role Key** alleen voor server-side/admin operaties
3. Activeer RLS policies via `scripts/setup-rls-policies.sql`

## Troubleshooting

### "Invalid login credentials"
- Controleer of email en wachtwoord correct zijn
- Controleer of user bestaat in auth.users
- Check Supabase Dashboard → Authentication → Users

### "User not found in database"
- Voer `scripts/sync-auth-users.sql` uit
- Trigger is niet actief
- Check `public.users` tabel in Supabase Dashboard

### "Email confirmation required"
- Ga naar Supabase → Auth → Settings
- Zet "Enable Email Confirmations" UIT voor development

### Session blijft niet behouden
- Check of cookies enabled zijn in browser
- Check Site URL in Supabase settings
- Clear browser cache/localStorage

### Redirect loop
- Check of ProtectedRoute component correct werkt
- Check of auth.getSession() response klopt
- Check browser console voor errors

## Next Steps

### Voor Development
- [x] Login pagina
- [x] Protected routes
- [x] User synchronisatie
- [ ] Password reset flow
- [ ] Email verificatie
- [ ] Social login (Google, GitHub)

### Voor Productie
- [ ] RLS policies activeren
- [ ] Service Role Key alleen server-side gebruiken
- [ ] HTTPS enforced
- [ ] Email templates customizen
- [ ] Rate limiting configureren
- [ ] 2FA implementatie (bestaande code hergebruiken)

## Bestanden

### Nieuwe bestanden:
- `src/pages/Login.jsx` - Login/signup pagina
- `src/components/ProtectedRoute.jsx` - Route beveiliging
- `scripts/sync-auth-users.sql` - Database triggers voor user sync
- `scripts/create-admin-user.js` - Admin user aanmaken

### Aangepaste bestanden:
- `src/App.jsx` - Protected routes toegevoegd
- `src/Layout.jsx` - Logout functionaliteit
- `src/api/supabaseAdapter.js` - Auth.logout() method
- `src/pages.config.js` - Login route toegevoegd
- `package.json` - create-admin script

## Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase Dashboard](https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok)
- [React Router Protected Routes](https://reactrouter.com/en/main/start/tutorial#protected-routes)

---

✅ **Setup compleet! Je app heeft nu volledige authenticatie met Supabase.**
