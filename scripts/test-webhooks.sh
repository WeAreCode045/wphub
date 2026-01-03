#!/bin/bash
# Webhook Configuration Test Script
# Tests if all Stripe webhooks are correctly configured

set -e

echo "🔍 Webhook Configuration Test"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${VITE_SUPABASE_URL:-https://ossyxxlplvqakowiwbok.supabase.co}"
WEBHOOK_ENDPOINT="$SUPABASE_URL/functions/v1/webhook-stripe-sync"

# Required webhook events
REQUIRED_EVENTS=(
    "payment_intent.succeeded"
    "payment_intent.payment_failed"
    "customer.subscription.created"
    "customer.subscription.updated"
    "customer.subscription.deleted"
    "invoice.paid"
    "invoice.payment_failed"
)

echo "📍 Testing webhook endpoint: $WEBHOOK_ENDPOINT"
echo ""

# Test 1: Check if webhook endpoint is accessible
echo "Test 1: Endpoint Accessibility"
echo "-------------------------------"
if curl -s -o /dev/null -w "%{http_code}" "$WEBHOOK_ENDPOINT" | grep -q "405"; then
    echo -e "${GREEN}✅ Webhook endpoint is accessible${NC}"
    echo "   (405 Method Not Allowed is expected - endpoint only accepts POST)"
else
    echo -e "${RED}❌ Webhook endpoint is not accessible${NC}"
    echo "   Please check if the function is deployed"
    exit 1
fi
echo ""

# Test 2: Check environment variables
echo "Test 2: Environment Variables"
echo "------------------------------"

if [ -f .env ]; then
    echo -e "${GREEN}✅ .env file found${NC}"
    
    # Check STRIPE_SECRET_KEY
    if grep -q "STRIPE_SECRET_KEY" .env; then
        echo -e "${GREEN}✅ STRIPE_SECRET_KEY is set${NC}"
    else
        echo -e "${RED}❌ STRIPE_SECRET_KEY not found in .env${NC}"
    fi
    
    # Check STRIPE_WEBHOOK_SECRET
    if grep -q "STRIPE_WEBHOOK_SECRET" .env; then
        echo -e "${GREEN}✅ STRIPE_WEBHOOK_SECRET is set${NC}"
    else
        echo -e "${YELLOW}⚠️  STRIPE_WEBHOOK_SECRET not found in .env${NC}"
        echo "   This should be added after creating the webhook in Stripe Dashboard"
    fi
else
    echo -e "${RED}❌ .env file not found${NC}"
fi
echo ""

# Test 3: Check webhook function code
echo "Test 3: Webhook Function Implementation"
echo "----------------------------------------"

WEBHOOK_FILE="supabase/functions/webhook-stripe-sync/index.ts"
if [ -f "$WEBHOOK_FILE" ]; then
    echo -e "${GREEN}✅ Webhook function file exists${NC}"
    
    # Check for event handlers
    echo ""
    echo "Checking event handlers:"
    for event in "${REQUIRED_EVENTS[@]}"; do
        # Convert event name to handler name (e.g., payment_intent.succeeded -> payment_intent)
        handler_check="${event%%.*}"
        
        if grep -q "case '$event'" "$WEBHOOK_FILE"; then
            echo -e "  ${GREEN}✅${NC} $event handler found"
        else
            echo -e "  ${RED}❌${NC} $event handler missing"
        fi
    done
else
    echo -e "${RED}❌ Webhook function file not found at $WEBHOOK_FILE${NC}"
fi
echo ""

# Test 4: Check Supabase function deployment
echo "Test 4: Function Deployment Status"
echo "-----------------------------------"
if command -v supabase &> /dev/null; then
    echo "Checking deployed functions..."
    supabase functions list 2>/dev/null || echo -e "${YELLOW}⚠️  Could not list functions. Make sure you're logged in.${NC}"
else
    echo -e "${YELLOW}⚠️  Supabase CLI not installed. Skipping deployment check.${NC}"
fi
echo ""

# Test 5: Verify webhook in Stripe (requires manual check)
echo "Test 5: Manual Verification Required"
echo "-------------------------------------"
echo -e "${BLUE}ℹ️  Please verify the following in Stripe Dashboard:${NC}"
echo ""
echo "1. Go to: https://dashboard.stripe.com/webhooks"
echo ""
echo "2. Check that your webhook endpoint is configured:"
echo "   URL: $WEBHOOK_ENDPOINT"
echo ""
echo "3. Verify these 7 events are selected:"
for event in "${REQUIRED_EVENTS[@]}"; do
    echo "   • $event"
done
echo ""
echo "4. Check webhook status is 'Enabled'"
echo ""
echo "5. Copy the signing secret and add to your environment:"
echo "   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_..."
echo ""

# Summary
echo "=============================="
echo "📊 Test Summary"
echo "=============================="
echo ""
echo "Automated Tests:"
echo "  - Endpoint accessibility"
echo "  - Environment configuration"
echo "  - Function implementation"
echo ""
echo "Manual Verification Needed:"
echo "  - Stripe Dashboard webhook configuration"
echo "  - Event selection (7 required events)"
echo "  - Webhook secret configuration"
echo ""
echo -e "${BLUE}ℹ️  To test webhook delivery:${NC}"
echo "1. In Stripe Dashboard, go to your webhook endpoint"
echo "2. Click 'Send test webhook'"
echo "3. Select an event type"
echo "4. Check Supabase logs for processing"
echo ""
echo "View logs at:"
echo "https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/functions/webhook-stripe-sync/logs"
echo ""
