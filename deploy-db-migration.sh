#!/bin/bash

# Stripe Elements Database Migration Deploy Script
# This script executes the migration SQL via Supabase API

set -e

# Configuration
SUPABASE_URL="https://ossyxxlplvqakowiwbok.supabase.co"
SUPABASE_PROJECT_ID="ossyxxlplvqakowiwbok"
SERVICE_ROLE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env | cut -d'=' -f2)
MIGRATION_FILE="supabase/migrations/20260103_stripe_elements_extended_subscriptions.sql"

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env"
  exit 1
fi

echo "🚀 Starting Database Migration Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Project: $SUPABASE_PROJECT_ID"
echo "Migration File: $MIGRATION_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Read the migration file
MIGRATION_SQL=$(cat "$MIGRATION_FILE")

# Count the number of SQL statements
STMT_COUNT=$(echo "$MIGRATION_SQL" | grep -c "^--" || true)
echo "📋 Migration contains approximately $(grep -c "CREATE\|ALTER\|INSERT" "$MIGRATION_FILE" || echo "?") statements"

echo ""
echo "⚙️  Executing migration via Supabase SQL Editor API..."
echo ""

# Create a temporary JSON file with the SQL
TEMP_JSON=$(mktemp)
cat > "$TEMP_JSON" << EOF
{
  "query": $(echo "$MIGRATION_SQL" | jq -Rs .)
}
EOF

# Execute via Supabase REST API
HTTP_CODE=$(curl -s -o /tmp/response.json -w "%{http_code}" \
  -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d @"$TEMP_JSON")

# Clean up
rm "$TEMP_JSON"

# Check response
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Migration executed successfully!"
  echo ""
  echo "📊 Response:"
  cat /tmp/response.json | jq . 2>/dev/null || cat /tmp/response.json
  echo ""
  echo "✨ Stripe Elements schema has been deployed!"
  echo ""
  echo "📈 Tables created:"
  echo "   • subscription_events (audit trail)"
  echo "   • payment_failures (dunning workflow)"
  echo "   • coupons (promotional codes)"
  echo "   • coupon_usage (redemption tracking)"
  echo "   • admin_subscription_settings (platform config)"
  echo ""
  echo "Views created:"
  echo "   • payment_failure_stats"
  echo "   • subscription_churn_analysis"
  echo ""
  echo "🎯 Next steps:"
  echo "   1. Verify tables in Supabase Dashboard → Database → Tables"
  echo "   2. Configure Stripe webhooks"
  echo "   3. Integrate components into pages"
  echo "   4. Run integration tests"
else
  echo "❌ Migration failed with HTTP code $HTTP_CODE"
  echo ""
  echo "Response:"
  cat /tmp/response.json | jq . 2>/dev/null || cat /tmp/response.json
  exit 1
fi

rm /tmp/response.json 2>/dev/null || true
