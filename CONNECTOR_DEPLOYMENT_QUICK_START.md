# Quick Start Guide: Connector Plugin Deployment

## What Changed?

The WordPress connector plugin is now managed from the codebase (`/wp-plugin/` directory) and versioned using Supabase storage.

## Quick Deployment (5 minutes)

### Step 1: Update Version
```bash
# Edit the plugin main file header
nano wp-plugin/wphub-connector.php

# Change:
# * Version: 1.0.0
# To:
# * Version: 1.0.1
```

### Step 2: Deploy to Supabase
```bash
# Set environment variables (or add to your shell profile)
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"

# Run deployment script
./scripts/deploy-connector.sh
```

### Step 3: Set as Active Version
1. Go to **Admin Dashboard** → **Connector Management**
2. Find version `1.0.1` in the list
3. Click **"Set Active"** button
4. Done! Users will download this version

## Files at a Glance

| File | Purpose |
|------|---------|
| `wp-plugin/wphub-connector.php` | Main plugin file - contains version header |
| `wp-plugin/includes/Connector.php` | OAuth flow, syncing, admin page |
| `wp-plugin/includes/PluginManager.php` | Plugin install/activate |
| `wp-plugin/includes/ThemeManager.php` | Theme install/activate |
| `scripts/deploy-connector.sh` | Zips and uploads to Supabase |
| `src/pages/ConnectorManagement.jsx` | Admin dashboard for versions |

## What Happens When You Deploy?

```
1. Script reads version from plugin header
   ↓
2. Creates ZIP: wphub-connector-1.0.1.zip
   ↓
3. Uploads to Supabase storage bucket
   ↓
4. Creates public download URL
   ↓
5. Lists in admin dashboard
```

## Testing

```bash
# Check your version uploaded
curl https://your-project.supabase.co/functions/v1/getConnectorVersions \
  -H "Authorization: Bearer YOUR_ANON_KEY" | jq

# Should show your new version in the list
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Could not extract version" | Check format: `* Version: 1.0.1` (exact spacing) |
| "SUPABASE_URL not set" | Export before running: `export SUPABASE_URL=...` |
| Version not in list | Wait 10 seconds, click "Refresh" in admin dashboard |
| Download doesn't work | Check bucket is public in Supabase storage settings |

## Full Documentation

See **CONNECTOR_PLUGIN_SYSTEM.md** for complete documentation.

## Admin Dashboard

**URL:** `#ConnectorManagement` (admin only)

**Features:**
- ✅ View all available versions
- ✅ See currently active version
- ✅ Select new active version
- ✅ Download any version
- ✅ Copy download URLs
- ✅ View upload dates and file sizes

## Platform Integration

The **"Download Connector"** button on the platform uses the selected version:

1. Admin selects version in **Connector Management**
2. Version stored in Supabase `settings` table
3. Download button redirects to that version's URL
4. Users get the active version

## Plugin Features

Once installed, the connector plugin provides:

✅ **OAuth Authentication**
- Users login with their platform account
- Site automatically verified and connected

✅ **Plugin Management**
- Sync plugins from hub
- Install from WordPress.org
- Activate/deactivate

✅ **Theme Management**
- Sync themes from hub
- Install from WordPress.org
- Activate themes

✅ **Logging**
- All actions logged to WordPress database

## Next Steps

1. Make changes to plugin code in `/wp-plugin/`
2. Test locally (install in test WordPress)
3. Update version number
4. Run deploy script
5. Test download and installation
6. Set as active in admin dashboard
7. Done! 🎉
