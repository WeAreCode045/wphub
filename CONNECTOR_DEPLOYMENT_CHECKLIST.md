# Deployment Checklist: WP Plugin Hub Connector System

## Pre-Deployment Requirements

- [ ] Supabase project created and configured
- [ ] SUPABASE_URL and SUPABASE_ANON_KEY obtained
- [ ] Git repository ready for commits
- [ ] Able to run Bash scripts

## Initial Setup (One-Time)

- [ ] `wp-plugin/` directory created with all files
- [ ] `scripts/deploy-connector.sh` is executable
- [ ] `ConnectorManagement.jsx` page created and routed
- [ ] Edge Functions deployed:
  - [ ] `getConnectorVersions` deployed
  - [ ] `connectorVersionSettings` deployed

**Verify:**
```bash
ls -la wp-plugin/wp-plugin-hub-connector.php
ls -la scripts/deploy-connector.sh
grep ConnectorManagement src/pages.config.js
```

## First Version Deployment

### 1. Verify Plugin Files

```bash
find wp-plugin/ -type f
# Should show:
# - wp-plugin-hub-connector.php
# - includes/Connector.php
# - includes/PluginManager.php
# - includes/ThemeManager.php
```

- [ ] All plugin files exist
- [ ] Plugin header has correct Version: 1.0.0
- [ ] PHP syntax is valid (test in local WordPress if possible)

### 2. Set Environment Variables

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"

# Verify
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY
```

- [ ] SUPABASE_URL is set correctly
- [ ] SUPABASE_ANON_KEY is set correctly

### 3. Run Deployment Script

```bash
cd /Volumes/Code045Disk/Projects/Applications/wphub
./scripts/deploy-connector.sh
```

**Expected Output:**
- [ ] ✓ Created ZIP file
- [ ] ✓ Successfully uploaded to Supabase
- [ ] ✓ Public URL generated
- [ ] ✓ Deployment complete

**Capture:**
- [ ] ZIP filename (e.g., wp-plugin-hub-connector-1.0.0.zip)
- [ ] Public download URL
- [ ] File size

### 4. Verify Upload in Supabase

Go to **Supabase Dashboard** → **Storage** → **wp-plugin-hub-connector**

- [ ] ZIP file appears in bucket
- [ ] File size is reasonable (should be < 1 MB)
- [ ] File is accessible (click to preview or download)

### 5. Test getConnectorVersions Endpoint

```bash
curl https://your-project.supabase.co/functions/v1/getConnectorVersions \
  -H "Authorization: Bearer YOUR_ANON_KEY" | jq
```

**Expected Response:**
```json
{
  "success": true,
  "versions": [
    {
      "version": "1.0.0",
      "filename": "wp-plugin-hub-connector-1.0.0.zip",
      "url": "https://...public/wp-plugin-hub-connector/wp-plugin-hub-connector-1.0.0.zip",
      "size": 12345,
      "created_at": "2026-01-01T..."
    }
  ],
  "count": 1
}
```

- [ ] Endpoint returns 200
- [ ] Version appears in list
- [ ] URL is correct and accessible
- [ ] File size matches

### 6. Test Admin Dashboard Page

1. Go to **Admin Dashboard** → **Connector Management**
2. Check page loads without errors (no console errors)

- [ ] Page loads successfully
- [ ] Available versions list appears
- [ ] Version 1.0.0 is shown
- [ ] Download URL is visible
- [ ] File size is displayed

### 7. Set as Active Version

1. Click **"Set Active"** on version 1.0.0
2. Confirm dialog appears
3. Should say "Connector version updated successfully"

**Verify in Backend:**
```bash
curl https://your-project.supabase.co/functions/v1/connectorVersionSettings \
  -H "Authorization: Bearer YOUR_ANON_KEY" | jq
