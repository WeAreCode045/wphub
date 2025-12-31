import { z } from 'zod';
import { TimestampedEntitySchema, OwnedEntitySchema } from './database';

// ============================================================================
// PLUGIN TYPES - Zod Schemas & TypeScript Types
// ============================================================================

export const PluginSourceSchema = z.enum(['upload', 'wplibrary', 'wordpress']);

export const PluginRowSchema = TimestampedEntitySchema.merge(OwnedEntitySchema).extend({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  is_public: z.boolean().optional(),
  latest_version: z.string().optional(),
  source: PluginSourceSchema.optional(),
  author: z.string().optional(),
  author_uri: z.string().url().optional(),
  plugin_uri: z.string().url().optional(),
  requires_wp: z.string().optional(),
  requires_php: z.string().optional(),
  license: z.string().optional(),
  icon_url: z.string().url().optional(),
  banner_url: z.string().url().optional(),
  download_count: z.number().int().nonnegative().optional(),
  rating: z.number().min(0).max(5).optional(),
  num_ratings: z.number().int().nonnegative().optional(),
});

export const PluginVersionSchema = TimestampedEntitySchema.extend({
  plugin_id: z.string().uuid(),
  version: z.string().min(1),
  file_url: z.string().url(),
  file_uri: z.string().optional(),
  storage_path: z.string().optional(),
  changelog: z.string().optional(),
  release_date: z.string().datetime().optional(),
  download_url: z.string().url().optional(),
  tested_up_to: z.string().optional(),
  requires_php: z.string().optional(),
});

export const PluginInstallationSchema = TimestampedEntitySchema.extend({
  site_id: z.string().uuid(),
  plugin_id: z.string().uuid(),
  version: z.string().optional(),
  is_installed: z.boolean(),
  is_activated: z.boolean(),
  auto_update: z.boolean().optional(),
  last_checked: z.string().datetime().optional(),
});

export const CreatePluginInputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  is_public: z.boolean().optional(),
  owner_type: z.enum(['user', 'team']),
  owner_id: z.string().uuid(),
  source: PluginSourceSchema.optional(),
});

export const UpdatePluginInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  is_public: z.boolean().optional(),
  latest_version: z.string().optional(),
  icon_url: z.string().url().optional(),
  banner_url: z.string().url().optional(),
});

export const PluginMetadataSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  version: z.string().min(1),
  author: z.string().optional(),
  author_uri: z.string().url().optional(),
  plugin_uri: z.string().url().optional(),
  description: z.string().optional(),
  requires_wp: z.string().optional(),
  requires_php: z.string().optional(),
  license: z.string().optional(),
  text_domain: z.string().optional(),
});

export const PluginOperationResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  plugin: PluginRowSchema.optional(),
  version: PluginVersionSchema.optional(),
});

// Type inference
export type PluginSource = z.infer<typeof PluginSourceSchema>;
export type PluginRow = z.infer<typeof PluginRowSchema>;
export type Plugin = PluginRow; // Alias for compatibility
export type PluginVersion = z.infer<typeof PluginVersionSchema>;
export type PluginInstallation = z.infer<typeof PluginInstallationSchema>;
export type CreatePluginInput = z.infer<typeof CreatePluginInputSchema>;
export type UpdatePluginInput = z.infer<typeof UpdatePluginInputSchema>;
export type PluginMetadata = z.infer<typeof PluginMetadataSchema>;
export type PluginOperationResult = z.infer<typeof PluginOperationResultSchema>;
