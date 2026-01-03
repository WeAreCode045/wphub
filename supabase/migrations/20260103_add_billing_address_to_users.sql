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
