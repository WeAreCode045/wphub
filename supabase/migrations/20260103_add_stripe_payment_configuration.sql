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
