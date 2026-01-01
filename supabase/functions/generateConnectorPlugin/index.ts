import JSZip from 'npm:jszip@3.10.1';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authMeWithToken, extractBearerFromReq, uploadToStorage, jsonResponse } from '../_helpers.ts';
import { corsHeaders } from '../_helpers.ts';

function generateMainPluginFile(apiKey: string, hubUrl: string, version: string) {
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

// Autoloader
spl_autoload_register(function(\$class) {
    if (strpos(\$class, 'WPPluginHub' . chr(92)) !== 0) {
        return;
    }
    \$file = WPHC_PLUGIN_DIR . 'includes/' . str_replace(chr(92), '/', substr(\$class, 13)) . '.php';
    if (file_exists(\$file)) {
        require_once \$file;
    }
});

/**
 * Initialize the connector plugin
 */
function wp_plugin_hub_connector_init() {
    load_plugin_textdomain(
        'wp-plugin-hub-connector',
        false,
        dirname(plugin_basename(__FILE__)) . '/languages'
    );

    if (class_exists('\\WPPluginHub\\Connector')) {
        \\WPPluginHub\\Connector::getInstance()->init();
    }
}

add_action('plugins_loaded', 'wp_plugin_hub_connector_init');

function wp_plugin_hub_connector_activate() {
    if (class_exists('\\WPPluginHub\\Connector')) {
        \\WPPluginHub\\Connector::getInstance()->activate();
    }
}

function wp_plugin_hub_connector_deactivate() {
    if (class_exists('\\WPPluginHub\\Connector')) {
        \\WPPluginHub\\Connector::getInstance()->deactivate();
    }
}

register_activation_hook(__FILE__, 'wp_plugin_hub_connector_activate');
register_deactivation_hook(__FILE__, 'wp_plugin_hub_connector_deactivate');
`;
}

function generateConnectorClass() {
  return `<?php
namespace WPPluginHub;

class Connector {
    private static \$instance = null;
    private \$api_endpoint;

    private function __construct() {
        \$this->api_endpoint = rtrim(WPHC_HUB_URL, '/') . '/api';
    }

    public static function getInstance() {
        if (self::\$instance === null) {
            self::\$instance = new self();
        }
        return self::\$instance;
    }

    public function init() {
        add_action('admin_menu', array(\$this, 'add_admin_menu'));
        add_action('wp_ajax_wphc_sync_plugins', array(\$this, 'sync_plugins'));
        add_action('wp_ajax_wphc_sync_themes', array(\$this, 'sync_themes'));
        add_action('wp_ajax_wphc_install_plugin', array(\$this, 'install_plugin'));
        add_action('wp_ajax_wphc_install_theme', array(\$this, 'install_theme'));
        add_action('wp_ajax_wphc_get_status', array(\$this, 'get_status'));
    }

    public function activate() {
        // Create custom post types if needed
        \$this->create_log_table();
    }

    public function deactivate() {
        // Cleanup on deactivation
    }

    public function add_admin_menu() {
        add_menu_page(
            'WP Plugin Hub',
            'Plugin Hub',
            'manage_options',
            'wp-plugin-hub',
            array(\$this, 'render_admin_page'),
            'dashicons-store'
        );
    }

    public function render_admin_page() {
        echo '<div class="wrap"><h1>WP Plugin Hub Connector</h1>';
        echo '<p>Hub URL: ' . esc_url(WPHC_HUB_URL) . '</p>';
        echo '<button class="button button-primary" onclick="wphc_sync_plugins()">Sync Plugins</button>';
        echo '<button class="button button-primary" onclick="wphc_sync_themes()">Sync Themes</button>';
        echo '<div id="wphc-status"></div>';
        echo '</div>';
        echo '<script>
            function wphc_sync_plugins() {
                jQuery.post(ajaxurl, {action: "wphc_sync_plugins"}, function(data) {
                    jQuery("#wphc-status").html(data);
                });
            }
            function wphc_sync_themes() {
                jQuery.post(ajaxurl, {action: "wphc_sync_themes"}, function(data) {
                    jQuery("#wphc-status").html(data);
                });
            }
        </script>';
    }

    public function sync_plugins() {
        check_ajax_referer('wphc_nonce');

        \$response = wp_remote_get(
            \$this->api_endpoint . '/connectors/plugins',
            array(
                'headers' => array(
                    'Authorization' => 'Bearer ' . WPHC_API_KEY,
                    'Content-Type' => 'application/json',
                ),
            )
        );

        if (is_wp_error(\$response)) {
            wp_send_json_error('Failed to connect to hub: ' . \$response->get_error_message());
        }

        \$body = json_decode(wp_remote_retrieve_body(\$response), true);
        \$this->log('Synced ' . count(\$body['plugins'] ?? []) . ' plugins');
        wp_send_json_success('Plugins synced: ' . count(\$body['plugins'] ?? []));
    }

    public function sync_themes() {
        check_ajax_referer('wphc_nonce');

        \$response = wp_remote_get(
            \$this->api_endpoint . '/connectors/themes',
            array(
                'headers' => array(
                    'Authorization' => 'Bearer ' . WPHC_API_KEY,
                    'Content-Type' => 'application/json',
                ),
            )
        );

        if (is_wp_error(\$response)) {
            wp_send_json_error('Failed to connect to hub: ' . \$response->get_error_message());
        }

        \$body = json_decode(wp_remote_retrieve_body(\$response), true);
        \$this->log('Synced ' . count(\$body['themes'] ?? []) . ' themes');
        wp_send_json_success('Themes synced: ' . count(\$body['themes'] ?? []));
    }

    public function install_plugin() {
        check_ajax_referer('wphc_nonce');
        check_admin_ajax();

        \$plugin_id = sanitize_text_field(\$_POST['plugin_id'] ?? '');
        if (!empty(\$plugin_id)) {
            PluginManager::getInstance()->install(\$plugin_id);
        }
    }

    public function install_theme() {
        check_ajax_referer('wphc_nonce');
        check_admin_ajax();

        \$theme_id = sanitize_text_field(\$_POST['theme_id'] ?? '');
        if (!empty(\$theme_id)) {
            ThemeManager::getInstance()->install(\$theme_id);
        }
    }

    public function get_status() {
        wp_send_json_success(array(
            'version' => WPHC_VERSION,
            'hub_url' => WPHC_HUB_URL,
            'connected' => \$this->verify_connection(),
        ));
    }

    private function verify_connection() {
        \$response = wp_remote_get(
            \$this->api_endpoint . '/connectors/version',
            array(
                'headers' => array(
                    'Authorization' => 'Bearer ' . WPHC_API_KEY,
                ),
                'timeout' => 5,
            )
        );
        return !is_wp_error(\$response) && wp_remote_retrieve_response_code(\$response) === 200;
    }

    private function create_log_table() {
        global \$wpdb;
        \$charset_collate = \$wpdb->get_charset_collate();
        \$sql = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}wphc_logs (
            id mediumint(9) NOT NULL auto_increment,
            time datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            message text NOT NULL,
            type varchar(20) NOT NULL,
            PRIMARY KEY  (id)
        ) \$charset_collate;";
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta(\$sql);
    }

    private function log(\$message, \$type = 'info') {
        global \$wpdb;
        \$wpdb->insert(
            \$wpdb->prefix . 'wphc_logs',
            array(
                'message' => \$message,
                'type' => \$type,
            ),
            array('%s', '%s')
        );
    }
}
`;
}

function generatePluginManager() {
  return `<?php
