import { z } from 'zod';
import { TimestampedEntitySchema, OwnedEntitySchema, ConnectionStatusSchema } from './database';

// ============================================================================
// SITE TYPES - Zod Schemas & TypeScript Types
// ============================================================================

export const SitePluginStatusSchema = z.object({
  plugin_id: z.string().uuid(),
  version: z.string().optional(),
  is_installed: z.union([z.literal(0), z.literal(1)]),
  is_activated: z.union([z.literal(0), z.literal(1)]),
});

export const SiteRowSchema = TimestampedEntitySchema.merge(OwnedEntitySchema).extend({
  name: z.string().min(1),
  url: z.string().url(),
  api_key: z.string().min(1),
  connection_status: ConnectionStatusSchema.optional(),
  connection_checked_at: z.string().datetime().optional(),
  wp_version: z.string().optional(),
  plugins: z.array(SitePluginStatusSchema).optional(),
  status: ConnectionStatusSchema.optional(),
  description: z.string().optional(),
  favicon_url: z.string().url().optional(),
});

export const CreateSiteInputSchema = z.object({
  name: z.string().min(1, "Site naam is verplicht"),
  url: z.string().url("Voer een geldige URL in"),
  owner_type: z.enum(['user', 'team']).optional(),
  owner_id: z.string().uuid().optional(),
  description: z.string().optional(),
});

// Form-specific schema for creating a site (simpler version for UI)
export const CreateSiteFormSchema = z.object({
  name: z.string().min(1, "Site naam is verplicht").max(100, "Naam mag maximaal 100 tekens zijn"),
  url: z.string().url("Voer een geldige URL in (bijv. https://voorbeeld.nl)"),
});

export type CreateSiteForm = z.infer<typeof CreateSiteFormSchema>;

export const UpdateSiteInputSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  description: z.string().optional(),
  connection_status: ConnectionStatusSchema.optional(),
  wp_version: z.string().optional(),
  plugins: z.array(SitePluginStatusSchema).optional(),
});

export const SiteConnectionResultSchema = z.object({
  success: z.boolean(),
  status: ConnectionStatusSchema,
  wp_version: z.string().optional(),
  error: z.string().optional(),
});

export const WordPressPluginSchema = z.object({
  name: z.string(),
  slug: z.string(),
  version: z.string(),
  author: z.string().optional(),
  is_active: z.boolean(),
  is_network_activated: z.boolean().optional(),
  update_available: z.boolean().optional(),
  update_version: z.string().optional(),
});

export const WordPressThemeSchema = z.object({
  name: z.string(),
  slug: z.string(),
  version: z.string(),
  author: z.string().optional(),
  is_active: z.boolean(),
  template: z.string().optional(),
});

// Type inference
export type SitePluginStatus = z.infer<typeof SitePluginStatusSchema>;
export type SiteRow = z.infer<typeof SiteRowSchema>;
export type Site = SiteRow; // Alias for compatibility
export type CreateSiteInput = z.infer<typeof CreateSiteInputSchema>;
export type UpdateSiteInput = z.infer<typeof UpdateSiteInputSchema>;
export type SiteConnectionResult = z.infer<typeof SiteConnectionResultSchema>;
export type WordPressPlugin = z.infer<typeof WordPressPluginSchema>;
export type WordPressTheme = z.infer<typeof WordPressThemeSchema>;
