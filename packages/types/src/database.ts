import { z } from 'zod';

// ============================================================================
// BASE DATABASE TYPES - Zod Schemas & TypeScript Types
// ============================================================================

/**
 * Base entity schema with common fields (id, timestamps)
 */
export const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const TimestampedEntitySchema = BaseEntitySchema.extend({
  created_date: z.string().datetime().optional(),
  updated_date: z.string().datetime().optional(),
});

export const OwnedEntitySchema = z.object({
  owner_type: z.enum(['user', 'team']),
  owner_id: z.string().uuid(),
  created_by: z.string().uuid().optional(),
});

// Type inference from schemas
export type BaseEntityRow = z.infer<typeof BaseEntitySchema>;
export type TimestampedEntityRow = z.infer<typeof TimestampedEntitySchema>;
export type OwnedEntityRow = z.infer<typeof OwnedEntitySchema>;

// ============================================================================
// ENUMS & COMMON TYPES - Zod Schemas
// ============================================================================

export const ConnectionStatusSchema = z.enum(['active', 'inactive', 'error']);
export const EntityStatusSchema = z.enum(['active', 'inactive']);
export const NotificationTypeSchema = z.enum(['info', 'warning', 'success', 'error']);
export const ActivityEntityTypeSchema = z.enum([
  'site',
  'plugin',
  'plugin_version',
  'installation',
  'user',
  'notification',
  'team',
  'subscription',
]);

export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;
export type EntityStatus = z.infer<typeof EntityStatusSchema>;
export type NotificationType = z.infer<typeof NotificationTypeSchema>;
export type ActivityEntityType = z.infer<typeof ActivityEntityTypeSchema>;