namespace WPPluginHub;

class PluginManager {
    private static \$instance = null;

    private function __construct() {}

    public static function getInstance() {
        if (self::\$instance === null) {
            self::\$instance = new self();
        }
        return self::\$instance;
    }

    public function install(\$plugin_id) {
        require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

        \$plugin_api = plugins_api('plugin_information', array('slug' => \$plugin_id));
        if (is_wp_error(\$plugin_api)) {
            return \$plugin_api;
        }

        \$upgrader = new \\Plugin_Upgrader();
        \$result = \$upgrader->install(\$plugin_api->download_link);

        if (is_wp_error(\$result)) {
            return \$result;
        }

        activate_plugin(\$upgrader->plugin_info());
        return true;
    }

    public function get_installed() {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
        return get_plugins();
    }

    public function get_active() {
        return get_option('active_plugins', array());
    }
}
`;
}

function generateThemeManager() {
  return `<?php
namespace WPPluginHub;

class ThemeManager {
    private static \$instance = null;

    private function __construct() {}

    public static function getInstance() {
        if (self::\$instance === null) {
            self::\$instance = new self();
        }
        return self::\$instance;
    }

    public function install(\$theme_id) {
        require_once ABSPATH . 'wp-admin/includes/theme-install.php';
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

        \$theme_api = themes_api('theme_information', array('slug' => \$theme_id));
        if (is_wp_error(\$theme_api)) {
            return \$theme_api;
        }

        \$upgrader = new \\Theme_Upgrader();
        \$result = \$upgrader->install(\$theme_api->download_link);

        return is_wp_error(\$result) ? \$result : true;
    }

    public function get_installed() {
        return wp_get_themes();
    }

    public function get_active() {
        return wp_get_theme();
    }
}
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

    const zip = new JSZip();

    // Generate all plugin files
    if (custom_code) {
      const mainCode = custom_code.replace(/\{\{API_KEY\}\}/g, api_key || '{{API_KEY}}').replace(/\{\{HUB_URL\}\}/g, hub_url || '{{HUB_URL}}').replace(/\{\{VERSION\}\}/g, version);
      zip.file('wp-plugin-hub-connector/wp-plugin-hub-connector.php', mainCode);
    } else {
      if (!api_key || !hub_url) return jsonResponse({ error: 'API key and hub URL required for template' }, 400);
      
      // Generate main plugin file
      zip.file('wp-plugin-hub-connector/wp-plugin-hub-connector.php', generateMainPluginFile(api_key, hub_url, version));
      
      // Generate includes directory
      zip.file('wp-plugin-hub-connector/includes/Connector.php', generateConnectorClass());
      zip.file('wp-plugin-hub-connector/includes/PluginManager.php', generatePluginManager());
      zip.file('wp-plugin-hub-connector/includes/ThemeManager.php', generateThemeManager());
      
      // Generate readme
      zip.file('wp-plugin-hub-connector/README.md', `# WP Plugin Hub Connector v${version}

This connector plugin enables automatic plugin and theme management from WP Plugin Hub.

## Installation

1. Download the zip file
2. Upload to your WordPress plugins directory
3. Activate the plugin
4. Go to Plugin Hub menu to configure

## Features

- Sync plugins and themes from your hub
- Install and manage plugins remotely
- Install and manage themes remotely
- One-click synchronization
- Activity logging

## Support

Visit ${hub_url} for support and documentation.
`);
    }

    const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const fileName = `wp-plugin-hub-connector-v${version}.zip`;
    const uploadRes = await uploadToStorage(fileName, zipBytes, 'uploads', 'application/zip');

    // Create connector record in Supabase via REST
    const supaUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const connectorRes = await fetch(`${supaUrl}/rest/v1/connectors`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ version, plugin_code: generateMainPluginFile(api_key, hub_url, version), file_url: uploadRes.file_url, description })
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
