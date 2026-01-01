# WP Plugin Hub Connector

This is the WordPress connector plugin for WP Plugin Hub. It enables WordPress sites to connect to the WP Plugin Hub platform and manage plugins and themes.

## Directory Structure

```
wp-plugin/
├── wphub-connector.php            # Main plugin file with initialization
├── includes/
│   ├── Connector.php              # Main connector class handling OAuth and syncing
│   ├── PluginManager.php          # Plugin installation and management
│   └── ThemeManager.php           # Theme installation and management
└── languages/                     # Translation files (future)
```

## Features

### OAuth Authentication
- Users authenticate through the WP Plugin Hub platform
- Site URL is verified against user's registered sites
- Access tokens are securely stored for API requests

### Plugin Management
- Install plugins from WordPress.org
- Sync plugins with hub inventory
- Manage active/inactive plugins

### Theme Management
- Install themes from WordPress.org
- Sync themes with hub inventory
- Manage active themes

## How to Deploy a New Version

1. **Update the version** in `wphub-connector.php`:
   ```php
   * Version: 1.0.1
   ```

2. **Run the deployment script**:
   ```bash
   ./scripts/deploy-connector.sh
   ```

   This script will:
   - Extract the version from the plugin header
   - Create a ZIP file: `wphub-connector-X.Y.Z.zip`
   - Upload it to Supabase storage bucket
   - Store metadata in `connector-versions.json`

3. **Set as active** in the admin dashboard:
   - Go to **Admin Dashboard** → **Connector Management**
   - Click "Set Active" on the version you want users to download

## Required Environment Variables for Deployment

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Plugin Files Structure

### Main Plugin File (wphub-connector.php)
- Plugin header with metadata
- Auto-loader for classes
- Initialization hooks
- Activation/deactivation hooks

### Connector Class (includes/Connector.php)
- Singleton pattern for single instance
- OAuth flow handling
- Admin menu and page rendering
- AJAX endpoints for sync, install, status
- Logging to custom database table

### PluginManager Class (includes/PluginManager.php)
- Install plugins from WordPress.org
- Get list of installed plugins
- Get active plugins list
- Activate/deactivate plugins

### ThemeManager Class (includes/ThemeManager.php)
- Install themes from WordPress.org
- Get list of installed themes
- Get active theme
- Activate themes

## Installation

1. Users download the connector from the platform
2. Upload to WordPress plugins folder
3. Activate the plugin
4. Click "Login to Hub" in the admin page
5. Authenticate with their platform account
6. The site is automatically connected if the URL matches a registered site

## Security Features

- OAuth state token validation (CSRF protection)
- Nonce verification on all AJAX endpoints
- Access token storage in WordPress options
- Capability checks for admin actions
- Proper escaping of all output

## Database Tables

The plugin creates a custom table for logging:

```sql
wp_wphc_logs
- id (primary key)
- time (timestamp)
- message (text)
- type (varchar)
```

## Options Stored

- `wphc_hub_url` - The hub URL
- `wphc_site_id` - Connected site ID
- `wphc_site_name` - Connected site name
- `wphc_access_token` - OAuth access token
- `wphc_connected` - Connection status
- `wphc_client_id` - OAuth client ID
- `wphc_client_secret` - OAuth client secret
