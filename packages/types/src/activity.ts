/**
 * Activity logging types
 */

import { z } from 'zod';
import { TimestampedEntitySchema, ActivityEntityTypeSchema } from './database';

/** Activity log entity schema */
export const ActivityLogSchema = TimestampedEntitySchema.extend({
  user_email: z.string().email(),
  user_id: z.string().uuid().optional(),
  action: z.string().min(1).max(100),
  entity_type: ActivityEntityTypeSchema,
  entity_id: z.string().uuid().optional(),
  details: z.string().max(1000).optional(),
  ip_address: z.string().ip().optional(),
  user_agent: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
});

export type ActivityLog = z.infer<typeof ActivityLogSchema>;

/** Data for creating an activity log entry schema */
export const CreateActivityLogInputSchema = z.object({
  user_email: z.string().email(),
  user_id: z.string().uuid().optional(),
  action: z.string().min(1).max(100),
  entity_type: ActivityEntityTypeSchema,
  entity_id: z.string().uuid().optional(),
  details: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateActivityLogInput = z.infer<typeof CreateActivityLogInputSchema>;

/** Activity log filter options schema */
export const ActivityLogFiltersSchema = z.object({
  user_email: z.string().email().optional(),
  user_id: z.string().uuid().optional(),
  entity_type: ActivityEntityTypeSchema.optional(),
  entity_id: z.string().uuid().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

export type ActivityLogFilters = z.infer<typeof ActivityLogFiltersSchema>;
