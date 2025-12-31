/**
 * Connector plugin types
 */

import { z } from 'zod';
import { TimestampedEntitySchema } from './database';

/** Connector plugin version entity schema */
export const ConnectorSchema = TimestampedEntitySchema.extend({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  file_url: z.string().url(),
  file_uri: z.string().optional(),
  storage_path: z.string().optional(),
  description: z.string().max(1000).optional(),
  changelog: z.string().optional(),
  requires_wp: z.string().optional(),
  requires_php: z.string().optional(),
});

export type Connector = z.infer<typeof ConnectorSchema>;

/** Connector generation options schema */
export const ConnectorGenerationOptionsSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
  api_url: z.string().url().optional(),
  custom_branding: z.boolean().optional(),
});

export type ConnectorGenerationOptions = z.infer<typeof ConnectorGenerationOptionsSchema>;

/** Connector download info schema */
export const ConnectorDownloadInfoSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  download_url: z.string().url(),
  file_url: z.string().url(),
  created_at: z.string().datetime(),
});

export type ConnectorDownloadInfo = z.infer<typeof ConnectorDownloadInfoSchema>;