```

**Expected Response:**
```json
{
  "success": true,
  "version": "1.0.0",
  "url": "https://...wp-plugin-hub-connector-1.0.0.zip"
}
```

- [ ] Version set successfully
- [ ] Dashboard shows "Active" badge
- [ ] GET endpoint returns correct version

### 8. Test Download Link

Click **"Download"** button or copy URL from admin page

- [ ] Download link works
- [ ] ZIP file downloads without errors
- [ ] File size matches Supabase

### 9. Test Plugin Installation

1. Extract ZIP file
2. Install in test WordPress site
3. Activate plugin

**Check:**
- [ ] Plugin files extract correctly
- [ ] No missing files
- [ ] Plugin activates without errors
- [ ] Admin menu appears
- [ ] Admin page loads
- [ ] OAuth login button visible

### 10. Test OAuth Flow

1. Click "Login to Hub" in plugin admin
2. Should redirect to platform OAuth page
3. Login with test account
4. Should redirect back to WordPress
5. Should show "Connected" status

**Test Requirements:**
- [ ] Have test WordPress site with valid URL
- [ ] URL is registered in platform under test account
- [ ] OAuth flow completes
- [ ] Connection status shows "Connected"

## Documentation Verification

- [ ] CONNECTOR_IMPLEMENTATION_SUMMARY.md exists and is complete
- [ ] CONNECTOR_PLUGIN_SYSTEM.md exists with full documentation
- [ ] CONNECTOR_DEPLOYMENT_QUICK_START.md exists with quick guide
- [ ] wp-plugin/README.md exists with plugin documentation
- [ ] All documentation is accurate

## Production Deployment

Before deploying to production:

- [ ] All tests above pass
- [ ] Plugin code is reviewed
- [ ] Version number is semantic (x.y.z)
- [ ] Changelog is documented
- [ ] Supabase backup created
- [ ] Rollback plan documented

### Production Steps

```bash
# 1. Update version
nano wp-plugin/wp-plugin-hub-connector.php

# 2. Test locally
# ... run tests ...

# 3. Deploy
./scripts/deploy-connector.sh

# 4. Verify in admin dashboard
# ... check version appears ...

# 5. Set as active
# ... click Set Active in admin dashboard ...

# 6. Monitor
# ... watch for user downloads and issues ...
```

- [ ] Version deployed successfully
- [ ] Version appears in admin dashboard
- [ ] Set as active in admin dashboard
- [ ] Monitoring/logging in place
- [ ] Support notified of new version

## Monitoring & Maintenance

### Weekly Checks
- [ ] Check Supabase storage usage
- [ ] Review plugin error logs
- [ ] Monitor user feedback

### Version Update Process
1. [ ] Update version in plugin header
2. [ ] Run deploy script
3. [ ] Test in admin dashboard
4. [ ] Set as active
5. [ ] Monitor for issues

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Version not appearing | Click "Refresh" in admin dashboard, wait 10s |
| Download fails | Check bucket is public in Supabase |
| OAuth loop | Check site URL matches registered site |
| Plugin won't activate | Check PHP version (7.4+), check permissions |
| Wrong version active | Go to Connector Management, click "Set Active" |

## Rollback Plan

If a version has issues:

1. Go to **Connector Management**
2. Find previous stable version
3. Click **"Set Active"**
4. New downloads will use previous version
5. Document issue and fix

**Note:** Old versions remain in storage for manual download if needed.

## Completed ✅

Once all checks pass:

- [x] Plugin system implemented
- [x] Deployment script created
- [x] Admin dashboard created
- [x] Edge Functions deployed
- [x] Documentation complete
- [ ] First version deployed (requires action)
- [ ] Tests pass (requires testing)
- [ ] Production ready (when tests pass)

## Sign-Off

When ready for production:

| Role | Name | Date |
|------|------|------|
| Developer | | |
| Admin | | |
| QA | | |

---

**Next Step:** Follow "First Version Deployment" section above to deploy version 1.0.0
