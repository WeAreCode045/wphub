/**
 * Subscription and billing types
 */

import { z } from 'zod';
import { TimestampedEntitySchema } from './database';

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

/** Subscription plan entity schema */
export const SubscriptionPlanSchema = TimestampedEntitySchema.extend({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price: z.number().nonnegative(),
  currency: z.string().length(3).toUpperCase(),
  interval: BillingIntervalSchema,
  features: z.array(z.string()).optional(),
  max_sites: z.number().int().positive().optional(),
  max_plugins: z.number().int().positive().optional(),
  max_team_members: z.number().int().positive().optional(),
  stripe_price_id: z.string().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;

/** User subscription entity schema */
export const UserSubscriptionSchema = TimestampedEntitySchema.extend({
  user_id: z.string().uuid(),
  plan_id: z.string().uuid().optional(),
  status: SubscriptionStatusSchema,
  stripe_subscription_id: z.string().optional(),
  stripe_customer_id: z.string().optional(),
  current_period_start: z.string().datetime().optional(),
  current_period_end: z.string().datetime().optional(),
  cancel_at_period_end: z.boolean().optional(),
  canceled_at: z.string().datetime().optional(),
  trial_start: z.string().datetime().optional(),
  trial_end: z.string().datetime().optional(),
});

export type UserSubscription = z.infer<typeof UserSubscriptionSchema>;

/** Invoice entity schema */
export const InvoiceSchema = TimestampedEntitySchema.extend({
  user_id: z.string().uuid(),
  stripe_invoice_id: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().length(3).toUpperCase(),
  status: InvoiceStatusSchema,
  invoice_pdf: z.string().url().optional(),
  hosted_invoice_url: z.string().url().optional(),
  period_start: z.string().datetime().optional(),
  period_end: z.string().datetime().optional(),
  paid_at: z.string().datetime().optional(),
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
