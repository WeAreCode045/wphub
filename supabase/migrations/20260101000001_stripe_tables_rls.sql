-- Enable RLS on Stripe tables and create access policies
-- These tables are foreign tables from Stripe, but we can still define policies

-- user_subscriptions table policies
-- Allow authenticated users to view their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON user_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.stripe_customer_id = user_subscriptions.customer
    )
  );

-- Allow service role and functions to manage subscriptions
CREATE POLICY "Service role can manage all subscriptions"
  ON user_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');

-- invoices table policies
-- Allow authenticated users to view their own invoices
CREATE POLICY "Users can view their own invoices"
  ON invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.stripe_customer_id = invoices.customer
    )
  );

-- Allow service role to manage invoices
CREATE POLICY "Service role can manage all invoices"
  ON invoices
  FOR ALL
  USING (auth.role() = 'service_role');

-- customers table policies
-- Allow authenticated users to view their own customer record
CREATE POLICY "Users can view their own customer record"
  ON customers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.stripe_customer_id = customers.id
    )
  );

-- Allow service role to manage customers
CREATE POLICY "Service role can manage all customers"
  ON customers
  FOR ALL
  USING (auth.role() = 'service_role');

-- subscription_plans table policies (already defined but including here for completeness)
-- Public access to active plans (for pricing page)
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans
  FOR SELECT
  USING (active = true);

-- Authenticated users can view all plans
CREATE POLICY "Authenticated users can view all subscription plans"
  ON subscription_plans
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- prices table policies
-- Anyone can view prices (needed for checkout)
CREATE POLICY "Anyone can view prices"
  ON prices
  FOR SELECT
  USING (true);

-- Service role can manage prices
CREATE POLICY "Service role can manage prices"
  ON prices
  FOR ALL
  USING (auth.role() = 'service_role');

-- checkout_sessions table policies
-- Allow authenticated users to view their own sessions
CREATE POLICY "Users can view their own checkout sessions"
  ON checkout_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.stripe_customer_id = checkout_sessions.customer
        OR users.id::text = checkout_sessions.attrs->>'user_id'
      )
    )
  );

-- Service role can manage checkout sessions
CREATE POLICY "Service role can manage checkout sessions"
  ON checkout_sessions
  FOR ALL
  USING (auth.role() = 'service_role');
