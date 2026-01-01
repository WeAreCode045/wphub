/**
 * Subscription and billing types
 */

import { z } from 'zod';

/** Subscription status enum schema */
export const SubscriptionStatusSchema = z.enum([
  'active',
  'inactive',
  'canceled',
  'past_due',
  'trialing',
]);

export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

/** Billing interval enum schema */
export const BillingIntervalSchema = z.enum(['month', 'year']);

export type BillingInterval = z.infer<typeof BillingIntervalSchema>;

/** Invoice status enum schema */
export const InvoiceStatusSchema = z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']);

/** Subscription plan entity schema - matches Stripe tables in Supabase */
export const SubscriptionPlanSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  active: z.boolean().optional(),
  default_price: z.string().optional().nullable(), // Stripe price ID
  created: z.string().datetime().optional().nullable(),
  updated: z.string().datetime().optional().nullable(),
  attrs: z.record(z.any()).optional().nullable(), // Full Stripe product object
});

export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;

/** User subscription entity schema - matches Stripe user_subscriptions table */
export const UserSubscriptionSchema = z.object({
  id: z.string(),
  customer: z.string(), // Link to customers.id
  subscription: z.string().optional().nullable(), // Stripe subscription ID
  status: z.string().optional().nullable(), // active, inactive, canceled, etc
  currency: z.string().length(3).toUpperCase().optional().nullable(),
  current_period_start: z.string().datetime().optional().nullable(),
  current_period_end: z.string().datetime().optional().nullable(),
  created: z.string().datetime().optional().nullable(),
  updated: z.string().datetime().optional().nullable(),
  attrs: z.record(z.any()).optional().nullable(), // Full Stripe subscription object
});

export type UserSubscription = z.infer<typeof UserSubscriptionSchema>;

/** Invoice entity schema - matches Stripe invoices table */
export const InvoiceSchema = z.object({
  id: z.string(),
  customer: z.string(), // Link to customers.id
  subscription: z.string().optional().nullable(), // Stripe subscription ID
  status: z.string(), // draft, open, paid, uncollectible, void
  total: z.number().nonnegative().optional().nullable(), // Amount in cents
  currency: z.string().length(3).toUpperCase().optional().nullable(),
  period_start: z.string().datetime().optional().nullable(),
  period_end: z.string().datetime().optional().nullable(),
  created: z.string().datetime().optional().nullable(),
  updated: z.string().datetime().optional().nullable(),
  attrs: z.record(z.any()).optional().nullable(), // Full Stripe invoice object
});

export type Invoice = z.infer<typeof InvoiceSchema>;

/** Checkout session data schema */
export const CheckoutSessionInputSchema = z.object({
  price_id: z.string().min(1),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
  customer_email: z.string().email().optional(),
});

export type CheckoutSessionInput = z.infer<typeof CheckoutSessionInputSchema>;
