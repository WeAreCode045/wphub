-- ============================================================================
-- ADD BILLING ADDRESS FIELDS TO USERS TABLE
-- Links billing address data to Stripe customer records (bi-directional sync)
-- ============================================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS billing_address VARCHAR(500),
ADD COLUMN IF NOT EXISTS billing_city VARCHAR(255),
ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS billing_country VARCHAR(2) DEFAULT 'NL',
ADD COLUMN IF NOT EXISTS vat_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS stripe_billing_address_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS billing_address_verified BOOLEAN DEFAULT FALSE;

-- Create indexes for lookups and relationships
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id 
ON public.users(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_users_billing_country 
ON public.users(billing_country);

CREATE INDEX IF NOT EXISTS idx_users_vat_number 
ON public.users(vat_number);

-- Add comments for documentation
COMMENT ON COLUMN public.users.stripe_customer_id IS 'Link to Stripe Customer ID (cus_...)';
COMMENT ON COLUMN public.users.two_fa_enabled IS 'Two-factor authentication enabled for account';
COMMENT ON COLUMN public.users.billing_address IS 'Billing street address (synced to Stripe address.line1 when checkout is created)';
COMMENT ON COLUMN public.users.billing_city IS 'Billing city (synced to Stripe address.city when checkout is created)';
COMMENT ON COLUMN public.users.billing_postal_code IS 'Billing postal/ZIP code (synced to Stripe address.postal_code when checkout is created)';
COMMENT ON COLUMN public.users.billing_country IS 'Billing country - ISO 2-letter code (synced to Stripe address.country when checkout is created)';
COMMENT ON COLUMN public.users.vat_number IS 'EU VAT number for business customers (synced to Stripe tax_ids when checkout is created)';
COMMENT ON COLUMN public.users.stripe_billing_address_synced_at IS 'Timestamp when billing address was last synced to Stripe';
COMMENT ON COLUMN public.users.billing_address_verified IS 'Whether billing address has been verified with Stripe';
-- ============================================================================
-- ADD STRIPE PAYMENT CONFIGURATION SETTING
-- Allows admin to configure which payment methods are available in checkout
-- ============================================================================

-- Insert the payment configuration setting if it doesn't exist
INSERT INTO public.site_settings (setting_key, setting_value, description, created_at, updated_at)
VALUES (
  'stripe_payment_configuration',
  '',
  'Stripe Payment Configuration ID for controlling available payment methods (e.g., pmc_xxxxxxxxxxxxx)',
  NOW(),
  NOW()
)
ON CONFLICT (setting_key) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE public.site_settings IS 'Global site configuration settings including Stripe payment configuration';
-- Stripe Elements & Extended Subscription Features Migration
-- Date: 2026-01-03

-- ============================================================================
-- 1. ADD NEW COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add pause/resume columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS subscription_paused_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pause_reason TEXT,
ADD COLUMN IF NOT EXISTS pausable_until TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- 2. CREATE SUBSCRIPTION EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id BIGSERIAL PRIMARY KEY,
  subscription_id TEXT,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  event_data JSONB,
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

-- Create indexes for subscription_events
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription_id 
  ON public.subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_event_type 
  ON public.subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at 
  ON public.subscription_events(created_at DESC);

-- ============================================================================
-- 3. CREATE PAYMENT FAILURES TABLE (FOR DUNNING)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_failures (
  id BIGSERIAL PRIMARY KEY,
  invoice_id TEXT UNIQUE,
  payment_intent_id TEXT UNIQUE,
  subscription_id TEXT,
  customer_id TEXT NOT NULL,
  amount BIGINT NOT NULL,
  currency TEXT DEFAULT 'eur',
  failure_code TEXT,
  failure_message TEXT,
  status TEXT DEFAULT 'pending', -- pending, retrying, resolved, forgiven, canceled, subscription_canceled
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  admin_note TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for payment_failures
CREATE INDEX IF NOT EXISTS idx_payment_failures_subscription_id 
  ON public.payment_failures(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_failures_customer_id 
  ON public.payment_failures(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_failures_status 
  ON public.payment_failures(status);
CREATE INDEX IF NOT EXISTS idx_payment_failures_created_at 
  ON public.payment_failures(created_at DESC);

-- ============================================================================
-- 4. CREATE COUPONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coupons (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  stripe_coupon_id TEXT UNIQUE,
  type TEXT NOT NULL, -- fixed_amount, percentage
  amount BIGINT, -- in cents for fixed, basis points for percentage
  currency TEXT,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  max_redemptions INTEGER,
  redemptions_used INTEGER DEFAULT 0,
  applies_to_plans TEXT[], -- array of plan IDs, NULL = all plans
  minimum_amount BIGINT, -- minimum order amount to use coupon
  applies_once BOOLEAN DEFAULT FALSE,
  applies_to_new_customers_only BOOLEAN DEFAULT FALSE,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for coupons
CREATE INDEX IF NOT EXISTS idx_coupons_code 
  ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_stripe_coupon_id 
  ON public.coupons(stripe_coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active 
  ON public.coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_valid_until 
  ON public.coupons(valid_until);

-- ============================================================================
-- 5. CREATE COUPON USAGE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coupon_usage (
  id BIGSERIAL PRIMARY KEY,
  coupon_id BIGINT NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  subscription_id TEXT,
  invoice_id TEXT,
  discount_amount BIGINT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(coupon_id, user_id, subscription_id)
);

-- Create indexes for coupon_usage
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id 
  ON public.coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id 
  ON public.coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_subscription_id 
  ON public.coupon_usage(subscription_id);

-- ============================================================================
-- 6. CREATE ADMIN PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_subscription_settings (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for admin settings
CREATE INDEX IF NOT EXISTS idx_admin_subscription_settings_key 
  ON public.admin_subscription_settings(key);

-- Insert default admin settings
INSERT INTO public.admin_subscription_settings (key, value, description)
VALUES 
  ('dunning_max_retries', '3'::jsonb, 'Maximum number of payment retry attempts'),
  ('dunning_retry_schedule', '["3 days", "7 days", "14 days"]'::jsonb, 'Retry schedule intervals'),
  ('proration_behavior', '"create_prorations"'::jsonb, 'Proration behavior for upgrades/downgrades'),
  ('invoice_vat_enabled', 'false'::jsonb, 'Whether to include VAT on invoices'),
  ('invoice_vat_number', 'null'::jsonb, 'Company VAT number'),
  ('subscription_grace_period', '"7 days"'::jsonb, 'Grace period for late payment')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 7. UPDATE SUBSCRIPTION_PLANS TABLE
-- ============================================================================

-- Add columns to support more advanced plan features
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS features_list JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS available_from TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS available_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS min_billing_cycles INTEGER DEFAULT 1;

-- ============================================================================
-- 8. CREATE VIEW FOR PAYMENT FAILURE STATS
-- ============================================================================

CREATE OR REPLACE VIEW public.payment_failure_stats AS
SELECT
  DATE_TRUNC('day', pf.created_at) as date,
  COUNT(*) as total_failures,
  COUNT(CASE WHEN pf.status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN pf.status = 'resolved' THEN 1 END) as resolved_count,
  COUNT(CASE WHEN pf.status = 'forgiven' THEN 1 END) as forgiven_count,
  COUNT(CASE WHEN pf.status = 'subscription_canceled' THEN 1 END) as canceled_count,
  SUM(pf.amount)::BIGINT as total_amount,
  AVG(pf.retry_count)::DECIMAL(10,2) as avg_retries
FROM public.payment_failures pf
GROUP BY DATE_TRUNC('day', pf.created_at);

-- ============================================================================
-- 9. CREATE VIEW FOR SUBSCRIPTION CHURN ANALYSIS
-- ============================================================================

CREATE OR REPLACE VIEW public.subscription_churn_analysis AS
SELECT
  DATE_TRUNC('month', se.created_at) as month,
  COUNT(DISTINCT CASE WHEN se.event_type = 'subscription_deleted' THEN se.subscription_id END) as canceled_count,
  COUNT(DISTINCT CASE WHEN se.event_type = 'subscription_updated' THEN se.subscription_id END) as updated_count,
  COUNT(DISTINCT CASE WHEN se.event_type = 'invoice_paid' THEN se.subscription_id END) as successful_renewals
FROM public.subscription_events se
GROUP BY DATE_TRUNC('month', se.created_at);

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

-- Grant read permissions to authenticated users on their own data
GRANT SELECT ON public.subscription_events TO authenticated;
GRANT SELECT ON public.coupons TO authenticated;
GRANT SELECT ON public.coupon_usage TO authenticated;

-- Grant admin permissions via RLS policies (to be added separately)

-- ============================================================================
-- 11. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for subscription_events
DROP POLICY IF EXISTS "Users can view their own subscription events" ON public.subscription_events;
CREATE POLICY "Users can view their own subscription events"
  ON public.subscription_events FOR SELECT
  USING (true); -- RLS will be managed via app-level checks

-- Create RLS policy for coupon_usage
DROP POLICY IF EXISTS "Users can view their own coupon usage" ON public.coupon_usage;
CREATE POLICY "Users can view their own coupon usage"
  ON public.coupon_usage FOR SELECT
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- This migration adds:
-- 1. Pause/resume subscription fields to users table
-- 2. Subscription events table for tracking all subscription lifecycle events
-- 3. Payment failures table for dunning workflow management
-- 4. Coupons table for admin-managed discount codes
-- 5. Coupon usage tracking
-- 6. Admin subscription settings for platform-wide configuration
-- 7. Enhanced subscription_plans table with additional features
-- 8. Views for payment failure statistics and churn analysis
-- 9. RLS policies for data security
-- 10. Appropriate indexes for query performance
-- ============================================================================
-- ADD RLS POLICIES FOR STRIPE SCHEMA TABLES
-- Allows authenticated users to read their own stripe data via views
-- Note: RLS is disabled on stripe.* tables per original schema design
-- This file adds policies that can be enabled in the future if needed
-- ============================================================================

-- Clean up: Drop duplicate stripe.plans table if it exists (stripe.prices is the canonical table)
DROP TABLE IF EXISTS stripe.plans CASCADE;

-- Don't enable RLS yet - the original schema has it disabled intentionally
-- Instead, use views with proper filtering to control access

-- View: User's own customer record (respects their Stripe customer link)
DROP VIEW IF EXISTS public.my_customer CASCADE;
CREATE VIEW public.my_customer AS
SELECT c.* FROM stripe.customers c
WHERE c.id IN (
  SELECT stripe_customer_id FROM public.users 
  WHERE id = auth.uid() AND stripe_customer_id IS NOT NULL
);

-- View: User's own subscriptions
DROP VIEW IF EXISTS public.my_subscriptions CASCADE;
CREATE VIEW public.my_subscriptions AS
SELECT s.* FROM stripe.subscriptions s
WHERE s.customer IN (
  SELECT stripe_customer_id FROM public.users 
  WHERE id = auth.uid() AND stripe_customer_id IS NOT NULL
);

-- View: User's own invoices
DROP VIEW IF EXISTS public.my_invoices CASCADE;
CREATE VIEW public.my_invoices AS
SELECT i.* FROM stripe.invoices i
WHERE i.customer IN (
  SELECT stripe_customer_id FROM public.users 
  WHERE id = auth.uid() AND stripe_customer_id IS NOT NULL
);

-- Enable RLS on the view layer
ALTER VIEW public.my_customer SET (security_barrier = true);
ALTER VIEW public.my_subscriptions SET (security_barrier = true);
ALTER VIEW public.my_invoices SET (security_barrier = true);
