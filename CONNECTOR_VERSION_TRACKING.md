# Connector Version Tracking Setup

## Overview
The deployment system now automatically registers connector versions in the database when uploading to the Connectors bucket.

## Changes Made

### 1. Database Tables Created
Two tables now track connector versions:

#### `public.settings`
- Key-value store for global settings
- Stores the currently active connector version
- Used by `connectorVersionSettings` Edge Function

#### `public.connector_versions`
- Complete history of all uploaded connector versions
- Tracks: version, file_name, file_url, file_size, is_active, uploaded_at
- Allows querying all available versions
- Used by `registerConnectorVersion` Edge Function

### 2. Edge Functions

#### `connectorVersionSettings` (Updated)
- **GET**: Returns the currently active connector version
- **POST**: Sets a version as the active version
- Used by [Layout.jsx](../src/Layout.jsx) to display active version

#### `registerConnectorVersion` (New)
- **POST**: Registers a new connector version when deployed
- **GET**: Lists all registered connector versions
- Called automatically by deployment script

### 3. Deployment Script Updates

The [deploy-connector.sh](../scripts/deploy-connector.sh) script now:

1. ✅ Uploads ZIP to Connectors bucket
2. ✅ **NEW**: Calls `connectorVersionSettings` to set as active version
3. ✅ **NEW**: Calls `registerConnectorVersion` to register in versions table
4. ✅ Updates local metadata file

### 4. Migration Files Created

- [20260101_create_settings_table.sql](../supabase/migrations/20260101_create_settings_table.sql)
- [20260101_create_connector_versions_table.sql](../supabase/migrations/20260101_create_connector_versions_table.sql)

## Setup Instructions

### Step 1: Run SQL Migration
Copy and paste this SQL into your Supabase SQL Editor (Dashboard > SQL Editor):

```sql
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

-- Add RLS policies
alter table public.connector_versions enable row level security;

-- Allow authenticated users to read all versions
create policy "Authenticated users can read connector versions"
  on public.connector_versions
  for select
  to authenticated
  using (true);

-- Optional: Migrate current active version from settings
do $$
declare
  current_settings jsonb;
  current_version text;
  current_url text;
begin
  select value::jsonb into current_settings
  from public.settings
  where key = 'connector_version';

  if current_settings is not null then
    current_version := current_settings->>'version';
    current_url := current_settings->>'url';
    
    if current_version is not null and current_url is not null then
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
```

### Step 2: Deploy Next Version
Run the deployment script to test:

```bash
./scripts/deploy-connector.sh
```

You should see:
```
✓ Successfully uploaded to Supabase
✓ Settings table updated with new version
✓ Version registered in connector_versions table
✓ Deployment complete!
```

### Step 3: Verify in Dashboard
1. Go to Supabase Dashboard > Table Editor
2. Check `connector_versions` table - should show all uploaded versions
3. Check `settings` table - should have `connector_version` key with active version

## Benefits

✅ **Complete Version History**: All deployed versions tracked in database
✅ **Active Version Management**: Single source of truth for current version
✅ **Automatic Registration**: No manual steps needed after deployment
✅ **Query Capabilities**: Can now query available versions programmatically
✅ **Admin Dashboard Ready**: Data structure supports full version management UI

## Next Steps (Optional)

1. **Update Site Settings UI** to show all versions from `connector_versions` table
2. **Add Version Activation** button to switch active versions
3. **Add Version Metadata** like release notes, changelog, etc.
4. **Implement Rollback** functionality to revert to previous versions

## Troubleshooting

### Error: "Could not find the table 'public.settings'"
- Run the SQL migration from Step 1 above
- The `settings` table was created first, `connector_versions` is the new addition

### Edge Function Not Found
- Verify deployment: `supabase functions list`
- Redeploy if needed: `supabase functions deploy registerConnectorVersion`

### Versions Not Showing
- Check that deployment script completed successfully
- Verify environment variables in `.env` (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- Check Edge Function logs in Supabase Dashboard
