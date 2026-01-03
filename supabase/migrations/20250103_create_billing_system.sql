-- ============================================================================
-- BILLING SYSTEM MIGRATION
-- Supabase + Stripe Integration
-- ============================================================================

-- ============================================================================
-- 1. USERS TABLE EXTENSION
-- Add Stripe customer ID to public.users (linked to auth.users)
-- Note: Cannot modify auth.users table directly in Supabase
-- Use public.users table instead, which is linked to auth.users via id
-- ============================================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user',
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id 
ON public.users(stripe_customer_id);

-- ============================================================================
-- 2. SUBSCRIPTION PLANS (Admin-managed)
-- Maps to Stripe Products and Prices
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id BIGSERIAL PRIMARY KEY,
  stripe_product_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_price_monthly_id VARCHAR(255),
  stripe_price_yearly_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_subscription BOOLEAN NOT NULL DEFAULT true,
  monthly_price_cents INTEGER, -- informational only, Stripe is source of truth
  yearly_price_cents INTEGER,  -- informational only, Stripe is source of truth
  trial_days INTEGER DEFAULT 14,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_product_id 
ON public.subscription_plans(stripe_product_id);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_public 
ON public.subscription_plans(is_public) WHERE is_public = true;

-- ============================================================================
-- 3. STRIPE SYNC SCHEMA
-- Read-only synchronized data from Stripe
-- These tables are populated by the Stripe Sync Engine
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS stripe;

