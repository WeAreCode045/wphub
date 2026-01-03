# Integration Points - Billing System

This document shows where to integrate the billing system into your existing application.

## File Structure Overview

```
wphub/
├── supabase/
│   ├── migrations/
│   │   └── 20250103_create_billing_system.sql       ✅ DATABASE SCHEMA
│   ├── functions/
│   │   ├── create-stripe-customer/
│   │   │   └── index.ts                             ✅ EDGE FUNCTION
│   │   ├── create-subscription/
│   │   │   └── index.ts                             ✅ EDGE FUNCTION
│   │   ├── update-subscription/
│   │   │   └── index.ts                             ✅ EDGE FUNCTION
│   │   ├── cancel-subscription/
│   │   │   └── index.ts                             ✅ EDGE FUNCTION
│   │   ├── update-payment-method/
│   │   │   └── index.ts                             ✅ EDGE FUNCTION
│   │   ├── upcoming-invoice/
│   │   │   └── index.ts                             ✅ EDGE FUNCTION
│   │   ├── admin-create-plan/
│   │   │   └── index.ts                             ✅ EDGE FUNCTION
│   │   ├── admin-update-plan/
│   │   │   └── index.ts                             ✅ EDGE FUNCTION
│   │   └── stripe-webhook-sync/
│   │       └── index.ts                             📝 TODO: Create
│   │
│   └── config.toml                                  📝 TODO: Update
│
├── src/
│   ├── hooks/
│   │   └── useSubscriptionFeatures.ts               ✅ FEATURE GATING HOOK
│   │
│   ├── pages/
│   │   ├── Pricing.tsx                              ✅ PRICING PAGE
│   │   ├── BillingAccount.tsx                       ✅ BILLING PAGE
│   │   └── ... other pages
│   │
│   ├── components/
│   │   ├── AppContext.jsx                           📝 UPDATE: Add subscription context
│   │   ├── ProtectedRoute.jsx                       📝 UPDATE: Add feature checks
│   │   └── ... other components
│   │
│   ├── lib/
│   │   ├── AuthContext.jsx                          📝 UPDATE: Create stripe customer on signup
│   │   ├── query-client.js                          ✅ READY: React Query configured
│   │   └── ... other utilities
│   │
│   ├── App.jsx                                       📝 UPDATE: Add routes
│   └── main.jsx                                      📝 UPDATE: Add Stripe provider
│
├── BILLING_SYSTEM_README.md                         ✅ DOCUMENTATION
├── BILLING_IMPLEMENTATION_GUIDE.md                  ✅ IMPLEMENTATION GUIDE
└── STRIPE_SYNC_INTEGRATION.md                       ✅ SYNC ARCHITECTURE
```

## Integration Steps

### 1. Update package.json

Add Stripe and React Query dependencies:

```json
{
  "dependencies": {
    "@stripe/js": "^17.0.0",
    "@stripe/react-stripe-js": "^2.4.0",
    "@tanstack/react-query": "^5.0.0",
    "@supabase/supabase-js": "^2.38.0"
  }
}
```

### 2. Update main.jsx

Add Stripe provider at app root:

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { loadStripe } from '@stripe/js'
import { Elements } from '@stripe/react-stripe-js'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import { queryClient } from './lib/query-client'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Elements stripe={stripePromise}>
        <App />
      </Elements>
    </QueryClientProvider>
  </React.StrictMode>,
)
```

### 3. Update App.jsx

Add billing routes:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Pricing from './pages/Pricing'
import BillingAccount from './pages/BillingAccount'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ... existing routes */}
        
        {/* Billing Routes */}
        <Route path="/pricing" element={<Pricing />} />
        <Route 
          path="/account/billing" 
          element={
            <ProtectedRoute>
              <BillingAccount />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  )
}
```

### 4. Update AuthContext.jsx (lib/AuthContext.jsx)

Create Stripe customer on signup:

