#!/bin/bash

# Deploy WP Plugin Hub Connector to Supabase Storage
# This script creates a ZIP file and uploads it to the connector bucket

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_DIR="$PROJECT_ROOT/wp-plugin"
MAIN_FILE="$PLUGIN_DIR/wp-plugin-hub-connector.php"
BUCKET_NAME="connectors"
PROJECT_ID="${SUPABASE_PROJECT_ID}"
SUPABASE_URL="${SUPABASE_URL}"

# Verify main plugin file exists
if [ ! -f "$MAIN_FILE" ]; then
    echo -e "${RED}Error: Plugin main file not found at $MAIN_FILE${NC}"
    exit 1
fi

# Extract version from plugin header
VERSION=$(grep "Version:" "$MAIN_FILE" | head -1 | sed 's/.*Version: *//' | tr -d ' ' | cut -d' ' -f1)

if [ -z "$VERSION" ]; then
    echo -e "${RED}Error: Could not extract version from plugin file${NC}"
    exit 1
fi

echo -e "${YELLOW}Building WP Plugin Hub Connector v${VERSION}${NC}"
echo "Plugin directory: $PLUGIN_DIR"
echo "Version: $VERSION"

# Create temporary directory for the plugin zip
TEMP_DIR=$(mktemp -d)
PLUGIN_BUILD_DIR="$TEMP_DIR/wp-plugin-hub-connector"

# Copy plugin to build directory
mkdir -p "$PLUGIN_BUILD_DIR"
cp -r "$PLUGIN_DIR"/* "$PLUGIN_BUILD_DIR"

# Remove git files if any
find "$PLUGIN_BUILD_DIR" -name ".git*" -delete
find "$PLUGIN_BUILD_DIR" -name "*.swp" -delete
find "$PLUGIN_BUILD_DIR" -name ".DS_Store" -delete

# Create ZIP file
ZIP_FILE="wp-plugin-hub-connector-${VERSION}.zip"
cd "$TEMP_DIR"
zip -r "$ZIP_FILE" wp-plugin-hub-connector > /dev/null 2>&1

# Move ZIP to project root
cp "$ZIP_FILE" "$PROJECT_ROOT/"
ZIP_PATH="$PROJECT_ROOT/$ZIP_FILE"

echo -e "${GREEN}✓ Created ZIP: $ZIP_FILE${NC}"
echo "File size: $(du -h "$ZIP_PATH" | cut -f1)"

# Upload to Supabase Storage using API
echo -e "${YELLOW}Uploading to Supabase...${NC}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}Error: SUPABASE_URL or SUPABASE_ANON_KEY not set${NC}"
    echo "Please set these environment variables or configure them in your shell"
    exit 1
fi

# Check if bucket exists, create if not
BUCKET_EXISTS=$(curl -s \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    "$SUPABASE_URL/storage/v1/bucket/$BUCKET_NAME" \
    | grep -q "id" && echo "true" || echo "false")

if [ "$BUCKET_EXISTS" = "false" ]; then
    echo -e "${YELLOW}Creating storage bucket: $BUCKET_NAME${NC}"
    curl -s -X POST \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$BUCKET_NAME\",\"public\":true}" \
        "$SUPABASE_URL/storage/v1/admin/buckets" > /dev/null
fi

# Upload ZIP file
echo "Uploading $ZIP_FILE..."
UPLOAD_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    --data-binary "@$ZIP_FILE" \
    "$SUPABASE_URL/storage/v1/object/$BUCKET_NAME/$ZIP_FILE")

# Check if upload was successful
if echo "$UPLOAD_RESPONSE" | grep -q "error"; then
    echo -e "${RED}Upload failed:${NC}"
    echo "$UPLOAD_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Successfully uploaded to Supabase${NC}"

# Generate public URL
PUBLIC_URL="$SUPABASE_URL/storage/v1/object/public/$BUCKET_NAME/$ZIP_FILE"
echo -e "${GREEN}✓ Download URL:${NC}"
echo "$PUBLIC_URL"

# Save version info to a metadata file
METADATA_FILE="$(dirname "$PLUGIN_DIR")/connector-versions.json"
echo "Updating version metadata..."

# Create or update versions JSON
if [ ! -f "$METADATA_FILE" ]; then
    echo "[]" > "$METADATA_FILE"
fi

# Add new version to list
NEW_ENTRY="{\"version\":\"$VERSION\",\"file\":\"$ZIP_FILE\",\"url\":\"$PUBLIC_URL\",\"uploaded_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"file_size\":\"$(du -h "$ZIP_PATH" | cut -f1)\"}"

# Simple JSON update (for production, use a proper JSON tool)
TEMP_JSON=$(mktemp)
echo "$NEW_ENTRY" > "$TEMP_JSON"

# For now, just store as plain text file
echo "$NEW_ENTRY" >> "$METADATA_FILE"

echo -e "${GREEN}✓ Metadata updated${NC}"

# Cleanup
rm -rf "$TEMP_DIR"
rm -f "$ZIP_PATH"

echo ""
echo -e "${GREEN}✓ Deployment complete!${NC}"
echo ""
echo "Plugin Version: $VERSION"
echo "ZIP File: $ZIP_FILE"
echo "Public URL: $PUBLIC_URL"
echo ""
echo "Next steps:"
echo "1. Update your admin dashboard to list this version"
echo "2. Users can now download this connector version"
