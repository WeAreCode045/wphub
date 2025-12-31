/**
 * API request and response types for Edge Functions
 */

import { z } from 'zod';

// Inline schemas to avoid cross-file dependencies for Edge Functions
const PluginMetadataSchema = z.object({
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

const WordPressPluginSchema = z.object({
  name: z.string(),
  slug: z.string(),
  version: z.string(),
  author: z.string().optional(),
  author_profile: z.string().url().optional(),
  requires: z.string().optional(),
  tested: z.string().optional(),
  requires_php: z.string().optional(),
  requires_plugins: z.array(z.string()).optional(),
  rating: z.number().optional(),
  ratings: z.record(z.number()).optional(),
  num_ratings: z.number().optional(),
  support_threads: z.number().optional(),
  support_threads_resolved: z.number().optional(),
  downloaded: z.number().optional(),
  last_updated: z.string().optional(),
  added: z.string().optional(),
  homepage: z.string().url().optional(),
  short_description: z.string().optional(),
  description: z.string().optional(),
  download_link: z.string().url().optional(),
  tags: z.record(z.string()).optional(),
  donate_link: z.string().url().optional(),
  icons: z.record(z.string().url()).optional(),
  banners: z.record(z.string().url()).optional(),
  preview_link: z.string().url().optional(),
});

const WordPressThemeSchema = z.object({
  name: z.string(),
  slug: z.string(),
  version: z.string(),
  preview_url: z.string().url().optional(),
  author: z.object({
    user_nicename: z.string(),
    profile: z.string().url().optional(),
    display_name: z.string(),
  }).optional(),
  screenshot_url: z.string().url().optional(),
  ratings: z.record(z.number()).optional(),
  rating: z.number().optional(),
  num_ratings: z.number().optional(),
  homepage: z.string().url().optional(),
  description: z.string().optional(),
  download_link: z.string().url().optional(),
});

/** Generic API response wrapper schema */
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export type ApiResponse<T = any> = z.infer<typeof ApiResponseSchema> & { data?: T };

/** Paginated API response schema */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) => z.object({
  data: z.array(itemSchema),
  page: z.number().int().positive(),
  per_page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  has_more: z.boolean(),
});

export type PaginatedResponse<T> = {
  data: T[];
  page: number;
  per_page: number;
  total: number;
  has_more: boolean;
};

/** Edge Function invocation options schema */
export const EdgeFunctionOptionsSchema = z.object({
  body: z.record(z.any()).optional(),
  headers: z.record(z.string()).optional(),
});

export type EdgeFunctionOptions = z.infer<typeof EdgeFunctionOptionsSchema>;

// === Plugin Edge Function Types ===

export const ParsePluginZipRequestSchema = z.object({
  storage_path: z.string().optional(),
  path: z.string().optional(),
  Key: z.string().optional(),
  file_url: z.string().url().optional(),
});

export type ParsePluginZipRequest = z.infer<typeof ParsePluginZipRequestSchema>;

export const ParsePluginZipResponseSchema = ApiResponseSchema.extend({
  data: PluginMetadataSchema.optional(),
  slug: z.string().optional(),
});

export type ParsePluginZipResponse = z.infer<typeof ParsePluginZipResponseSchema>;

export const ActivatePluginRequestSchema = z.object({
  site_id: z.string().uuid(),
  plugin_slug: z.string().min(1),
  plugin_id: z.string().uuid().optional(),
});

export type ActivatePluginRequest = z.infer<typeof ActivatePluginRequestSchema>;

export const DeactivatePluginRequestSchema = z.object({
  site_id: z.string().uuid(),
  plugin_id: z.string().uuid(),
});

export type DeactivatePluginRequest = z.infer<typeof DeactivatePluginRequestSchema>;

export const InstallPluginRequestSchema = z.object({
  site_id: z.string().uuid(),
  plugin_slug: z.string().min(1),
  plugin_id: z.string().uuid().optional(),
  download_url: z.string().url().optional(),
});

export type InstallPluginRequest = z.infer<typeof InstallPluginRequestSchema>;

export const UninstallPluginRequestSchema = z.object({
  site_id: z.string().uuid(),
  plugin_slug: z.string().min(1),
  plugin_id: z.string().uuid().optional(),
});

export type UninstallPluginRequest = z.infer<typeof UninstallPluginRequestSchema>;

export const UpdatePluginRequestSchema = z.object({
  site_id: z.string().uuid(),
  plugin_slug: z.string().min(1),
  plugin_id: z.string().uuid().optional(),
  download_url: z.string().url().optional(),
});

export type UpdatePluginRequest = z.infer<typeof UpdatePluginRequestSchema>;

export const EnablePluginForSiteRequestSchema = z.object({
  site_id: z.string().uuid(),
  plugin_id: z.string().uuid(),
  enabled: z.boolean(),
});

export type EnablePluginForSiteRequest = z.infer<typeof EnablePluginForSiteRequestSchema>;

export const TogglePluginStateRequestSchema = z.object({
  site_id: z.string().uuid(),
  plugin_slug: z.string().min(1),
});

export type TogglePluginStateRequest = z.infer<typeof TogglePluginStateRequestSchema>;

export const GetPluginCommandsRequestSchema = z.object({
  api_key: z.string().min(1),
});

export type GetPluginCommandsRequest = z.infer<typeof GetPluginCommandsRequestSchema>;

export const PluginCommandSchema = z.object({
  plugin_id: z.string().uuid(),
  plugin_slug: z.string().min(1),
  command: z.enum(['install', 'update', 'activate', 'deactivate', 'uninstall']),
  download_url: z.string().url().optional(),
  version: z.string().optional(),
});

export const GetPluginCommandsResponseSchema = ApiResponseSchema.extend({
  commands: z.array(PluginCommandSchema).optional(),
});

export type GetPluginCommandsResponse = z.infer<typeof GetPluginCommandsResponseSchema>;

export const GetPluginFileUrlRequestSchema = z.object({
  api_key: z.string().min(1),
  plugin_id: z.string().uuid(),
  version_id: z.string().uuid(),
});

export type GetPluginFileUrlRequest = z.infer<typeof GetPluginFileUrlRequestSchema>;

export const GetPluginFileUrlResponseSchema = ApiResponseSchema.extend({
  download_url: z.string().url().optional(),
});

export type GetPluginFileUrlResponse = z.infer<typeof GetPluginFileUrlResponseSchema>;

// === Site Edge Function Types ===

export const ListSitePluginsRequestSchema = z.object({
  site_id: z.string().uuid(),
});

export type ListSitePluginsRequest = z.infer<typeof ListSitePluginsRequestSchema>;

export const ListSitePluginsResponseSchema = ApiResponseSchema.extend({
  plugins: z.array(WordPressPluginSchema).optional(),
});

export type ListSitePluginsResponse = z.infer<typeof ListSitePluginsResponseSchema>;

export const ListSiteThemesRequestSchema = z.object({
  site_id: z.string().uuid(),
});

export type ListSiteThemesRequest = z.infer<typeof ListSiteThemesRequestSchema>;

export const ListSiteThemesResponseSchema = ApiResponseSchema.extend({
  themes: z.array(WordPressThemeSchema).optional(),
});

export type ListSiteThemesResponse = z.infer<typeof ListSiteThemesResponseSchema>;

export const SyncSitePluginDataSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  version: z.string().min(1),
  is_active: z.boolean(),
});