```typescript
import { supabase } from './supabase'

export async function handleUserSignup(userId, email) {
  try {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      console.error('No session after signup')
      return
    }

    // Create Stripe customer
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-stripe-customer`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      }
    )

    if (!response.ok) {
      console.error('Failed to create Stripe customer')
      // Don't block signup if this fails - Stripe Sync Engine will handle it
    }

    const data = await response.json()
    console.log('Stripe customer created:', data.customer_id)
  } catch (error) {
    console.error('Error creating Stripe customer:', error)
  }
}

// Call this in your signup handler:
// await handleUserSignup(user.id, user.email)
```

### 5. Update ProtectedRoute.jsx

Add feature-based access control:

```typescript
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { useUserSubscription } from '@/hooks/useSubscriptionFeatures'

export function withRequiredFeature(Component, feature) {
  return function ProtectedComponent(props) {
    const { user } = useAuth()
    const { data: subscription } = useUserSubscription()

    if (!user) {
      return <Navigate to="/signin" />
    }

    if (!subscription?.is_active) {
      return <Navigate to="/pricing" />
    }

    // Check specific feature
    const hasFeature = subscription.plan_features[feature]
    if (!hasFeature && feature !== undefined) {
      return <Navigate to="/account/billing" />
    }

    return <Component {...props} />
  }
}
```

### 6. Add Navigation Link

Update your navigation component to include billing link:

```typescript
import { useAuth } from '@/lib/AuthContext'

function Navigation() {
  const { user } = useAuth()

  return (
    <nav>
      {/* ... existing nav items */}
      
      {user && (
        <>
          <a href="/pricing">Pricing</a>
          <a href="/account/billing">Billing</a>
        </>
      )}
    </nav>
  )
}
```

### 7. Create Supabase Config

Update `supabase/config.toml`:

```toml
[project]
functions_jwt_secret = "your-secret"

[functions."create-stripe-customer"]
verify_jwt = true

[functions."create-subscription"]
verify_jwt = true

[functions."update-subscription"]
verify_jwt = true

[functions."cancel-subscription"]
verify_jwt = true

[functions."update-payment-method"]
verify_jwt = true

[functions."upcoming-invoice"]
verify_jwt = true

[functions."admin-create-plan"]
verify_jwt = true

[functions."admin-update-plan"]
verify_jwt = true
```

### 8. Create Webhook Handler

Create `supabase/functions/stripe-webhook-sync/index.ts` (reference in STRIPE_SYNC_INTEGRATION.md)

### 9. Environment Variables

Add to `.env.local`:

```env
VITE_STRIPE_PUBLIC_KEY=pk_live_...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Add to Supabase (Settings → Secrets):

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Usage Examples in Components

### Example 1: Feature-Gated Button

```typescript
import { useCanCreateSite } from '@/hooks/useSubscriptionFeatures'

export function CreateSiteButton() {
  const { can_create, sites_remaining } = useCanCreateSite(currentSiteCount)

  if (!can_create) {
    return (
      <div>
        <p>You've reached your site limit ({sites_remaining} remaining)</p>
        <a href="/pricing">Upgrade plan</a>
      </div>
    )
  }

  return <button onClick={createSite}>Create Site</button>
}
```

### Example 2: Protect Feature Behind Subscription

```typescript
import { withFeatureGating } from '@/hooks/useSubscriptionFeatures'
import ProjectsList from './ProjectsList'

// This component will show "upgrade" message if feature not available
export const ProjectsListProtected = withFeatureGating(
  ProjectsList,
  'feature_projects'
)

// Usage:
<ProjectsListProtected />
```

### Example 3: Check Feature in API Call

```typescript
import { canUserPerformAction } from '@/hooks/useSubscriptionFeatures'

async function createSite(siteData) {
  const { allowed, reason } = await canUserPerformAction(userId, 'create_site')

  if (!allowed) {
    // Show error: "Your plan doesn't include: create_site"
    throw new Error(reason)
  }

  // Create site in API
}
```

### Example 4: Show All User Features

