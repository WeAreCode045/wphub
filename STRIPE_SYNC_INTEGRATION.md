# STRIPE SYNC ENGINE INTEGRATION

## Overview

The Stripe Sync Engine is responsible for syncing Stripe data into Supabase in a read-only schema called `stripe`. This is the source of truth for subscription data in the application.

## Architecture

```
┌─────────────────┐
│  Stripe API     │
│  (source truth) │
└────────┬────────┘
         │
         │ Webhooks
         │ (subscription.*, customer.*, invoice.*, etc.)
         ▼
┌─────────────────────────────────┐
│  Stripe Sync Engine             │
│  (e.g., Supabase Sync Extension)│
│  or Webhook Handler             │
└────────┬────────────────────────┘
         │
         │ INSERT/UPDATE (stripe schema tables)
         │ (read-only from app perspective)
         ▼
┌─────────────────────────────────────┐
│  Supabase PostgreSQL                │
│  stripe.*  (synced data)            │
│  public.*  (app data)               │
└─────────────────────────────────────┘
         │
         │ SELECT queries
         ▼
┌──────────────────────┐
│  React Frontend      │
│  (read subscription) │
└──────────────────────┘
```

## Synced Tables Structure

### stripe.customers
- **Source**: Stripe Customers API
- **Sync Trigger**: `customer.created`, `customer.updated`, `customer.deleted`
- **Key Fields**:
  - `id`: Stripe Customer ID (primary key)
  - `email`: Customer email
  - `metadata`: Object containing `platform_user_id` (links to `auth.users.id`)
  - `default_source`, `delinquent`: Account status

### stripe.products
- **Source**: Stripe Products API
- **Sync Trigger**: `product.created`, `product.updated`, `product.deleted`
- **Key Fields**:
  - `id`: Stripe Product ID (primary key)
  - `name`: Product name
  - `metadata`: Feature limits encoded as JSON:
    ```json
    {
      "limits_sites": 5,
      "feature_projects": true,
      "feature_local_plugins": true,
      "feature_local_themes": false,
      "feature_team_invites": true
    }
    ```
  - `active`: Boolean (only active products shown to users)

### stripe.prices
- **Source**: Stripe Prices API
- **Sync Trigger**: `price.created`, `price.updated`, `price.deleted`
- **Key Fields**:
  - `id`: Stripe Price ID (primary key)
  - `product_id`: Foreign key to `stripe.products`
  - `unit_amount`: Price in cents
  - `recurring`: JSON with `interval` ('month' or 'year') and `interval_count`
  - `lookup_key`: Can be used for semantic lookups (e.g., 'plan_pro_monthly')
  - `currency`: ISO currency code (e.g., 'usd')

### stripe.subscriptions
- **Source**: Stripe Subscriptions API
- **Sync Trigger**: `customer.subscription.*` webhooks
- **Key Fields**:
  - `id`: Stripe Subscription ID (primary key)
  - `customer_id`: Foreign key to `stripe.customers`
  - `status`: One of 'trialing', 'active', 'past_due', 'canceled', 'unpaid'
  - `items`: JSON array of line items with price and product info
  - `current_period_start`, `current_period_end`: Epoch timestamps
  - `cancel_at_period_end`: Boolean (user requested cancellation)
  - `trial_end`: Epoch timestamp (null if no trial)
  - `metadata`: Custom data passed when creating subscription

### stripe.invoices
- **Source**: Stripe Invoices API
- **Sync Trigger**: `invoice.*` webhooks
- **Key Fields**:
  - `id`: Stripe Invoice ID (primary key)
  - `customer_id`: Foreign key to `stripe.customers`
  - `subscription_id`: Foreign key to `stripe.subscriptions`
  - `status`: One of 'draft', 'open', 'paid', 'uncollectible', 'void'
  - `pdf`, `hosted_invoice_url`: Download/view URLs
  - `amount_due`, `amount_paid`, `amount_remaining`: In cents
  - `lines`: JSON with line items detail
  - `period_start`, `period_end`: Billing period

