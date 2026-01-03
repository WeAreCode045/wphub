-- Create connector_versions table to track all uploaded connector versions
create table if not exists public.connector_versions (
  id bigserial primary key,
  version text not null unique,
  file_name text not null,
  file_url text not null,
  file_size text,
  is_active boolean not null default false,
  uploaded_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Create index for faster queries
create index if not exists connector_versions_version_idx on public.connector_versions(version);
create index if not exists connector_versions_is_active_idx on public.connector_versions(is_active);

-- Add RLS policies if needed (adjust based on your security requirements)
alter table public.connector_versions enable row level security;

-- Allow authenticated users to read all versions
drop policy if exists "Authenticated users can read connector versions" on public.connector_versions;
create policy "Authenticated users can read connector versions"
  on public.connector_versions
  for select
  to authenticated
  using (true);

-- Optional: Insert current active version if it exists in settings
do $$
declare
  current_settings jsonb;
  current_version text;
  current_url text;
begin
  -- Get current connector version from settings
  select value::jsonb into current_settings
  from public.settings
  where key = 'connector_version';

  if current_settings is not null then
    current_version := current_settings->>'version';
    current_url := current_settings->>'url';
    
    if current_version is not null and current_url is not null then
      -- Insert into connector_versions if not exists
      insert into public.connector_versions (version, file_name, file_url, is_active)
      values (
        current_version,
        'wphub-connector-' || current_version || '.zip',
        current_url,
        true
      )
      on conflict (version) do update
      set is_active = true;
    end if;
  end if;
end $$;
-- Create settings key/value store for connectorVersionSettings edge function
create table if not exists public.settings (
  id bigserial primary key,
  key text not null unique,
  value text not null default '{}'::text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure consistent update timestamps
create or replace function public.set_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_settings_updated_at on public.settings;
create trigger set_settings_updated_at
before update on public.settings
for each row execute function public.set_settings_updated_at();

-- Optional seed for connector_version key
insert into public.settings (key, value)
values ('connector_version', '{"version": null, "url": null}')
on conflict (key) do nothing;
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
