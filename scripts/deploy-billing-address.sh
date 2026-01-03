#!/bin/bash
# Deploy billing address migration and edge function

echo "🚀 Deploying Billing Address Enhancement"
echo "========================================="

# Step 1: Deploy database migration
echo ""
echo "📊 Step 1: Deploying database migration..."
echo "Copy and run this SQL in Supabase Dashboard > SQL Editor:"
echo ""
cat supabase/migrations/20260103_add_billing_address_to_users.sql
echo ""
echo "Or run: supabase db push"
echo ""

# Step 2: Deploy edge function
echo "🔧 Step 2: Deploying create-checkout-session edge function..."
supabase functions deploy create-checkout-session

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Test billing address in Account Settings"
echo "2. Verify checkout shows plan details"
echo "3. Complete a test purchase"
echo "4. Check Stripe dashboard for billing info"