export const SyncSiteDataRequestSchema = z.object({
  api_key: z.string().min(1),
  wp_version: z.string().optional(),
  plugins: z.array(SyncSitePluginDataSchema).optional(),
  site_url: z.string().url().optional(),
});

export type SyncSiteDataRequest = z.infer<typeof SyncSiteDataRequestSchema>;

export const SyncSiteDataResponseSchema = ApiResponseSchema.extend({
  site_id: z.string().uuid().optional(),
});

export type SyncSiteDataResponse = z.infer<typeof SyncSiteDataResponseSchema>;

export const RequestSiteTransferRequestSchema = z.object({
  site_id: z.string().uuid().optional(),
  site_url: z.string().url().optional(),
});

export type RequestSiteTransferRequest = z.infer<typeof RequestSiteTransferRequestSchema>;

export const HandleSiteTransferRequestSchema = z.object({
  message_id: z.string().uuid(),
  action: z.enum(['accept', 'reject']),
  transfer_plugins: z.array(z.string().uuid()).optional(),
  non_transfer_action: z.enum(['disconnect', 'uninstall']).optional(),
});

export type HandleSiteTransferRequest = z.infer<typeof HandleSiteTransferRequestSchema>;

export const HandleSiteTransferResponseSchema = ApiResponseSchema.extend({
  transferred_plugins: z.number().int().nonnegative().optional(),
  disconnected_plugins: z.number().int().nonnegative().optional(),
});

export type HandleSiteTransferResponse = z.infer<typeof HandleSiteTransferResponseSchema>;

// === Connector Edge Function Types ===

export const GetConnectorVersionResponseSchema = ApiResponseSchema.extend({
  version: z.string().optional(),
  download_url: z.string().url().optional(),
  file_url: z.string().url().optional(),
  created_at: z.string().datetime().optional(),
});

export type GetConnectorVersionResponse = z.infer<typeof GetConnectorVersionResponseSchema>;

export const GenerateConnectorPluginRequestSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
});

export type GenerateConnectorPluginRequest = z.infer<typeof GenerateConnectorPluginRequestSchema>;

export const GenerateConnectorPluginResponseSchema = ApiResponseSchema.extend({
  version: z.string().optional(),
  download_url: z.string().url().optional(),
  file_url: z.string().url().optional(),
});

export type GenerateConnectorPluginResponse = z.infer<typeof GenerateConnectorPluginResponseSchema>;

// === Message Edge Function Types ===

export const SendMessageRequestSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1),
  recipient_id: z.string().uuid().optional(),
  recipient_email: z.string().email().optional(),
  type: z.enum(['message', 'site_transfer_request', 'system']).optional(),
  metadata: z.record(z.any()).optional(),
});

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

// === WordPress.org API Types ===

export const SearchWordPressPluginsRequestSchema = z.object({
  search: z.string().min(1),
  per_page: z.number().int().positive().max(100).optional(),
  page: z.number().int().positive().optional(),
});

export type SearchWordPressPluginsRequest = z.infer<typeof SearchWordPressPluginsRequestSchema>;

export const SearchWordPressThemesRequestSchema = z.object({
  search: z.string().min(1),
  per_page: z.number().int().positive().max(100).optional(),
  page: z.number().int().positive().optional(),
});

export type SearchWordPressThemesRequest = z.infer<typeof SearchWordPressThemesRequestSchema>;

export const GetWordPressPluginDataRequestSchema = z.object({
  slug: z.string().min(1),
});

export type GetWordPressPluginDataRequest = z.infer<typeof GetWordPressPluginDataRequestSchema>;

export const DownloadPluginFromWordPressRequestSchema = z.object({
  slug: z.string().min(1),
  version: z.string().optional(),
});

export type DownloadPluginFromWordPressRequest = z.infer<typeof DownloadPluginFromWordPressRequestSchema>;

// === Subscription Edge Function Types ===

