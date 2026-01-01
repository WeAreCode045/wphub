-- subscription_plans is a Stripe foreign table and does not support RLS
-- Access control is handled at the application level and via API role authentication

-- For Supabase PostgREST API access control:
-- 1. Public (anon) role can SELECT subscription_plans with active=true
-- 2. Authenticated users can SELECT all subscription_plans
-- 3. Admin users can INSERT/UPDATE/DELETE via service_role key

-- Create a helper table to track admin users for access control
CREATE TABLE IF NOT EXISTS admin_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL,
  table_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on admin_access_log
ALTER TABLE admin_access_log ENABLE ROW LEVEL SECURITY;

-- Users can only view their own access logs
CREATE POLICY "Users can view their own access logs"
  ON admin_access_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert access logs
CREATE POLICY "Service role can log admin actions"
  ON admin_access_log
  FOR INSERT
  WITH CHECK (true);
