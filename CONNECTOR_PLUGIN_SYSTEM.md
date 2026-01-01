# WP Plugin Hub - Connector Plugin System

## Overview

The connector plugin system has been refactored to use a managed plugin approach stored in the codebase, with versioning and deployment capabilities managed through Supabase.

## Architecture Changes

### Before
- Plugin was generated dynamically from an Edge Function
- No version control over plugin code
- Difficult to maintain or test plugin updates

### After
- Plugin code is stored in `/wp-plugin/` directory
- Versions are deployed as ZIP files to Supabase storage
- Admin dashboard lists all available versions
- Admins can select which version to offer for download

## Directory Structure

```
wphub/
├── wp-plugin/                              # Managed WordPress plugin
│   ├── wp-plugin-hub-connector.php         # Main plugin file (v1.0.0)
│   ├── includes/
│   │   ├── Connector.php                   # OAuth & sync logic
│   │   ├── PluginManager.php               # Plugin management
│   │   └── ThemeManager.php                # Theme management
│   ├── languages/                          # i18n translations
│   └── README.md                           # Plugin documentation
│
├── scripts/
│   └── deploy-connector.sh                 # Deployment script
│
├── src/pages/
│   └── ConnectorManagement.jsx             # Admin dashboard page
│
└── supabase/functions/
    ├── getConnectorVersions/               # List versions from bucket
    └── connectorVersionSettings/           # Manage selected version
```

## Plugin Features

### OAuth Authentication
Users authenticate directly with the platform:
1. Click "Login to Hub" in the plugin admin page
2. Redirected to OAuth flow on platform
3. Platform verifies WordPress site URL against user's registered sites
4. Access token stored in WordPress options
5. Plugin can now access API with user's credentials

### Plugin/Theme Management
- Sync available plugins/themes from hub
- Install from WordPress.org
- Activate/deactivate
- View installation status

### Logging
- Activity logged to `wp_wphc_logs` database table
- Tracks connections, syncs, and errors

## Deployment Workflow

### 1. Update Plugin Version

Edit `wp-plugin/wp-plugin-hub-connector.php`:
```php
/**
 * Version: 1.0.1
 */
```

### 2. Deploy to Supabase

Run the deployment script:
```bash
./scripts/deploy-connector.sh
```

**Environment variables required:**
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
```

**What the script does:**
1. Reads version from plugin header
2. Creates ZIP: `wp-plugin-hub-connector-1.0.1.zip`
3. Uploads to `wp-plugin-hub-connector` bucket in Supabase
4. Generates public URL
5. Updates `connector-versions.json` metadata

**Output:**
```
✓ Created ZIP: wp-plugin-hub-connector-1.0.1.zip
✓ Successfully uploaded to Supabase
✓ Download URL: https://...supabase.co/storage/v1/object/public/wp-plugin-hub-connector/wp-plugin-hub-connector-1.0.1.zip
✓ Deployment complete!
```

### 3. Select Active Version

**In Admin Dashboard:**
1. Go to **Admin Dashboard** → **Connector Management**
2. View all available versions from the bucket
3. Click "Set Active" on the version to use
4. This updates the `settings` table with the selected version

**In Platform Sidebar:**
1. The "Download Connector" button will use the currently selected version
2. Users download the active version

## Available API Endpoints

### getConnectorVersions
- **Path:** `/functions/v1/getConnectorVersions`
- **Method:** GET
- **Returns:** List of all available connector versions with URLs
- **Response:**
```json
{
  "success": true,
  "versions": [
    {
      "version": "1.0.1",
      "filename": "wp-plugin-hub-connector-1.0.1.zip",
      "url": "https://...storage/wp-plugin-hub-connector-1.0.1.zip",
      "size": 123456,
      "created_at": "2026-01-01T12:00:00Z"
    }
  ],
  "count": 1
}
```

### connectorVersionSettings
- **Path:** `/functions/v1/connectorVersionSettings`
- **Method:** GET/POST
- **GET:** Returns currently selected version
- **POST:** Sets the active version
- **POST Body:**
```json
{
  "version": "1.0.1",
  "url": "https://...supabase.co/storage/v1/object/public/wp-plugin-hub-connector/wp-plugin-hub-connector-1.0.1.zip"
}
```

## Storage Bucket Structure

**Bucket Name:** `wp-plugin-hub-connector`
**Public Access:** Yes

**File Layout:**
```
wp-plugin-hub-connector/
├── wp-plugin-hub-connector-1.0.0.zip
├── wp-plugin-hub-connector-1.0.1.zip
├── wp-plugin-hub-connector-2.0.0.zip
└── ... (more versions)
```

## Settings Table

Stores configuration in `settings` table:

```sql
INSERT INTO settings (key, value) VALUES (
  'connector_version',
  '{"version":"1.0.1","url":"https://...","updated_at":"2026-01-01T12:00:00Z"}'
);
```

## Connector Manager Page

**Path:** `#ConnectorManagement`
**Access:** Admin only