```typescript
import { useUserFeatures } from '@/hooks/useSubscriptionFeatures'

export function FeaturesList() {
  const { has_subscription, features, subscription } = useUserFeatures()

  if (!has_subscription) {
    return <p>No active subscription</p>
  }

  return (
    <div>
      <h3>Your Features ({subscription.plan_name} plan)</h3>
      <ul>
        <li>
          Sites: {features.sites_limit}
          {features.can_use_projects && ' ✓ Projects'}
          {features.can_upload_local_plugins && ' ✓ Plugins'}
          {features.can_upload_local_themes && ' ✓ Themes'}
          {features.can_invite_team_members && ' ✓ Team Invites'}
        </li>
      </ul>
    </div>
  )
}
```

## Testing Integration

### Test User Signup

1. Sign up new user
2. Check `public.users` for `stripe_customer_id`
3. Check `stripe.customers` for synced customer
4. Verify metadata contains `platform_user_id`

### Test Subscription Creation

1. Go to `/pricing`
2. Select plan
3. Enter test card: 4242 4242 4242 4242
4. Submit
5. Check `stripe.subscriptions` for new subscription
6. Verify user can access features

### Test Feature Gating

1. Create component with `useCanCreateSite()`
2. Subscribe to plan with `limits_sites: 0`
3. Verify button is disabled
4. Upgrade to plan with `limits_sites: 5`
5. Verify button is enabled

### Test Admin Plan Creation

1. Sign in as admin user
2. Call `admin-create-plan` with:
   ```json
   {
     "name": "Test Plan",
     "monthly_price_cents": 999,
     "yearly_price_cents": 9990,
     "features": {
       "limits_sites": 3,
       "feature_projects": true,
       "feature_local_plugins": true,
       "feature_local_themes": false,
       "feature_team_invites": true
     }
   }
   ```
3. Check Stripe Dashboard for new product
4. Check `subscription_plans` table for new plan

## Database Deployment

```bash
# Run in Supabase CLI
supabase migration up

# Verify tables created
supabase db pull

# Check with Supabase Studio (web)
# Navigate to SQL Editor and run:
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
```

## Edge Functions Deployment

```bash
# Deploy individual functions
supabase functions deploy create-stripe-customer
supabase functions deploy create-subscription
supabase functions deploy update-subscription
supabase functions deploy cancel-subscription
supabase functions deploy update-payment-method
supabase functions deploy upcoming-invoice
supabase functions deploy admin-create-plan
supabase functions deploy admin-update-plan
supabase functions deploy stripe-webhook-sync

# Verify deployment
supabase functions list
```

## Verification Checklist

- [ ] Database migration deployed
- [ ] Environment variables set (Supabase & Stripe)
- [ ] All Edge Functions deployed
- [ ] Stripe webhook configured
- [ ] React components imported in router
- [ ] Stripe provider added to main.jsx
- [ ] AuthContext handles Stripe customer creation
- [ ] Test user signup → Stripe customer created
- [ ] Test plan creation → Shows in /pricing
- [ ] Test subscription → Works with Stripe Elements
- [ ] Test feature gating → Component respects subscription
- [ ] Test billing page → Shows subscription details

## Troubleshooting Integration

### "Stripe is not defined"
- Ensure `<Elements stripe={stripePromise}>` wraps your app
- Check `main.jsx` has Stripe provider

### useSubscriptionFeatures hook not working
- Verify AuthContext is providing user
- Check query-client is configured
- Ensure Supabase client is initialized

### Pricing page shows no plans
- Check plans in `subscription_plans` table with `is_public = true`
- Verify prices exist in `stripe.prices`
- Check both monthly and yearly price IDs

### Feature gating not working
- Check user's subscription in Supabase
- Verify subscription status is 'active'
- Check product metadata has feature flags

### Webhook not syncing
- Check webhook endpoint is active in Stripe Dashboard
- Verify webhook secret in Supabase matches Stripe
- Check `stripe_sync_log` table for errors

## Next Steps

1. Review all documentation files
2. Run database migration
3. Deploy Edge Functions
4. Configure Stripe webhook
5. Update frontend app structure
6. Test integration end-to-end
7. Create admin panel for plan management
8. Set up monitoring and analytics

---

For detailed implementation steps, refer to **BILLING_IMPLEMENTATION_GUIDE.md**
