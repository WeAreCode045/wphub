import JSZip from 'npm:jszip@3.10.1';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authMeWithToken, extractBearerFromReq, uploadToStorage, jsonResponse } from '../_helpers.ts';
import { corsHeaders } from '../_helpers.ts';

function generateConnectorPluginCode(apiKey: string, hubUrl: string, version: string) {
  return `<?php
/**
 * Plugin Name: WP Plugin Hub Connector
 * Plugin URI: ${hubUrl}
 * Description: Connector plugin for WP Plugin Hub - Manages plugins and themes from your hub
 * Version: ${version}
 * Author: WP Plugin Hub
 * Author URI: ${hubUrl}
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wp-plugin-hub-connector
 * Domain Path: /languages
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('WPHC_VERSION', '${version}');
define('WPHC_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WPHC_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WPHC_API_KEY', '${apiKey}');
define('WPHC_HUB_URL', '${hubUrl}');

// Require helper files
require_once WPHC_PLUGIN_DIR . 'includes/class-connector.php';
require_once WPHC_PLUGIN_DIR . 'includes/class-plugin-manager.php';
require_once WPHC_PLUGIN_DIR . 'includes/class-theme-manager.php';

/**
 * Initialize the connector plugin
 */
function wp_plugin_hub_connector_init() {
    // Load translations
    load_plugin_textdomain(
        'wp-plugin-hub-connector',
        false,
        dirname(plugin_basename(__FILE__)) . '/languages'
    );

    // Initialize the connector
    if (class_exists('\\WPPluginHub\\Connector')) {
        \\WPPluginHub\\Connector::getInstance()->init();
    }
}

add_action('plugins_loaded', 'wp_plugin_hub_connector_init');

/**
 * Activation hook
 */
function wp_plugin_hub_connector_activate() {
    if (class_exists('\\WPPluginHub\\Connector')) {
        \\WPPluginHub\\Connector::getInstance()->activate();
    }
}

register_activation_hook(__FILE__, 'wp_plugin_hub_connector_activate');

/**
 * Deactivation hook
 */
function wp_plugin_hub_connector_deactivate() {
    if (class_exists('\\WPPluginHub\\Connector')) {
        \\WPPluginHub\\Connector::getInstance()->deactivate();
    }
}

register_deactivation_hook(__FILE__, 'wp_plugin_hub_connector_deactivate');
`;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )
      
      const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.role !== 'admin') return jsonResponse({ error: 'Unauthorized - Admin required' }, 403);

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (e) {
      return jsonResponse({ error: 'Invalid JSON in request body: ' + (e instanceof Error ? e.message : String(e)) }, 400);
    }

    const { api_key, hub_url, version, description, custom_code } = requestBody;
    if (!version) return jsonResponse({ error: 'Version is required' }, 400);

    let pluginCode = '';
    if (custom_code) {
      pluginCode = custom_code.replace(/\{\{API_KEY\}\}/g, api_key || '{{API_KEY}}').replace(/\{\{HUB_URL\}\}/g, hub_url || '{{HUB_URL}}').replace(/\{\{VERSION\}\}/g, version);
    } else {
      if (!api_key || !hub_url) return jsonResponse({ error: 'API key and hub URL required for template' }, 400);
      pluginCode = generateConnectorPluginCode(api_key, hub_url, version);
    }

    const zip = new JSZip();
    zip.file('wp-plugin-hub-connector/wp-plugin-hub-connector.php', pluginCode);
    const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const fileName = `wp-plugin-hub-connector-v${version}.zip`;
    const uploadRes = await uploadToStorage(fileName, zipBytes, 'uploads', 'application/zip');

    // Create connector record in Supabase via REST
    const supaUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const connectorRes = await fetch(`${supaUrl}/rest/v1/connectors`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ version, plugin_code: pluginCode, file_url: uploadRes.file_url, description })
    });
    if (!connectorRes.ok) {
      const txt = await connectorRes.text().catch(()=>'');
      throw new Error('Failed to create connector: '+txt);
    }
    const connector = await connectorRes.json();

    // Update site_settings active_connector_version
    await fetch(`${supaUrl}/rest/v1/site_settings`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ setting_key: 'active_connector_version', setting_value: version, description: 'Active connector version' })
    }).catch(()=>{});

    return jsonResponse({ success: true, file_url: uploadRes.file_url, version, connector_id: connector[0]?.id || null });

  } catch (err: any) {
    console.error('generateConnectorPlugin error', err);
    return jsonResponse({ error: err.message || String(err) }, 500);
  }
});

export {};
