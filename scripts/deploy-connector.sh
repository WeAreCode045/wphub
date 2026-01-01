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

# Load environment variables from .env file if it exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo "Loading environment variables from .env file..."
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | grep -v '^$' | xargs)
elif [ -f "$PROJECT_ROOT/.env.local" ]; then
    echo "Loading environment variables from .env.local file..."
    export $(cat "$PROJECT_ROOT/.env.local" | grep -v '^#' | grep -v '^$' | xargs)
fi

PLUGIN_DIR="$PROJECT_ROOT/wp-plugin"
MAIN_FILE="$PLUGIN_DIR/wphub-connector.php"
BUCKET_NAME="Connectors"
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

echo -e "${YELLOW}Current version: ${VERSION}${NC}"

# Auto-increment version (patch version: X.Y.Z -> X.Y.Z+1)
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"
PATCH=$((PATCH + 1))
NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

echo -e "${YELLOW}Auto-incrementing version to: ${NEW_VERSION}${NC}"

# Update version in plugin file
sed -i '' "s/\* Version: .*/\* Version: ${NEW_VERSION}/" "$MAIN_FILE"

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to update version in plugin file${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Version updated in plugin file${NC}"

VERSION="${NEW_VERSION}"
echo -e "${YELLOW}Building WP Hub Connector v${VERSION}${NC}"
echo "Plugin directory: $PLUGIN_DIR"
echo "Version: $VERSION"

# Create temporary directory for the plugin zip
TEMP_DIR=$(mktemp -d)
PLUGIN_BUILD_DIR="$TEMP_DIR/wphub-connector"

# Copy plugin to build directory
mkdir -p "$PLUGIN_BUILD_DIR"
cp -r "$PLUGIN_DIR"/* "$PLUGIN_BUILD_DIR"

# Remove git files if any
find "$PLUGIN_BUILD_DIR" -name ".git*" -delete
find "$PLUGIN_BUILD_DIR" -name "*.swp" -delete
find "$PLUGIN_BUILD_DIR" -name ".DS_Store" -delete

# Create ZIP file
ZIP_FILE="wphub-connector-${VERSION}.zip"
cd "$TEMP_DIR"
zip -r "$ZIP_FILE" wphub-connector > /dev/null 2>&1

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

# Use service role key if available, otherwise anon key
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$SUPABASE_ANON_KEY}"

# Upload ZIP file
echo "Uploading $ZIP_FILE to $BUCKET_NAME bucket..."
echo "Upload URL: $SUPABASE_URL/storage/v1/object/$BUCKET_NAME/$ZIP_FILE"
echo "ZIP file path: $PROJECT_ROOT/$ZIP_FILE"

cd "$PROJECT_ROOT"

# Check if ZIP file exists before uploading
if [ ! -f "$ZIP_FILE" ]; then
    echo -e "${RED}Error: ZIP file not found at $ZIP_FILE${NC}"
    exit 1
fi

# Use the correct Supabase storage API endpoint with PUT method
echo "Executing upload..."
UPLOAD_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/zip" \
    -H "x-upsert: true" \
    --data-binary "@$ZIP_FILE" \
    "$SUPABASE_URL/storage/v1/object/$BUCKET_NAME/$ZIP_FILE" 2>&1)

echo "Upload response: $UPLOAD_RESPONSE"

# Check if upload was successful
if echo "$UPLOAD_RESPONSE" | grep -q '"error"'; then
    echo -e "${RED}Upload failed:${NC}"
    echo "$UPLOAD_RESPONSE"
    exit 1
fi

# Check if response contains "Id" or "Key" (success indicators)
if ! echo "$UPLOAD_RESPONSE" | grep -qE '("Id"|"Key"|"path")'; then
    echo -e "${RED}Upload may have failed. Response:${NC}"
    echo "$UPLOAD_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Successfully uploaded to Supabase${NC}"

# Generate public URL
PUBLIC_URL="$SUPABASE_URL/storage/v1/object/public/$BUCKET_NAME/$ZIP_FILE"
echo -e "${GREEN}✓ Download URL:${NC}"
echo "$PUBLIC_URL"

# Save version info to a metadata file
METADATA_FILE="$PROJECT_ROOT/connector-versions.json"
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
