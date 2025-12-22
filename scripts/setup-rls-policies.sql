-- Row Level Security (RLS) Policies voor Supabase tabellen

-- Enable RLS op alle tabellen
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_installations ENABLE ROW LEVEL SECURITY;

-- Voor nu: Service Role bypass (alle operaties toegestaan via service role key)
-- Dit is veilig omdat je Service Role Key gebruikt in backend calls
-- Later kunnen specifieke policies toegevoegd worden per tabel

-- Voorbeeld policies (optioneel, voor als je client-side auth wilt):

-- Users tabel: users kunnen hun eigen data lezen/updaten
-- CREATE POLICY "Users can view own data" ON users
--   FOR SELECT
--   USING (auth.uid()::text = id);

-- CREATE POLICY "Users can update own data" ON users
--   FOR UPDATE
--   USING (auth.uid()::text = id);

-- Sites tabel: users kunnen hun eigen sites beheren
-- CREATE POLICY "Users can view own sites" ON sites
--   FOR SELECT
--   USING (owner_type = 'user' AND owner_id = auth.uid()::text);

-- CREATE POLICY "Users can manage own sites" ON sites
--   FOR ALL
--   USING (owner_type = 'user' AND owner_id = auth.uid()::text);

-- Voor admin interface: gebruik Service Role Key (SUPABASE_SERVICE_ROLE_KEY)
-- Deze key bypass alle RLS policies automatisch