### stripe.payment_methods
- **Source**: Stripe Payment Methods API
- **Sync Trigger**: `payment_method.attached`, `payment_method.detached`, `payment_method.updated`
- **Key Fields**:
  - `id`: Stripe Payment Method ID (primary key)
  - `customer_id`: Foreign key to `stripe.customers`
  - `type`: One of 'card', 'bank_account', 'us_bank_account', etc.
  - `card`: JSON with card details (last4, exp_month, exp_year, brand)
  - `billing_details`: JSON with name, email, address

## Implementation: Webhook Handler (Edge Function)

### Webhook Sync Handler

A webhook handler Edge Function processes incoming Stripe webhooks and syncs data into Supabase:

```typescript
// supabase/functions/stripe-webhook-sync/index.ts
import Stripe from "https://esm.sh/stripe@17.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  const signature = req.headers.get("stripe-signature")!;
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      // CUSTOMER SYNC
      case "customer.created":
      case "customer.updated":
        await syncCustomer(event.data.object);
        break;

      case "customer.deleted":
        await supabase
          .from("stripe.customers")
          .delete()
          .eq("id", event.data.object.id);
        break;

      // PRODUCT SYNC
      case "product.created":
      case "product.updated":
        await syncProduct(event.data.object);
        break;

      case "product.deleted":
        await supabase
          .from("stripe.products")
          .delete()
          .eq("id", event.data.object.id);
        break;

      // PRICE SYNC
      case "price.created":
      case "price.updated":
        await syncPrice(event.data.object);
        break;

      case "price.deleted":
        await supabase
          .from("stripe.prices")
          .delete()
          .eq("id", event.data.object.id);
        break;

      // SUBSCRIPTION SYNC
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncSubscription(event.data.object);
        break;

      case "customer.subscription.deleted":
        await supabase
          .from("stripe.subscriptions")
          .delete()
          .eq("id", event.data.object.id);
        break;

      // INVOICE SYNC
      case "invoice.created":
      case "invoice.updated":
        await syncInvoice(event.data.object);
        break;

      // PAYMENT METHOD SYNC
      case "payment_method.attached":
      case "payment_method.updated":
        await syncPaymentMethod(event.data.object);
        break;

      case "payment_method.detached":
        await supabase
          .from("stripe.payment_methods")
          .delete()
          .eq("id", event.data.object.id);
        break;
    }

    // Log successful sync
    await supabase.from("public.stripe_sync_log").insert({
      resource_type: event.type.split(".")[0],
      resource_id: event.data.object.id,
      event_type: event.type,
      webhook_id: event.id,
    });

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    // Log error
    await supabase.from("public.stripe_sync_log").insert({
      resource_type: event.type.split(".")[0],
      resource_id: event.data.object.id,
      event_type: event.type,
      error_message: err.message,
      webhook_id: event.id,
    });

    return new Response(`Error: ${err.message}`, { status: 500 });
  }
});

async function syncCustomer(customer: Stripe.Customer) {
  const { error } = await supabase.from("stripe.customers").upsert({
    id: customer.id,
    object: customer.object,
    created: customer.created,
    email: customer.email,
    metadata: customer.metadata,
    description: customer.description,
    currency: customer.currency,
    default_source: customer.default_source,
    delinquent: customer.delinquent,
  });

  if (error) throw error;
}

async function syncProduct(product: Stripe.Product) {
  const { error } = await supabase.from("stripe.products").upsert({
    id: product.id,
    object: product.object,
    created: product.created,
    updated: product.updated,
    name: product.name,
    description: product.description,
    active: product.active,
    metadata: product.metadata,
    type: product.type,
    url: product.url,
  });

  if (error) throw error;
}

async function syncPrice(price: Stripe.Price) {
  const { error } = await supabase.from("stripe.prices").upsert({
    id: price.id,
    object: price.object,
    created: price.created,
    currency: price.currency,
    custom_unit_amount: price.custom_unit_amount,
    livemode: price.livemode,
    lookup_key: price.lookup_key,
    metadata: price.metadata,
    nickname: price.nickname,
    product_id: price.product,
    recurring: price.recurring,
    tax_behavior: price.tax_behavior,
    tiers_mode: price.tiers_mode,
    type: price.type,
    unit_amount: price.unit_amount,
    unit_amount_decimal: price.unit_amount_decimal,
  });

  if (error) throw error;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const { error } = await supabase.from("stripe.subscriptions").upsert({
    id: subscription.id,
    object: subscription.object,
    created: subscription.created,
    customer_id: subscription.customer as string,
    status: subscription.status,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
    ended_at: subscription.ended_at,
    cancel_at: subscription.cancel_at,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at,
    items: subscription.items,
    metadata: subscription.metadata,
    automatic_tax: subscription.automatic_tax,
    billing_cycle_anchor: subscription.billing_cycle_anchor,
    collection_method: subscription.collection_method,
    currency: subscription.currency,
    customer_email: subscription.customer_email,
    days_until_due: subscription.days_until_due,
    default_payment_method: subscription.default_payment_method as string,
    default_source: subscription.default_source,
    description: subscription.description,
    discount: subscription.discount,
    latest_invoice: subscription.latest_invoice,
    next_pending_invoice_item_invoice: subscription.next_pending_invoice_item_invoice,
    on_behalf_of: subscription.on_behalf_of,
    pause_at: subscription.pause_at,
    paused_at: subscription.paused_at,
    payment_method: subscription.payment_method as string,
    payment_settings: subscription.payment_settings,
    schedule: subscription.schedule,
    start_date: subscription.start_date,
    test_clock: subscription.test_clock,
    transfer_data: subscription.transfer_data,
    trial_end: subscription.trial_end,
    trial_start: subscription.trial_start,
  });

  if (error) throw error;
}

async function syncInvoice(invoice: Stripe.Invoice) {
  const { error } = await supabase.from("stripe.invoices").upsert({
    id: invoice.id,
    object: invoice.object,
    created: invoice.created,
    customer_id: invoice.customer as string,
    subscription_id: invoice.subscription as string,
    status: invoice.status,
    number: invoice.number,
    pdf: invoice.pdf,
    hosted_invoice_url: invoice.hosted_invoice_url,
    amount_paid: invoice.amount_paid,
    amount_remaining: invoice.amount_remaining,
    amount_due: invoice.amount_due,
    attempt_count: invoice.attempt_count,
    attempted: invoice.attempted,
    currency: invoice.currency,
    custom_fields: invoice.custom_fields,
    date: invoice.created,
    description: invoice.description,
    due_date: invoice.due_date,
    effective_at: invoice.effective_at,
    from_invoice: invoice.from_invoice,
    last_finalization_error: invoice.last_finalization_error,
    latest_revision: invoice.latest_revision,
    lines: invoice.lines,
    metadata: invoice.metadata,
    next_payment_attempt: invoice.next_payment_attempt,
    on_behalf_of: invoice.on_behalf_of,
    paid: invoice.paid,
    paid_out_of_band: invoice.paid_out_of_band,
    paid_out_of_band_amount: invoice.paid_out_of_band_amount,
    payment_intent: invoice.payment_intent as string,
    payment_settings: invoice.payment_settings,
    period_end: invoice.period_end,
    period_start: invoice.period_start,
    post_payment_credit_notes_amount: invoice.post_payment_credit_notes_amount,
    pre_payment_credit_notes_amount: invoice.pre_payment_credit_notes_amount,
    quote: invoice.quote,
    receipts_sent_at: invoice.receipts_sent_at,
    rendering: invoice.rendering,
    rendering_options: invoice.rendering_options,
    statement_descriptor: invoice.statement_descriptor,
    status_transitions: invoice.status_transitions,
    test_clock: invoice.test_clock,
    total: invoice.total,
    total_discount_amounts: invoice.total_discount_amounts,
    total_excluding_tax: invoice.total_excluding_tax,
    total_tax_amounts: invoice.total_tax_amounts,
    transfer_data: invoice.transfer_data,
  });

  if (error) throw error;
}

async function syncPaymentMethod(paymentMethod: Stripe.PaymentMethod) {
  const { error } = await supabase
    .from("stripe.payment_methods")
    .upsert({
      id: paymentMethod.id,
      object: paymentMethod.object,
      created: paymentMethod.created,
      customer_id: paymentMethod.customer as string,
      type: paymentMethod.type,
      billing_details: paymentMethod.billing_details,
      card: paymentMethod.card,
      metadata: paymentMethod.metadata,
    });

  if (error) throw error;
}
```

