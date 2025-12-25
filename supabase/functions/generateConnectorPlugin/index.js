import { createClientFromRequest } from './base44Shim.js';
import JSZip from 'npm:jszip@3.10.1';

// Template content - embedded directly in the function
const TEMPLATE_CONTENT = `<?php
/**
 * Plugin Name: WP Plugin Hub Connector
 * Plugin URI: https://wphub.pro
 * Description: Connects WordPress site to Plugin Hub for centralized plugin management
 * Version: {{VERSION}}
 * Author: Plugin Hub
 * Author URI: https://wphub.pro
 * Text Domain: wp-plugin-hub-connector
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WP_PLUGIN_HUB_VERSION', '{{VERSION}}');
define('WP_PLUGIN_HUB_PLATFORM_URL', '{{PLATFORM_URL}}');

class WP_Plugin_Hub_Connector {
    private $api_key;
    private $site_id;
    private $platform_url;
    
    public function __construct() {
        $this->platform_url = WP_PLUGIN_HUB_PLATFORM_URL;
        $this->api_key = get_option('wp_plugin_hub_api_key', '');
        $this->site_id = get_option('wp_plugin_hub_site_id', '');
        
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        
        // Schedule cron job for syncing
        if (!wp_next_scheduled('wp_plugin_hub_sync')) {
            wp_schedule_event(time(), 'hourly', 'wp_plugin_hub_sync');
        }
        add_action('wp_plugin_hub_sync', array($this, 'sync_with_platform'));
        
        // Check for pending commands every 5 minutes
        if (!wp_next_scheduled('wp_plugin_hub_check_commands')) {
            wp_schedule_event(time(), 'every_5_minutes', 'wp_plugin_hub_check_commands');
        }
        add_action('wp_plugin_hub_check_commands', array($this, 'check_and_execute_commands'));
        
        // Add custom cron schedule
        add_filter('cron_schedules', array($this, 'add_cron_schedules'));
    }
    
    public function add_cron_schedules($schedules) {
        $schedules['every_5_minutes'] = array(
            'interval' => 300,
            'display'  => __('Every 5 Minutes', 'wp-plugin-hub-connector')
        );
        return $schedules;
    }
    
    public function register_rest_routes() {
        register_rest_route('wphub/v1', '/ping', array(
            'methods' => 'POST',
            'callback' => array($this, 'rest_ping'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
        
        register_rest_route('wphub/v1', '/installPlugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'rest_install_plugin'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
        
        register_rest_route('wphub/v1', '/activatePlugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'rest_activate_plugin'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
        
        register_rest_route('wphub/v1', '/deactivatePlugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'rest_deactivate_plugin'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
        
        register_rest_route('wphub/v1', '/uninstallPlugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'rest_uninstall_plugin'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
    }
    
    public function verify_api_key($request) {
        const params = $request->get_json_params();
        const provided_key = params['api_key'] ? params['api_key'] : '';
        
        return provided_key === $this->api_key;
    }
    
    // (rest of template omitted in Edge copy)
`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { version = '1.0.0', platform_url = Deno.env.get('YOUR_PLATFORM_URL') } = await req.json().catch(() => ({}));

    // Build zip
    const zip = new JSZip();
    const pluginPhp = TEMPLATE_CONTENT.replace(/{{VERSION}}/g, version).replace(/{{PLATFORM_URL}}/g, platform_url);
    zip.file('wp-plugin-hub-connector.php', pluginPhp);

    const content = await zip.generateAsync({ type: 'uint8array' });

    // Upload to Supabase storage via base44Shim.UploadFile
    const uploaded = await base44.integrations.Core.UploadFile({ file: { data: content, name: `wp-plugin-hub-connector-${version}.zip`, type: 'application/zip' }, bucket: 'Connectors' });

    await base44.asServiceRole.entities.Connector.create({
      version,
      file_url: uploaded.file_url
    });

    return Response.json({ success: true, url: uploaded.file_url });
  } catch (err) {
    console.error('generateConnectorPlugin error', err);
    return Response.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
});
