/**
 * API Client for calling Supabase Edge Functions with type safety
 */

import type { EdgeFunctionOptions, ApiResponse } from '@wphub/types';

/** Supabase client interface for Edge Function invocation */
export interface SupabaseClient {
  functions: {
    invoke: (functionName: string, options?: { body?: any; headers?: Record<string, string> }) => Promise<{
      data: any;
      error: any;
    }>;
  };
}

/**
 * Type-safe Edge Function caller
 * 
 * @example
 * ```ts
 * const result = await callEdge<ParsePluginZipResponse>(
 *   supabase,
 *   'parsePluginZip',
 *   { storage_path: 'path/to/plugin.zip' }
 * );
 * ```
 */
export async function callEdge<TResponse = ApiResponse>(
  supabase: SupabaseClient,
  functionName: string,
  body?: Record<string, any>,
  options?: EdgeFunctionOptions
): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: options?.headers,
  });

  if (error) {
    throw new Error(`Edge function ${functionName} failed: ${error.message || error}`);
  }

  return data as TResponse;
}

/**
 * Type-safe Edge Function caller with error handling
 * Returns [data, error] tuple
 */
export async function callEdgeSafe<TResponse = ApiResponse>(
  supabase: SupabaseClient,
  functionName: string,
  body?: Record<string, any>,
  options?: EdgeFunctionOptions
): Promise<[TResponse | null, Error | null]> {
  try {
    const data = await callEdge<TResponse>(supabase, functionName, body, options);
    return [data, null];
  } catch (error) {
    return [null, error as Error];
  }
}

/**
 * Create a typed Edge Function client
 * 
 * @example
 * ```ts
 * const client = createEdgeClient(supabase);
 * const result = await client.parsePluginZip({ storage_path: 'path/to/plugin.zip' });
 * ```
 */
export function createEdgeClient(supabase: SupabaseClient) {
  return {
    // Plugin functions
    parsePluginZip: (body: import('@wphub/types').ParsePluginZipRequest) =>
      callEdge<import('@wphub/types').ParsePluginZipResponse>(supabase, 'parsePluginZip', body),
    
    activatePlugin: (body: import('@wphub/types').ActivatePluginRequest) =>
      callEdge<ApiResponse>(supabase, 'activatePlugin', body),
    
    deactivatePlugin: (body: import('@wphub/types').DeactivatePluginRequest) =>
      callEdge<ApiResponse>(supabase, 'deactivatePlugin', body),
    
    installPlugin: (body: import('@wphub/types').InstallPluginRequest) =>
      callEdge<ApiResponse>(supabase, 'installPlugin', body),
    
    uninstallPlugin: (body: import('@wphub/types').UninstallPluginRequest) =>
      callEdge<ApiResponse>(supabase, 'uninstallPlugin', body),
    
    updatePlugin: (body: import('@wphub/types').UpdatePluginRequest) =>
      callEdge<ApiResponse>(supabase, 'updatePlugin', body),
    
    enablePluginForSite: (body: import('@wphub/types').EnablePluginForSiteRequest) =>
      callEdge<ApiResponse>(supabase, 'enablePluginForSite', body),
    
    togglePluginState: (body: import('@wphub/types').TogglePluginStateRequest) =>
      callEdge<ApiResponse>(supabase, 'togglePluginState', body),
    
    getPluginCommands: (body: import('@wphub/types').GetPluginCommandsRequest) =>
      callEdge<import('@wphub/types').GetPluginCommandsResponse>(supabase, 'getPluginCommands', body),
    
    getPluginFileUrl: (body: import('@wphub/types').GetPluginFileUrlRequest) =>
      callEdge<import('@wphub/types').GetPluginFileUrlResponse>(supabase, 'getPluginFileUrl', body),
    
    // Site functions
    listSitePlugins: (body: import('@wphub/types').ListSitePluginsRequest) =>
      callEdge<import('@wphub/types').ListSitePluginsResponse>(supabase, 'listSitePlugins', body),
    
    listSiteThemes: (body: import('@wphub/types').ListSiteThemesRequest) =>
      callEdge<import('@wphub/types').ListSiteThemesResponse>(supabase, 'listSiteThemes', body),
    
    syncSiteData: (body: import('@wphub/types').SyncSiteDataRequest) =>
      callEdge<import('@wphub/types').SyncSiteDataResponse>(supabase, 'syncSiteData', body),
    
    requestSiteTransfer: (body: import('@wphub/types').RequestSiteTransferRequest) =>
      callEdge<ApiResponse>(supabase, 'requestSiteTransfer', body),
    
    handleSiteTransferRequest: (body: import('@wphub/types').HandleSiteTransferRequest) =>
      callEdge<import('@wphub/types').HandleSiteTransferResponse>(supabase, 'handleSiteTransferRequest', body),
    
    // Connector functions
    getConnectorVersion: () =>
      callEdge<import('@wphub/types').GetConnectorVersionResponse>(supabase, 'getConnectorVersion'),
    
    generateConnectorPlugin: (body?: import('@wphub/types').GenerateConnectorPluginRequest) =>
      callEdge<import('@wphub/types').GenerateConnectorPluginResponse>(supabase, 'generateConnectorPlugin', body),
    
    // Message functions
    sendMessage: (body: import('@wphub/types').SendMessageRequest) =>
      callEdge<ApiResponse>(supabase, 'sendMessage', body),
    
    // WordPress.org functions
    searchWordPressPlugins: (body: import('@wphub/types').SearchWordPressPluginsRequest) =>
      callEdge<ApiResponse>(supabase, 'searchWordPressPlugins', body),
    
    searchWordPressThemes: (body: import('@wphub/types').SearchWordPressThemesRequest) =>
      callEdge<ApiResponse>(supabase, 'searchWordPressThemes', body),
    
    getWordPressPluginData: (body: import('@wphub/types').GetWordPressPluginDataRequest) =>
      callEdge<ApiResponse>(supabase, 'getWordPressPluginData', body),
    
    downloadPluginFromWordPress: (body: import('@wphub/types').DownloadPluginFromWordPressRequest) =>
      callEdge<ApiResponse>(supabase, 'downloadPluginFromWordPress', body),
    
    // Subscription functions
    createCheckoutSession: (body: import('@wphub/types').CreateCheckoutSessionRequest) =>
      callEdge<import('@wphub/types').CreateCheckoutSessionResponse>(supabase, 'createCheckoutSession', body),
    
    assignManualSubscription: (body: import('@wphub/types').AssignManualSubscriptionRequest) =>
      callEdge<ApiResponse>(supabase, 'assignManualSubscription', body),
    
    importStripeInvoices: (body?: import('@wphub/types').ImportStripeInvoicesRequest) =>
      callEdge<ApiResponse>(supabase, 'importStripeInvoices', body),
    
    // Team functions
    createDefaultTeamRoles: (body: import('@wphub/types').CreateDefaultTeamRolesRequest) =>
      callEdge<ApiResponse>(supabase, 'createDefaultTeamRoles', body),
    
    // Admin functions
    syncAllSitesPlugins: (body?: import('@wphub/types').SyncAllSitesPluginsRequest) =>
      callEdge<import('@wphub/types').SyncAllSitesPluginsResponse>(supabase, 'syncAllSitesPlugins', body),
  };
}

/**
 * Export type for the Edge client
 */
export type EdgeClient = ReturnType<typeof createEdgeClient>;
