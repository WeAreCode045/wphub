-- ============================================================================
-- ADD BILLING ADDRESS FIELDS TO USERS TABLE
-- Adds billing address, city, postal code, country, and VAT number
-- ============================================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS billing_address VARCHAR(500),
ADD COLUMN IF NOT EXISTS billing_city VARCHAR(255),
ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS billing_country VARCHAR(2) DEFAULT 'NL',
ADD COLUMN IF NOT EXISTS vat_number VARCHAR(50);

-- Create index for country lookups
CREATE INDEX IF NOT EXISTS idx_users_billing_country 
ON public.users(billing_country);

-- Add comment for documentation
COMMENT ON COLUMN public.users.billing_address IS 'Billing street address';
COMMENT ON COLUMN public.users.billing_city IS 'Billing city';
COMMENT ON COLUMN public.users.billing_postal_code IS 'Billing postal/ZIP code';
COMMENT ON COLUMN public.users.billing_country IS 'Billing country (ISO 2-letter code)';
COMMENT ON COLUMN public.users.vat_number IS 'EU VAT number for business customers';
