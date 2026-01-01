-- Ensure Site table has proper RLS configuration for Edge Functions
-- Service role should always have access regardless of RLS policies

-- Check if RLS is enabled on Site table
-- If it is, this query will ensure the policy allows service role access

BEGIN;

-- Ensure the Site table exists and has proper structure for our queries
-- The select on Site table by user_id should work with service role key

-- If there are any issues, disable RLS for authenticated/service roles:
ALTER TABLE public."Site" ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows service role (used by Edge Functions) to select any row
-- Service role should always bypass RLS, but just in case:
CREATE POLICY "Allow service role to select all sites" ON public."Site"
  AS PERMISSIVE FOR SELECT
  USING (true)
  WITH CHECK (true);

-- If the above policy already exists, ignore the error with this:
-- DROP POLICY IF EXISTS "Allow service role to select all sites" ON public."Site";

COMMIT;