## Usage Patterns in Application Code

### Query 1: Get User's Active Subscription with Plan Details

```typescript
const { data, error } = await supabase
  .from("user_subscriptions")
  .select(
    `
    subscription_id,
    plan_name,
    status,
    period_end_date,
    plan_features,
    is_active
  `
  )
  .eq("user_id", userId)
  .single();
```

### Query 2: Check If User Has Feature Access

```typescript
const { data, error } = await supabase.rpc(
  "get_user_active_subscription",
  { user_id: userId }
);

if (data?.[0]?.plan_metadata?.feature_team_invites) {
  // User can invite team members
}
```

### Query 3: Get All Invoices for a User

```typescript
const { data: customer } = await supabase
  .from("stripe.customers")
  .select("id")
  .eq("metadata->platform_user_id", userId)
  .single();

const { data: invoices } = await supabase
  .from("stripe.invoices")
  .select("*")
  .eq("customer_id", customer.id)
  .order("created", { ascending: false });
```

### Query 4: Get Available Subscription Plans

```typescript
const { data: plans } = await supabase
  .from("subscription_plans")
  .select(
    `
    id,
    name,
    description,
    position,
    stripe_product_id,
    stripe_price_monthly_id,
    stripe_price_yearly_id
  `
  )
  .eq("is_public", true)
  .order("position", { ascending: true });

// Then fetch pricing from stripe.prices
const priceIds = plans.flatMap((p) => [
  p.stripe_price_monthly_id,
  p.stripe_price_yearly_id,
]);
const { data: prices } = await supabase
  .from("stripe.prices")
  .select("*")
  .in("id", priceIds);
```

