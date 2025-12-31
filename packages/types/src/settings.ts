/**
 * Settings types
 */

import { z } from 'zod';
import { TimestampedEntitySchema } from './database';

/** Theme type enum schema */
export const ThemeTypeSchema = z.enum(['light', 'dark', 'system']);

/** Site settings entity schema */
export const SiteSettingsSchema = TimestampedEntitySchema.extend({
  site_id: z.string().uuid(),
  auto_update_plugins: z.boolean().optional(),
  auto_update_themes: z.boolean().optional(),
  auto_update_core: z.boolean().optional(),
  maintenance_mode: z.boolean().optional(),
  custom_settings: z.record(z.any()).optional(),
});

export type SiteSettings = z.infer<typeof SiteSettingsSchema>;

/** User preferences schema */
export const UserPreferencesSchema = z.object({
  theme: ThemeTypeSchema.optional(),
  language: z.string().length(2).optional(),
  notifications_enabled: z.boolean().optional(),
  email_notifications: z.boolean().optional(),
  timezone: z.string().optional(),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

/** System settings schema */
export const SystemSettingsSchema = z.object({
  maintenance_mode: z.boolean().optional(),
  registration_enabled: z.boolean().optional(),
  default_role: z.string().optional(),
  max_upload_size: z.number().int().positive().optional(),
  allowed_file_types: z.array(z.string()).optional(),
});

export type SystemSettings = z.infer<typeof SystemSettingsSchema>;
