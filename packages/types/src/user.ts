import { z } from 'zod';
import { BaseEntitySchema, EntityStatusSchema } from './database';

// ============================================================================
// USER TYPES - Zod Schemas & TypeScript Types
// ============================================================================

export const UserRoleSchema = z.enum(['user', 'admin', 'moderator']);

export const UserRowSchema = BaseEntitySchema.extend({
  email: z.string().email(),
  full_name: z.string().optional(),
  avatar_url: z.string().url().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  role: UserRoleSchema.optional(),
  status: EntityStatusSchema.optional(),
  stripe_customer_id: z.string().optional(),
  subscription_status: z.string().optional(),
  subscription_plan: z.string().optional(),
  subscription_period_end: z.string().datetime().optional(),
  two_factor_enabled: z.boolean().optional(),
  two_factor_secret: z.string().optional(),
  last_login: z.string().datetime().optional(),
});

export const UserProfileSchema = z.object({
  full_name: z.string().optional(),
  avatar_url: z.string().url().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
});

export const UserAuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const UserRegistrationSchema = UserAuthSchema.extend({
  profile: UserProfileSchema.optional(),
});

// Type inference
export type UserRole = z.infer<typeof UserRoleSchema>;
export type UserRow = z.infer<typeof UserRowSchema>;
export type User = UserRow; // Alias for compatibility
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UserAuth = z.infer<typeof UserAuthSchema>;
export type UserRegistration = z.infer<typeof UserRegistrationSchema>;