### Query 5: Admin Dashboard - Subscription Revenue

```typescript
const { data: activeSubscriptions } = await supabase
  .from("active_subscriptions")
  .select("*")
  .order("period_end_date", { ascending: false });

// Calculate total revenue
const totalMonthlyRecurringRevenue = activeSubscriptions.reduce((sum, sub) => {
  const priceAmount = sub.stripe_price_monthly_id?.unit_amount || 0;
  return sum + priceAmount;
}, 0);
```

## Key Principles

1. **Never write directly to `stripe.*` tables** - They are synced by the Stripe Sync Engine
2. **All subscription changes go through Stripe APIs** - Use Edge Functions for user-facing actions
3. **Read Stripe data from synced tables** - Avoid extra API calls when data is already synced
4. **Stripe metadata is the source of feature limits** - Don't duplicate feature definitions
5. **Links are maintained via foreign keys** - `users.stripe_customer_id`, `stripe.subscriptions.customer_id`, etc.
6. **Idempotency is built into syncing** - Webhook handlers use `upsert` to handle retries

## Stripe Sync Engine Deployment Options

### Option 1: Supabase Sync Extension (Recommended for new projects)

If you use Supabase's Sync Extension, it handles webhook signing and syncing automatically. Configure it in your Supabase dashboard.

### Option 2: Custom Webhook Handler (Used in this design)

Deploy the `stripe-webhook-sync` Edge Function to handle Stripe webhooks and sync data manually. This gives you more control.

### Configuration

1. Set Stripe webhook endpoint in Stripe Dashboard to:
   ```
   https://<your-project>.functions.supabase.co/stripe-webhook-sync
   ```

2. Enable webhook events:
   - `customer.created`, `customer.updated`, `customer.deleted`
   - `product.created`, `product.updated`, `product.deleted`
   - `price.created`, `price.updated`, `price.deleted`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `invoice.created`, `invoice.updated`
   - `payment_method.attached`, `payment_method.detached`, `payment_method.updated`

3. Environment variables:
   ```env
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

## Monitoring and Debugging

Check the `stripe_sync_log` table to monitor sync operations:

```sql
-- View recent syncs
SELECT * FROM public.stripe_sync_log
ORDER BY synced_at DESC
LIMIT 50;

-- Find failed syncs
SELECT * FROM public.stripe_sync_log
WHERE error_message IS NOT NULL
ORDER BY synced_at DESC;
```

