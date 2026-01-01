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