-- Customers (synced from Stripe)
CREATE TABLE IF NOT EXISTS stripe.customers (
  id VARCHAR(255) PRIMARY KEY,
  object VARCHAR(50) NOT NULL,
  created BIGINT NOT NULL,
  email VARCHAR(255),
  metadata JSONB,
  description VARCHAR(1024),
  currency VARCHAR(3),
  default_source VARCHAR(255),
  delinquent BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_email 
ON stripe.customers(email);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_metadata 
ON stripe.customers USING GIN(metadata);

-- Products (synced from Stripe)
CREATE TABLE IF NOT EXISTS stripe.products (
  id VARCHAR(255) PRIMARY KEY,
  object VARCHAR(50) NOT NULL,
  created BIGINT NOT NULL,
  updated BIGINT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  metadata JSONB,
  type VARCHAR(50),
  url VARCHAR(1024),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_products_active 
ON stripe.products(active) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_stripe_products_metadata 
ON stripe.products USING GIN(metadata);

-- Prices (synced from Stripe)
CREATE TABLE IF NOT EXISTS stripe.prices (
  id VARCHAR(255) PRIMARY KEY,
  object VARCHAR(50) NOT NULL,
  created BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  custom_unit_amount JSONB,
  livemode BOOLEAN DEFAULT false,
  lookup_key VARCHAR(255),
  metadata JSONB,
  nickname VARCHAR(255),
  product_id VARCHAR(255) REFERENCES stripe.products(id),
  recurring JSONB,
  tax_behavior VARCHAR(50),
  tiers_mode VARCHAR(50),
  type VARCHAR(50),
  unit_amount BIGINT,
  unit_amount_decimal VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add product_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'stripe' 
    AND table_name = 'prices' 
    AND column_name = 'product_id'
  ) THEN
    ALTER TABLE stripe.prices ADD COLUMN product_id VARCHAR(255);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stripe_prices_product_id 
ON stripe.prices(product_id);

CREATE INDEX IF NOT EXISTS idx_stripe_prices_lookup_key 
ON stripe.prices(lookup_key);

-- Subscriptions (synced from Stripe)
CREATE TABLE IF NOT EXISTS stripe.subscriptions (
  id VARCHAR(255) PRIMARY KEY,
  object VARCHAR(50) NOT NULL,
  created BIGINT NOT NULL,
  customer_id VARCHAR(255) NOT NULL REFERENCES stripe.customers(id),
  status VARCHAR(50) NOT NULL,
  current_period_start BIGINT NOT NULL,
  current_period_end BIGINT NOT NULL,
  ended_at BIGINT,
  cancel_at BIGINT,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at BIGINT,
  items JSONB NOT NULL,
  metadata JSONB,
  automatic_tax JSONB,
  billing_cycle_anchor BIGINT,
  collection_method VARCHAR(50),
  currency VARCHAR(3),
  customer_email VARCHAR(255),
  days_until_due INTEGER,
  default_payment_method VARCHAR(255),
  default_source VARCHAR(255),
  description VARCHAR(1024),
  discount JSONB,
  latest_invoice VARCHAR(255),
  next_pending_invoice_item_invoice INTEGER,
  on_behalf_of VARCHAR(255),
  pause_at BIGINT,
  paused_at BIGINT,
  payment_method VARCHAR(255),
  payment_settings JSONB,
  schedule VARCHAR(255),
  start_date BIGINT,
  test_clock VARCHAR(255),
  transfer_data JSONB,
  trial_end BIGINT,
  trial_start BIGINT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add customer_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'stripe' 
    AND table_name = 'subscriptions' 
    AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE stripe.subscriptions ADD COLUMN customer_id VARCHAR(255);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_customer_id 
ON stripe.subscriptions(customer_id);

CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_status 
ON stripe.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_period 
ON stripe.subscriptions(current_period_start, current_period_end);

-- Invoices (synced from Stripe)
CREATE TABLE IF NOT EXISTS stripe.invoices (
  id VARCHAR(255) PRIMARY KEY,
  object VARCHAR(50) NOT NULL,
  created BIGINT NOT NULL,
  customer_id VARCHAR(255) NOT NULL REFERENCES stripe.customers(id),
  subscription_id VARCHAR(255) REFERENCES stripe.subscriptions(id),
  status VARCHAR(50) NOT NULL,
  number VARCHAR(255),
  pdf VARCHAR(1024),
  hosted_invoice_url VARCHAR(1024),
  amount_paid BIGINT,
  amount_remaining BIGINT,
  amount_due BIGINT,
  attempt_count INTEGER,
  attempted BOOLEAN,
  currency VARCHAR(3),
  custom_fields JSONB,
  date BIGINT,
  description VARCHAR(1024),
  due_date BIGINT,
  effective_at BIGINT,
  from_invoice VARCHAR(255),
  last_finalization_error JSONB,
  latest_revision VARCHAR(255),
  lines JSONB,
  metadata JSONB,
  next_payment_attempt BIGINT,
  on_behalf_of VARCHAR(255),
  paid BOOLEAN,
  paid_out_of_band BOOLEAN,
  paid_out_of_band_amount BIGINT,
  payment_intent VARCHAR(255),
  payment_settings JSONB,
  period_end BIGINT,
  period_start BIGINT,
  post_payment_credit_notes_amount BIGINT,
  pre_payment_credit_notes_amount BIGINT,
  quote VARCHAR(255),
  receipts_sent_at BIGINT,
  rendering JSONB,
  rendering_options JSONB,
  statement_descriptor VARCHAR(1024),
  status_transitions JSONB,
  test_clock VARCHAR(255),
  total BIGINT,
  total_discount_amounts JSONB,
  total_excluding_tax BIGINT,
  total_tax_amounts JSONB,
  transfer_data JSONB,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_invoices_customer_id 
ON stripe.invoices(customer_id);

CREATE INDEX IF NOT EXISTS idx_stripe_invoices_subscription_id 
ON stripe.invoices(subscription_id);

CREATE INDEX IF NOT EXISTS idx_stripe_invoices_status 
ON stripe.invoices(status);

CREATE INDEX IF NOT EXISTS idx_stripe_invoices_created 
ON stripe.invoices(created DESC);

-- Payment Methods (synced from Stripe)
CREATE TABLE IF NOT EXISTS stripe.payment_methods (
  id VARCHAR(255) PRIMARY KEY,
  object VARCHAR(50) NOT NULL,
  created BIGINT NOT NULL,
  customer_id VARCHAR(255) REFERENCES stripe.customers(id),
  type VARCHAR(50) NOT NULL,
  billing_details JSONB,
  card JSONB,
  metadata JSONB,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_payment_methods_customer_id 
ON stripe.payment_methods(customer_id);

CREATE INDEX IF NOT EXISTS idx_stripe_payment_methods_type 
ON stripe.payment_methods(type);

-- ============================================================================
-- 4. STRIPE SYNC ENGINE METADATA
-- Track what has been synced and when
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stripe_sync_log (
  id BIGSERIAL PRIMARY KEY,
  resource_type VARCHAR(50) NOT NULL, -- 'customer', 'product', 'price', 'subscription', 'invoice'
  resource_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  webhook_id VARCHAR(255),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_stripe_sync_log_resource 
ON public.stripe_sync_log(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_stripe_sync_log_synced_at 
ON public.stripe_sync_log(synced_at DESC);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on public tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_sync_log ENABLE ROW LEVEL SECURITY;

-- Stripe schema is read-only, no RLS needed
ALTER TABLE stripe.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE stripe.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE stripe.prices DISABLE ROW LEVEL SECURITY;
ALTER TABLE stripe.subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE stripe.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE stripe.payment_methods DISABLE ROW LEVEL SECURITY;

-- RLS: subscription_plans - anyone can view public plans, admins can manage
CREATE POLICY "Allow viewing public plans" ON public.subscription_plans
  FOR SELECT USING (is_public = true OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Allow admin to manage plans" ON public.subscription_plans
  FOR ALL USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- RLS: stripe_sync_log - admins only
CREATE POLICY "Allow admin to view sync logs" ON public.stripe_sync_log
  FOR SELECT USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- ============================================================================
-- 6. VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: User's current active subscription with plan details
CREATE OR REPLACE VIEW public.user_subscriptions AS
SELECT
  u.id as user_id,
  u.email,
  u.stripe_customer_id,
  ss.id as subscription_id,
  ss.status,
  ss.current_period_start,
  ss.current_period_end,
  ss.cancel_at_period_end,
  sp.id as product_id,
  sp.name as plan_name,
  sp.description as plan_description,
  sp.position as plan_position,
  sp.metadata as plan_features,
  to_timestamp(ss.current_period_start)::DATE as period_start_date,
  to_timestamp(ss.current_period_end)::DATE as period_end_date,
  (ss.status = 'active' AND ss.cancel_at_period_end = false) as is_active
FROM public.users u
LEFT JOIN stripe.customers sc ON u.stripe_customer_id = sc.id
LEFT JOIN stripe.subscriptions ss ON sc.id = ss.customer_id AND ss.status IN ('active', 'past_due')
LEFT JOIN stripe.prices spri ON ss.items->0->>'price' = spri.id
LEFT JOIN stripe.products sp ON spri.product_id = sp.id
LEFT JOIN public.subscription_plans splan ON sp.id = splan.stripe_product_id;

-- View: Active subscriptions only
CREATE OR REPLACE VIEW public.active_subscriptions AS
SELECT * FROM public.user_subscriptions
WHERE is_active = true;

-- ============================================================================
-- 7. DOCUMENTATION COMMENTS
-- ============================================================================

COMMENT ON SCHEMA stripe IS 
'Read-only schema containing synchronized data from Stripe. 
 Populated by Stripe Sync Engine webhooks.
 Do NOT write directly to these tables.';

COMMENT ON TABLE public.subscription_plans IS
'Admin-managed subscription plan definitions.
 Maps to Stripe Products and Prices.
 Stores only UI/display and mapping data.
 Stripe is the single source of truth for pricing, features, and limits.';

COMMENT ON TABLE stripe.subscriptions IS
'Synced Stripe subscriptions. Read-only.
 Reflects the current state of subscriptions in Stripe.
 Use this to determine feature access and user permissions.';

COMMENT ON COLUMN public.users.stripe_customer_id IS
'Foreign key to stripe.customers.id
 Established on user registration by create-stripe-customer Edge Function.
 Each user has exactly ONE Stripe customer.';

COMMENT ON COLUMN stripe.products.metadata IS
'JSON containing feature limits and settings:
 - limits_sites: integer (max sites user can create)
 - feature_projects: boolean
 - feature_local_plugins: boolean
 - feature_local_themes: boolean
 - feature_team_invites: boolean';

-- ============================================================================
-- 8. FUNCTION: Get active subscription for user
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_active_subscription(user_id UUID)
RETURNS TABLE (
  subscription_id VARCHAR,
  plan_name VARCHAR,
  status VARCHAR,
  period_end_date DATE,
  plan_metadata JSONB,
  is_past_due BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ss.id,
    sp.name,
    ss.status,
    to_timestamp(ss.current_period_end)::DATE,
    sp.metadata,
    (ss.status = 'past_due')::BOOLEAN
  FROM public.users u
  LEFT JOIN stripe.customers sc ON u.stripe_customer_id = sc.id
  LEFT JOIN stripe.subscriptions ss ON sc.id = ss.customer_id AND ss.status IN ('active', 'past_due')
  LEFT JOIN stripe.prices spri ON ss.items->0->>'price' = spri.id
  LEFT JOIN stripe.products sp ON spri.product_id = sp.id
  WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 9. FUNCTION: Check feature access
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_plan_metadata(plan_product_id VARCHAR)
RETURNS JSONB AS $$
  SELECT metadata FROM stripe.products WHERE id = plan_product_id;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- SUMMARY OF DESIGN
-- ============================================================================
-- 
-- WRITE FLOW:
--   User Action (Frontend) → Edge Function → Stripe API → Stripe Sync Engine → Supabase
--
-- READ FLOW:
--   Frontend → Supabase (stripe.* schema + views) → Display
--
-- KEY PRINCIPLES:
--   1. Stripe is the single source of truth
--   2. stripe.* tables are READ-ONLY (synced by Stripe Sync Engine)
--   3. All subscriptions changes go through Stripe APIs
--   4. Feature access is derived from stripe.products metadata
--   5. No business logic stored in synced tables
--   6. Users have exactly ONE stripe_customer_id
--
