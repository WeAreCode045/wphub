import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import JSZip from 'npm:jszip@3.10.1';

// Template content - embedded directly in the function
const TEMPLATE_CONTENT = `<?php
/**
 * Plugin Name: WP Plugin Hub Connector
 * Plugin URI: https://pluginhub.code045.nl
 * Description: Connects WordPress site to Plugin Hub for centralized plugin management
 * Version: {{VERSION}}
 * Author: Plugin Hub
 * Author URI: https://pluginhub.code045.nl
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
        $params = $request->get_json_params();
        $provided_key = isset($params['api_key']) ? $params['api_key'] : '';
        
        return $provided_key === $this->api_key;
    }
    
    public function rest_ping($request) {
        $plugins = get_plugins();
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Connection successful',
            'wp_version' => get_bloginfo('version'),
            'site_url' => get_site_url(),
            'site_name' => get_bloginfo('name'),
            'plugins_count' => count($plugins)
        ), 200);
    }
    
    public function rest_install_plugin($request) {
        $params = $request->get_json_params();
        $plugin_slug = isset($params['plugin_slug']) ? $params['plugin_slug'] : '';
        $file_url = isset($params['file_url']) ? $params['file_url'] : '';
        
        $result = $this->install_plugin($plugin_slug, $file_url);
        
        if ($result['success']) {
            return new WP_REST_Response($result, 200);
        } else {
            return new WP_REST_Response($result, 500);
        }
    }
    
    public function rest_activate_plugin($request) {
        $params = $request->get_json_params();
        $plugin_slug = isset($params['plugin_slug']) ? $params['plugin_slug'] : '';
        
        $result = $this->activate_plugin($plugin_slug);
        
        if ($result['success']) {
            return new WP_REST_Response($result, 200);
        } else {
            return new WP_REST_Response($result, 500);
        }
    }
    
    public function rest_deactivate_plugin($request) {
        $params = $request->get_json_params();
        $plugin_slug = isset($params['plugin_slug']) ? $params['plugin_slug'] : '';
        
        $result = $this->deactivate_plugin($plugin_slug);
        
        if ($result['success']) {
            return new WP_REST_Response($result, 200);
        } else {
            return new WP_REST_Response($result, 500);
        }
    }
    
    public function rest_uninstall_plugin($request) {
        $params = $request->get_json_params();
        $plugin_slug = isset($params['plugin_slug']) ? $params['plugin_slug'] : '';
        
        $result = $this->uninstall_plugin($plugin_slug);
        
        if ($result['success']) {
            return new WP_REST_Response($result, 200);
        } else {
            return new WP_REST_Response($result, 500);
        }
    }
    
    public function add_admin_menu() {
        add_options_page(
            'WP Plugin Hub',
            'Plugin Hub',
            'manage_options',
            'wp-plugin-hub',
            array($this, 'settings_page')
        );
    }
    
    public function register_settings() {
        register_setting('wp_plugin_hub_settings', 'wp_plugin_hub_api_key');
        register_setting('wp_plugin_hub_settings', 'wp_plugin_hub_site_id');
    }
    
    public function settings_page() {
        ?>
        <div class="wrap">
            <h1>WP Plugin Hub Connector</h1>
            <form method="post" action="options.php">
                <?php
                settings_fields('wp_plugin_hub_settings');
                do_settings_sections('wp_plugin_hub_settings');
                ?>
                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="wp_plugin_hub_api_key">API Key</label>
                        </th>
                        <td>
                            <input type="text" 
                                   id="wp_plugin_hub_api_key" 
                                   name="wp_plugin_hub_api_key" 
                                   value="<?php echo esc_attr($this->api_key); ?>" 
                                   class="regular-text" />
                            <p class="description">
                                Enter the API key from your Plugin Hub dashboard
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Platform URL</th>
                        <td>
                            <code><?php echo esc_html($this->platform_url); ?></code>
                        </td>
                    </tr>
                    <?php if (!empty($this->site_id)): ?>
                    <tr>
                        <th scope="row">Site ID</th>
                        <td>
                            <code><?php echo esc_html($this->site_id); ?></code>
                            <p class="description">
                                Your site is connected and synchronized with the platform
                            </p>
                        </td>
                    </tr>
                    <?php endif; ?>
                    <tr>
                        <th scope="row">Connection Status</th>
                        <td>
                            <?php
                            if (empty($this->api_key)) {
                                echo '<span style="color: orange;">⚠ Not configured - Please enter API key</span>';
                            } else {
                                $status = $this->test_connection();
                                if ($status['success']) {
                                    echo '<span style="color: green;">✓ Connected</span>';
                                    if (!empty($status['site_id'])) {
                                        echo '<p class="description">Site ID: ' . esc_html($status['site_id']) . '</p>';
                                    }
                                } else {
                                    echo '<span style="color: red;">✗ Connection failed: ' . esc_html($status['error']) . '</span>';
                                }
                            }
                            ?>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
            
            <hr>
            
            <h2>Manual Actions</h2>
            <div style="margin-bottom: 20px;">
                <h3>Test Connection</h3>
                <p>Test the connection and retrieve your Site ID from the platform.</p>
                <button type="button" class="button button-secondary" onclick="wpPluginHubTestConnection()">
                    Test Connection
                </button>
                <div id="test-result" style="margin-top: 10px;"></div>
            </div>
            
            <div>
                <h3>Manual Sync</h3>
                <p>Manually sync your plugins with the platform.</p>
                <button type="button" class="button button-secondary" onclick="wpPluginHubManualSync()">
                    Sync Now
                </button>
                <div id="sync-result" style="margin-top: 10px;"></div>
            </div>
            
            <script>
            function wpPluginHubTestConnection() {
                var resultDiv = document.getElementById('test-result');
                resultDiv.innerHTML = 'Testing connection...';
                
                fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: 'action=wp_plugin_hub_test_connection'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        var result = data.data;
                        resultDiv.innerHTML = '<span style="color: green;">✓ Connection successful!</span><br>' +
                            '<strong>Site ID:</strong> ' + result.site_id + '<br>' +
                            '<strong>Site Name:</strong> ' + result.site_name + '<br>' +
                            '<p style="color: green;">Site ID has been saved automatically.</p>';
                    } else {
                        resultDiv.innerHTML = '<span style="color: red;">✗ Connection failed: ' + data.data + '</span>';
                    }
                })
                .catch(error => {
                    resultDiv.innerHTML = '<span style="color: red;">✗ Error: ' + error.message + '</span>';
                });
            }
            
            function wpPluginHubManualSync() {
                var resultDiv = document.getElementById('sync-result');
                resultDiv.innerHTML = 'Syncing...';
                
                fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: 'action=wp_plugin_hub_manual_sync'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        resultDiv.innerHTML = '<span style="color: green;">✓ Sync successful!</span>';
                    } else {
                        resultDiv.innerHTML = '<span style="color: red;">✗ Sync failed: ' + data.data + '</span>';
                    }
                })
                .catch(error => {
                    resultDiv.innerHTML = '<span style="color: red;">✗ Error: ' + error.message + '</span>';
                });
            }
            </script>
        </div>
        <?php
    }
    
    public function test_connection() {
        if (empty($this->api_key)) {
            return array('success' => false, 'error' => 'API key not configured');
        }
        
        $response = wp_remote_post($this->platform_url . '/functions/testSiteConnection', array(
            'body' => json_encode(array('api_key' => $this->api_key)),
            'headers' => array('Content-Type' => 'application/json'),
            'timeout' => 15
        ));
        
        if (is_wp_error($response)) {
            return array('success' => false, 'error' => $response->get_error_message());
        }
        
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        // If successful and we got a site_id, save it
        if ($body['success'] && !empty($body['site_id'])) {
            update_option('wp_plugin_hub_site_id', $body['site_id']);
            $this->site_id = $body['site_id'];
        }
        
        return $body;
    }
    
    public function sync_with_platform() {
        if (empty($this->api_key)) {
            return;
        }
        
        $plugins = get_plugins();
        $active_plugins = get_option('active_plugins', array());
        
        $plugin_data = array();
        foreach ($plugins as $plugin_file => $plugin_info) {
            $plugin_data[] = array(
                'slug' => dirname($plugin_file),
                'name' => $plugin_info['Name'],
                'version' => $plugin_info['Version'],
                'is_active' => in_array($plugin_file, $active_plugins) ? 1 : 0
            );
        }
        
        $data = array(
            'api_key' => $this->api_key,
            'wp_version' => get_bloginfo('version'),
            'plugins' => $plugin_data
        );
        
        wp_remote_post($this->platform_url . '/functions/syncSiteData', array(
            'body' => json_encode($data),
            'headers' => array('Content-Type' => 'application/json'),
            'timeout' => 30
        ));
    }
    
    public function check_and_execute_commands() {
        if (empty($this->api_key)) {
            return;
        }
        
        $response = wp_remote_post($this->platform_url . '/functions/getPluginCommands', array(
            'body' => json_encode(array('api_key' => $this->api_key)),
            'headers' => array('Content-Type' => 'application/json'),
            'timeout' => 15
        ));
        
        if (is_wp_error($response)) {
            return;
        }
        
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        if (!empty($body['commands'])) {
            foreach ($body['commands'] as $command) {
                $this->execute_command($command);
            }
        }
    }
    
    private function execute_command($command) {
        $result = array(
            'success' => false,
            'message' => ''
        );
        
        switch ($command['action']) {
            case 'install':
                $result = $this->install_plugin($command['plugin_slug'], $command['file_url']);
                break;
                
            case 'activate':
                $result = $this->activate_plugin($command['plugin_slug']);
                break;
                
            case 'deactivate':
                $result = $this->deactivate_plugin($command['plugin_slug']);
                break;
                
            case 'uninstall':
                $result = $this->uninstall_plugin($command['plugin_slug']);
                break;
        }
        
        // Report back to platform
        wp_remote_post($this->platform_url . '/functions/reportCommandStatus', array(
            'body' => json_encode(array(
                'api_key' => $this->api_key,
                'command_id' => $command['id'],
                'success' => $result['success'],
                'message' => $result['message']
            )),
            'headers' => array('Content-Type' => 'application/json'),
            'timeout' => 15
        ));
        
        // Sync after command execution
        $this->sync_with_platform();
    }
    
    private function install_plugin($slug, $download_url) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
        
        $upgrader = new Plugin_Upgrader(new WP_Ajax_Upgrader_Skin());
        $result = $upgrader->install($download_url);
        
        if (is_wp_error($result)) {
            return array('success' => false, 'message' => $result->get_error_message());
        }
        
        return array('success' => true, 'message' => 'Plugin installed successfully');
    }
    
    private function activate_plugin($slug) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
        
        $plugins = get_plugins();
        $plugin_file = null;
        
        foreach ($plugins as $file => $info) {
            if (dirname($file) === $slug || $file === $slug . '.php') {
                $plugin_file = $file;
                break;
            }
        }
        
        if (!$plugin_file) {
            return array('success' => false, 'message' => 'Plugin not found');
        }
        
        $result = activate_plugin($plugin_file);
        
        if (is_wp_error($result)) {
            return array('success' => false, 'message' => $result->get_error_message());
        }
        
        return array('success' => true, 'message' => 'Plugin activated successfully');
    }
    
    private function deactivate_plugin($slug) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
        
        $plugins = get_plugins();
        $plugin_file = null;
        
        foreach ($plugins as $file => $info) {
            if (dirname($file) === $slug || $file === $slug . '.php') {
                $plugin_file = $file;
                break;
            }
        }
        
        if (!$plugin_file) {
            return array('success' => false, 'message' => 'Plugin not found');
        }
        
        deactivate_plugins($plugin_file);
        
        return array('success' => true, 'message' => 'Plugin deactivated successfully');
    }
    
    private function uninstall_plugin($slug) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
        
        $plugins = get_plugins();
        $plugin_file = null;
        
        foreach ($plugins as $file => $info) {
            if (dirname($file) === $slug || $file === $slug . '.php') {
                $plugin_file = $file;
                break;
            }
        }
        
        if (!$plugin_file) {
            return array('success' => false, 'message' => 'Plugin not found');
        }
        
        // Deactivate first
        deactivate_plugins($plugin_file);
        
        // Delete plugin
        $result = delete_plugins(array($plugin_file));
        
        if (is_wp_error($result)) {
            return array('success' => false, 'message' => $result->get_error_message());
        }
        
        return array('success' => true, 'message' => 'Plugin uninstalled successfully');
    }
}

// Initialize the plugin
new WP_Plugin_Hub_Connector();

// AJAX handler for test connection
add_action('wp_ajax_wp_plugin_hub_test_connection', function() {
    $connector = new WP_Plugin_Hub_Connector();
    $result = $connector->test_connection();
    
    if ($result['success']) {
        wp_send_json_success($result);
    } else {
        wp_send_json_error($result['error']);
    }
});

// AJAX handler for manual sync
add_action('wp_ajax_wp_plugin_hub_manual_sync', function() {
    $connector = new WP_Plugin_Hub_Connector();
    $connector->sync_with_platform();
    wp_send_json_success('Sync completed');
});

// Activation hook
register_activation_hook(__FILE__, function() {
    // Schedule cron jobs
    if (!wp_next_scheduled('wp_plugin_hub_sync')) {
        wp_schedule_event(time(), 'hourly', 'wp_plugin_hub_sync');
    }
    if (!wp_next_scheduled('wp_plugin_hub_check_commands')) {
        wp_schedule_event(time(), 'every_5_minutes', 'wp_plugin_hub_check_commands');
    }
});

// Deactivation hook
register_deactivation_hook(__FILE__, function() {
    wp_clear_scheduled_hook('wp_plugin_hub_sync');
    wp_clear_scheduled_hook('wp_plugin_hub_check_commands');
});`;

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role !== 'admin') {
            return Response.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }

        const { version, description } = await req.json();

        if (!version) {
            return Response.json({ error: 'Version is required' }, { status: 400 });
        }

        console.log('[generateConnectorPlugin] Starting generation for version:', version);

        // Get platform URL from settings
        const settings = await base44.entities.SiteSettings.list();
        const platformUrl = settings.find(s => s.setting_key === 'platform_url')?.setting_value || 'https://pluginhub.code045.nl';

        console.log('[generateConnectorPlugin] Platform URL:', platformUrl);

        // Replace placeholders in template
        let pluginCode = TEMPLATE_CONTENT
            .replace(/{{VERSION}}/g, version)
            .replace(/{{PLATFORM_URL}}/g, platformUrl);

        console.log('[generateConnectorPlugin] Template processed, creating ZIP...');

        // Create ZIP file
        const zip = new JSZip();
        const folder = zip.folder('wp-plugin-hub-connector');
        folder.file('wp-plugin-hub-connector.php', pluginCode);

        // Generate ZIP
        const zipBlob = await zip.generateAsync({ 
            type: 'uint8array',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });

        console.log('[generateConnectorPlugin] ZIP created, size:', zipBlob.length, 'bytes');

        // Upload to storage
        const zipFile = new File([zipBlob], `wp-plugin-hub-connector-v${version}.zip`, {
            type: 'application/zip'
        });

        const { file_url } = await base44.integrations.Core.UploadFile({ file: zipFile });

        console.log('[generateConnectorPlugin] Uploaded to storage:', file_url);

        // Save connector record
        const connector = await base44.entities.Connector.create({
            version: version,
            file_url: file_url,
            description: description || `Connector Plugin v${version}`
        });

        console.log('[generateConnectorPlugin] Connector record created:', connector.id);

        // Log activity
        await base44.entities.ActivityLog.create({
            user_email: user.email,
            action: `Connector Plugin v${version} gegenereerd`,
            entity_type: 'connector',
            details: file_url
        });

        return Response.json({ 
            success: true,
            connector: connector,
            message: `Connector Plugin v${version} succesvol gegenereerd en geüpload`
        });

    } catch (error) {
        console.error('[generateConnectorPlugin] ❌ ERROR:', error.message);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});