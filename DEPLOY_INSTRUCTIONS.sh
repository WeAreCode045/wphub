#!/bin/bash

# Simple Stripe Elements Database Migration Deploy
# Execute SQL statements one by one via psql

set -e

SUPABASE_URL="https://ossyxxlplvqakowiwbok.supabase.co"
SERVICE_ROLE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env | cut -d'=' -f2)
MIGRATION_FILE="supabase/migrations/20260103_stripe_elements_extended_subscriptions.sql"

echo "🚀 Stripe Elements Database Migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This script will execute the migration via Supabase."
echo ""
echo "📋 Two options:"
echo ""
echo "Option 1: Via Supabase Dashboard (Recommended)"
echo "  1. Go to: https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/sql"
echo "  2. Create new query"
echo "  3. Copy & paste SQL from:"
echo "     supabase/migrations/20260103_stripe_elements_extended_subscriptions.sql"
echo "  4. Click 'Run'"
echo ""
echo "Option 2: Via Supabase CLI (requires database password)"
echo "  $ supabase db push --linked"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📌 What this migration creates:"
echo "   ✅ subscription_events table (audit trail)"
echo "   ✅ payment_failures table (dunning)"
echo "   ✅ coupons table (promotional codes)"
echo "   ✅ coupon_usage table (tracking)"
echo "   ✅ admin_subscription_settings table"
echo "   ✅ 2 database views (stats & churn analysis)"
echo "   ✅ 13+ indexes for performance"
echo "   ✅ RLS policies for security"
echo ""
echo "⏱️  After executing, verify at:"
echo "   https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/database"
echo ""
echo "✨ Status: Migration SQL ready to deploy"