**Features:**
- View currently active version
- List all available versions with details
- Click "Set Active" to select new version
- Download any version directly
- Copy download URL to clipboard
- Refresh version list from bucket
- Instructions for deployment

## Plugin Installation Flow

1. **User downloads** connector from download button (uses active version URL)
2. **User uploads** to WordPress plugins
3. **User activates** plugin
4. **Plugin renders** admin page with OAuth login button
5. **User clicks** "Login to Hub"
6. **Redirected** to platform OAuth endpoint
7. **Platform verifies** site URL against user's registered sites
8. **OAuth callback** to WordPress site
9. **Plugin stores** access token and site info
10. **Connector ready** for use

## Environment Setup

### Development

Create a `.env.local` file or export variables:
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
```

### Production

1. Ensure Supabase bucket `wp-plugin-hub-connector` exists and is public
2. Set environment variables in CI/CD
3. Run deployment script as part of release process
4. Verify version appears in admin dashboard
5. Test download link works
6. Set as active version

## Testing the Deployment

```bash
# 1. Update version in plugin
nano wp-plugin/wp-plugin-hub-connector.php

# 2. Deploy
./scripts/deploy-connector.sh

# 3. Check available versions
curl https://your-project.supabase.co/functions/v1/getConnectorVersions \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# 4. Set active version (requires auth)
curl -X POST https://your-project.supabase.co/functions/v1/connectorVersionSettings \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"version":"1.0.1","url":"..."}'

# 5. Verify in admin dashboard
# Visit #ConnectorManagement page
```

## Troubleshooting

### Script fails: "Could not extract version"
- Ensure plugin header has correct format: `* Version: 1.0.1`
- No extra spaces or special characters

### Script fails: "SUPABASE_URL not set"
- Export environment variables: `export SUPABASE_URL=...`
- Or set in your shell profile

### Version not appearing in admin list
- Give it 5-10 seconds for bucket to sync
- Click "Refresh" button in admin dashboard
- Check Supabase dashboard → Storage → wp-plugin-hub-connector

### Download link not working
- Verify bucket exists and is public
- Check URL format in settings table
- Ensure ZIP file uploaded successfully

## Security Considerations

1. **Storage Bucket:** Public read access (needed for downloads)
2. **Edge Functions:** No JWT verification (`--no-verify-jwt`)
3. **Admin Access:** ConnectorManagement page requires admin role
4. **Plugin OAuth:** Uses standard WordPress nonce + CSRF tokens
5. **API Tokens:** Stored in WordPress options (database)

## Future Enhancements

- [ ] Plugin changelog viewing
- [ ] Automatic version polling
- [ ] Beta/stable version channels
- [ ] Version downgrade with confirmation
- [ ] Plugin update notifications
- [ ] Release notes display in admin

## Support

For issues with:
- **Plugin code:** See `wp-plugin/README.md`
- **Deployment:** Check script output and Supabase logs
- **Admin page:** Check browser console for errors
- **OAuth:** Check WordPress debug logs
