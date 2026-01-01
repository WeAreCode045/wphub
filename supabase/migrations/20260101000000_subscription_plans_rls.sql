-- Enable RLS on subscription_plans table
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to SELECT (view) subscription plans
CREATE POLICY "Allow public read access to subscription_plans"
  ON subscription_plans
  FOR SELECT
  USING (active = true);

-- Allow authenticated users to SELECT all subscription plans (including inactive)
CREATE POLICY "Allow authenticated users to view all subscription_plans"
  ON subscription_plans
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow admin users to INSERT subscription plans
CREATE POLICY "Allow admin users to create subscription_plans"
  ON subscription_plans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Allow admin users to UPDATE subscription plans
CREATE POLICY "Allow admin users to update subscription_plans"
  ON subscription_plans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Allow admin users to DELETE subscription plans
CREATE POLICY "Allow admin users to delete subscription_plans"
  ON subscription_plans
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
