-- WPHub Supabase Schema
-- Gegenereerd voor migratie van Base44 naar Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users tabel (van Base44 auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  company TEXT,
  phone TEXT,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  email_notifications BOOLEAN DEFAULT true,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  two_fa_verified_session TEXT,
  stripe_customer_id TEXT,
  app_id TEXT,
  _app_role TEXT,
  is_service BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  disabled BOOLEAN DEFAULT false,
  mailboxes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams tabel (verplaatst naar boven omdat sites ernaar verwijst)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT,
  avatar_url TEXT,
  members JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  inbox_id TEXT,
  is_blocked BOOLEAN DEFAULT false,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites tabel
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  api_key TEXT UNIQUE,
  owner_type TEXT,
  owner_id TEXT,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  shared_with_teams TEXT[] DEFAULT ARRAY[]::TEXT[],
  connection_status TEXT DEFAULT 'unknown',
  connection_checked_at TIMESTAMPTZ,
  wp_version TEXT,
  transfer_request JSONB,
  health_check JSONB,
  health_alerts_enabled BOOLEAN DEFAULT true,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plugins tabel
CREATE TABLE IF NOT EXISTS plugins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  author TEXT,
  author_url TEXT,
  icon_url TEXT,
  owner_type TEXT,
  owner_id TEXT,
  source TEXT DEFAULT 'upload',
  versions JSONB DEFAULT '[]'::jsonb,
  latest_version TEXT,
  installed_on JSONB DEFAULT '[]'::jsonb,
  shared_with_teams TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_disabled BOOLEAN DEFAULT false,
  disabled_reason TEXT,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Themes tabel
CREATE TABLE IF NOT EXISTS themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  author TEXT,
  author_url TEXT,
  screenshot_url TEXT,
  owner_type TEXT,
  owner_id TEXT,
  source TEXT DEFAULT 'upload',
  versions JSONB DEFAULT '[]'::jsonb,
  latest_version TEXT,
  installed_on JSONB DEFAULT '[]'::jsonb,
  shared_with_teams TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_disabled BOOLEAN DEFAULT false,
  disabled_reason TEXT,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Roles tabel
CREATE TABLE IF NOT EXISTS team_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  team_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT,
  permissions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  assigned_count INTEGER DEFAULT 0,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members tabel
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT,
  role_id UUID REFERENCES team_roles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects tabel
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  team_id TEXT,
  site_id TEXT,
  inbox_id TEXT,
  status TEXT DEFAULT 'planning',
  start_date DATE,
  end_date DATE,
  priority TEXT DEFAULT 'medium',
  assigned_members JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  timeline_events JSONB DEFAULT '[]'::jsonb,
  template_id TEXT,
  plugins JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Templates tabel
CREATE TABLE IF NOT EXISTS project_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  team_id TEXT,
  plugins JSONB DEFAULT '[]'::jsonb,
  icon TEXT,
  color TEXT,
  is_public BOOLEAN DEFAULT false,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages tabel
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  sender_id TEXT,
  sender_email TEXT,
  sender_name TEXT,
  to_mailbox_id TEXT,
  from_mailbox_id TEXT,
  from_admin_outbox BOOLEAN DEFAULT false,
  thread_id TEXT,
  reply_to_message_id TEXT,
  original_message_quote TEXT,
  recipient_type TEXT,
  recipient_id TEXT,
  recipient_ids JSONB DEFAULT '[]'::jsonb,
  recipient_email TEXT,
  team_id TEXT,
  context JSONB,
  category TEXT,
  priority TEXT,
  status TEXT DEFAULT 'sent',
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]'::jsonb,
  replies JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications tabel
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  recipient_id TEXT,
  recipient_ids JSONB DEFAULT '[]'::jsonb,
  recipient_email TEXT,
  recipient_type TEXT DEFAULT 'user',
  team_id TEXT,
  team_ids JSONB DEFAULT '[]'::jsonb,
  team_invite_id TEXT,
  sender_id TEXT,
  sender_name TEXT,
  context JSONB,
  is_read BOOLEAN DEFAULT false,
  replies JSONB DEFAULT '[]'::jsonb,
  reply_to_notification_id TEXT,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Logs tabel
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support Tickets tabel
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  ticket_number TEXT UNIQUE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  submitter_id TEXT,
  submitter_email TEXT,
  submitter_name TEXT,
  assigned_to TEXT,
  responses JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  last_updated TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription Plans tabel
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  group_id TEXT,
  stripe_product_id TEXT,
  stripe_price_id_monthly TEXT,
  stripe_price_id_annual TEXT,
  features JSONB DEFAULT '{}'::jsonb,
  monthly_price_amount INTEGER,
  annual_price_amount INTEGER,
  currency TEXT DEFAULT 'EUR',
  vat_rate_percentage DECIMAL(5,2) DEFAULT 21,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  trial_days INTEGER DEFAULT 0,
  is_highlighted BOOLEAN DEFAULT false,
  highlight_label TEXT,
  annual_discount_percentage DECIMAL(5,2),
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Subscriptions tabel
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  user_id TEXT,
  plan_id TEXT,
  is_manual BOOLEAN DEFAULT false,
  assigned_by TEXT,
  manual_end_date TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  interval TEXT,
  amount INTEGER,
  currency TEXT DEFAULT 'EUR',
  vat_percentage DECIMAL(5,2) DEFAULT 21,
  discount_code_used TEXT,
  usage_tracking JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices tabel
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  invoice_number TEXT UNIQUE,
  user_id TEXT,
  user_email TEXT,
  user_name TEXT,
  subscription_id TEXT,
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  amount INTEGER,
  subtotal INTEGER,
  vat_amount INTEGER,
  vat_percentage DECIMAL(5,2) DEFAULT 21,
  currency TEXT DEFAULT 'EUR',
  plan_name TEXT,
  billing_period TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  description TEXT,
  billing_address JSONB,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Site Settings tabel
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  description TEXT,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connectors tabel (voor WPHub connector plugin versies)
CREATE TABLE IF NOT EXISTS connectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  version TEXT NOT NULL,
  file_url TEXT,
  file_uri TEXT,
  plugin_code TEXT,
  description TEXT,
  created_by TEXT,
  created_by_id TEXT,
  is_sample BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plugin Installations tabel
CREATE TABLE IF NOT EXISTS plugin_installations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_id TEXT UNIQUE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
  version TEXT,
  status TEXT DEFAULT 'installed',
  is_active BOOLEAN DEFAULT false,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, plugin_id)
);

-- Indexes voor betere performance
CREATE INDEX IF NOT EXISTS idx_sites_owner ON sites(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_sites_team ON sites(team_id);
CREATE INDEX IF NOT EXISTS idx_plugins_owner ON plugins(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_themes_owner ON themes(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_team ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_site ON projects(site_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_team ON messages(team_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_team ON notifications(team_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);

-- Triggers voor updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Voeg triggers toe aan alle tabellen
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_plugins_updated_at BEFORE UPDATE ON plugins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_themes_updated_at BEFORE UPDATE ON themes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_roles_updated_at BEFORE UPDATE ON team_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_project_templates_updated_at BEFORE UPDATE ON project_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activity_logs_updated_at BEFORE UPDATE ON activity_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_connectors_updated_at BEFORE UPDATE ON connectors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_plugin_installations_updated_at BEFORE UPDATE ON plugin_installations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies kunnen later worden toegevoegd
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- etc.