export const CreateCheckoutSessionRequestSchema = z.object({
  plan_id: z.string().uuid(),
  billing_cycle: z.enum(['monthly', 'annual']),
  discount_code: z.string().optional(),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

export type CreateCheckoutSessionRequest = z.infer<typeof CreateCheckoutSessionRequestSchema>;

export const CreateCheckoutSessionResponseSchema = ApiResponseSchema.extend({
  session_id: z.string().optional(),
  checkout_url: z.string().url().optional(),
});

export type CreateCheckoutSessionResponse = z.infer<typeof CreateCheckoutSessionResponseSchema>;

export const AssignManualSubscriptionRequestSchema = z.object({
  user_id: z.string().uuid(),
  plan_name: z.string().min(1),
  duration_days: z.number().int().positive(),
});

export type AssignManualSubscriptionRequest = z.infer<typeof AssignManualSubscriptionRequestSchema>;

export const HandleStripeWebhookRequestSchema = z.object({
  type: z.string().min(1),
  data: z.record(z.any()),
});

export type HandleStripeWebhookRequest = z.infer<typeof HandleStripeWebhookRequestSchema>;

export const ImportStripeInvoicesRequestSchema = z.object({
  user_id: z.string().uuid().optional(),
  limit: z.number().int().positive().optional(),
});

export type ImportStripeInvoicesRequest = z.infer<typeof ImportStripeInvoicesRequestSchema>;

// === Team Edge Function Types ===

export const CreateDefaultTeamRolesRequestSchema = z.object({
  team_id: z.string().uuid(),
});

export type CreateDefaultTeamRolesRequest = z.infer<typeof CreateDefaultTeamRolesRequestSchema>;

// === Admin Edge Function Types ===

export const SyncAllSitesPluginsRequestSchema = z.object({
  force: z.boolean().optional(),
});

export type SyncAllSitesPluginsRequest = z.infer<typeof SyncAllSitesPluginsRequestSchema>;

export const SyncSiteResultSchema = z.object({
  site_id: z.string().uuid(),
  site_name: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});

export const SyncAllSitesPluginsResponseSchema = ApiResponseSchema.extend({
  synced_sites: z.number().int().nonnegative().optional(),
  failed_sites: z.number().int().nonnegative().optional(),
  results: z.array(SyncSiteResultSchema).optional(),
});

export type SyncAllSitesPluginsResponse = z.infer<typeof SyncAllSitesPluginsResponseSchema>;
// === Additional Edge Function Request Schemas ===

export const RequestSiteTransferRequestSchemaUpdated = z.object({
  site_id: z.string().uuid().optional(),
  site_url: z.string().url().optional(),
});

export const GetPluginFileUrlRequestSchemaUpdated = z.object({
  api_key: z.string().min(1),
  plugin_id: z.string().uuid(),
  version_id: z.string().uuid(),
});

export const TestSiteConnectionRequestSchema = z.object({
  site_id: z.string().uuid().optional(),
  api_key: z.string().min(1).optional(),
});

export type TestSiteConnectionRequest = z.infer<typeof TestSiteConnectionRequestSchema>;

export const ActivateThemeRequestSchema = z.object({
  site_id: z.string().uuid(),
  theme_slug: z.string().min(1),
});

export type ActivateThemeRequest = z.infer<typeof ActivateThemeRequestSchema>;

export const UninstallThemeRequestSchema = z.object({
  site_id: z.string().uuid(),
  theme_slug: z.string().min(1),
  theme_id: z.string().uuid().optional(),
});

export type UninstallThemeRequest = z.infer<typeof UninstallThemeRequestSchema>;

export const ParseThemeZipRequestSchema = z.object({
  file_url: z.string().url(),
});

export type ParseThemeZipRequest = z.infer<typeof ParseThemeZipRequestSchema>;

export const ReportCommandStatusRequestSchema = z.object({
  api_key: z.string().min(1),
  installation_id: z.string().uuid(),
  status: z.enum(['success', 'error']),
  error_message: z.string().optional(),
  version: z.string().optional(),
});

export type ReportCommandStatusRequest = z.infer<typeof ReportCommandStatusRequestSchema>;

export const ExecutePluginActionRequestSchema = z.object({
  site_id: z.string().uuid(),
  installation_id: z.string().uuid().optional(),
  action: z.enum(['install', 'update', 'activate', 'deactivate', 'uninstall']),
  file_url: z.string().url().optional(),
  plugin_slug: z.string().min(1).optional(),
});

export type ExecutePluginActionRequest = z.infer<typeof ExecutePluginActionRequestSchema>;

export const AcceptSiteTransferRequestSchema = z.object({
  site_id: z.string().uuid(),
  scheduled_transfer_date: z.string().datetime().optional().nullable(),
  transfer_plugins: z.array(z.string().uuid()).optional(),
  non_transfer_action: z.enum(['disconnect', 'uninstall']).optional(),
});

export type AcceptSiteTransferRequest = z.infer<typeof AcceptSiteTransferRequestSchema>;

export const ChangeSubscriptionRequestSchema = z.object({
  new_plan_id: z.string().uuid(),
  action: z.enum(['upgrade', 'downgrade', 'change']),
});

export type ChangeSubscriptionRequest = z.infer<typeof ChangeSubscriptionRequestSchema>;

export const UpdateSiteDataRequestSchema = z.object({
  site_id: z.string().uuid(),
});

export type UpdateSiteDataRequest = z.infer<typeof UpdateSiteDataRequestSchema>;

export const DeclineSiteTransferRequestSchema = z.object({
  site_id: z.string().uuid(),
});

export type DeclineSiteTransferRequest = z.infer<typeof DeclineSiteTransferRequestSchema>;

export const Verify2FACodeRequestSchema = z.object({
  code: z.string().min(6).max(6),
});

export type Verify2FACodeRequest = z.infer<typeof Verify2FACodeRequestSchema>;

export const UpdateDebugSettingsRequestSchema = z.object({
  site_id: z.string().uuid(),
  wp_debug: z.boolean().optional(),
  wp_debug_log: z.boolean().optional(),
  wp_debug_display: z.boolean().optional(),
});

export type UpdateDebugSettingsRequest = z.infer<typeof UpdateDebugSettingsRequestSchema>;

export const SimulatePluginSyncRequestSchema = z.object({
  site_id: z.string().uuid(),
});

export type SimulatePluginSyncRequest = z.infer<typeof SimulatePluginSyncRequestSchema>;

export const UpdateConnectorPluginRequestSchema = z.object({
  site_id: z.string().uuid(),
});

export type UpdateConnectorPluginRequest = z.infer<typeof UpdateConnectorPluginRequestSchema>;

export const GenerateInvoicePDFRequestSchema = z.object({
  invoice_id: z.string().uuid(),
});

export type GenerateInvoicePDFRequest = z.infer<typeof GenerateInvoicePDFRequestSchema>;

export const UpdateUserAdminRequestSchema = z.object({
  user_id: z.string().uuid(),
  updates: z.record(z.any()),
});

export type UpdateUserAdminRequest = z.infer<typeof UpdateUserAdminRequestSchema>;

export const DeleteUserAdminRequestSchema = z.object({
  user_id: z.string().uuid(),
});

export type DeleteUserAdminRequest = z.infer<typeof DeleteUserAdminRequestSchema>;