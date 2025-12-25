<?php
/**
 * Plugin Name: WP Plugin Hub Connector
 * Plugin URI: https://wphub.pro
 * Description: Verbindt je WordPress site met WP Plugin Hub voor centraal plugin management
 * Version: 4.0.0
 * Author: Code045
 * License: GPL v2 or later
 */

if (!defined('ABSPATH')) exit;

class WPPluginHubConnector {
    private $platform_base_url = 'https://wphub.pro';
    
    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }
    
    public function register_rest_routes() {
        // Get WordPress version
        register_rest_route('wphub/v1', '/getWordPressVersion', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_get_wp_version'),
            'permission_callback' => array($this, 'verify_api_key')
        ));
        
        // Install plugin
        register_rest_route('wphub/v1', '/installPlugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_install_plugin'),
            'permission_callback' => array($this, 'verify_api_key')
        ));
        
        // Activate plugin
        register_rest_route('wphub/v1', '/activatePlugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_activate_plugin'),
            'permission_callback' => array($this, 'verify_api_key')
        ));
        
        // Deactivate plugin
        register_rest_route('wphub/v1', '/deactivatePlugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_deactivate_plugin'),
            'permission_callback' => array($this, 'verify_api_key')
        ));
        
        // Uninstall plugin
        register_rest_route('wphub/v1', '/uninstallPlugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_uninstall_plugin'),
            'permission_callback' => array($this, 'verify_api_key')
        ));
    }
    
    public function verify_api_key($request) {
        $body = $request->get_json_params();
        $provided_key = isset($body['api_key']) ? $body['api_key'] : '';
        $stored_key = get_option('wphub_api_key');
        
        return $provided_key === $stored_key && !empty($stored_key);
    }
    
    public function handle_get_wp_version($request) {
        $result = $this->exec_wp_cli('core version');
        
        if ($result['success']) {
            return new WP_REST_Response(array(
                'success' => true,
                'wp_version' => trim($result['output']),
                'message' => 'WordPress version retrieved'
            ), 200);
        } else {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => $result['output']
            ), 500);
        }
    }
    
    public function handle_install_plugin($request) {
        $body = $request->get_json_params();
        $plugin_slug = $body['plugin_slug'];
        $file_url = $body['file_url'];
        $version = isset($body['version']) ? $body['version'] : null;
        
        error_log('WP Plugin Hub: Installing plugin: ' . $plugin_slug . ' from ' . $file_url);
        
        $result = $this->exec_wp_cli('plugin install ' . escapeshellarg($file_url) . ' --force --format=json');
        
        if (!$result['success']) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => $result['output']
            ), 500);
        }
        
        // Parse JSON response
        $data = json_decode($result['output'], true);
        
        if (is_array($data) && count($data) > 0) {
            $plugin_data = $data[0];
            
            return new WP_REST_Response(array(
                'success' => $plugin_data['status'] === 'success',
                'message' => 'Plugin installed successfully',
                'version' => isset($plugin_data['version']) ? $plugin_data['version'] : $version,
                'slug' => isset($plugin_data['name']) ? $plugin_data['name'] : $plugin_slug
            ), 200);
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Plugin installed',
            'version' => $version,
            'slug' => $plugin_slug
        ), 200);
    }
    
    public function handle_activate_plugin($request) {
        $body = $request->get_json_params();
        $plugin_slug = $body['plugin_slug'];
        
        error_log('WP Plugin Hub: Activating plugin: ' . $plugin_slug);
        
        $result = $this->exec_wp_cli('plugin activate ' . escapeshellarg($plugin_slug) . ' --format=json');
        
        if (!$result['success']) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => $result['output']
            ), 500);
        }
        
        // Parse JSON response
        $data = json_decode($result['output'], true);
        
        if (is_array($data) && count($data) > 0) {
            $plugin_data = $data[0];
            
            return new WP_REST_Response(array(
                'success' => $plugin_data['status'] === 'success',
                'message' => 'Plugin activated successfully'
            ), 200);
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Plugin activated'
        ), 200);
    }
    
    public function handle_deactivate_plugin($request) {
        $body = $request->get_json_params();
        $plugin_slug = $body['plugin_slug'];
        
        error_log('WP Plugin Hub: Deactivating plugin: ' . $plugin_slug);
        
        $result = $this->exec_wp_cli('plugin deactivate ' . escapeshellarg($plugin_slug) . ' --format=json');
        
        if (!$result['success']) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => $result['output']
            ), 500);
        }
        
        // Parse JSON response
        $data = json_decode($result['output'], true);
        
        if (is_array($data) && count($data) > 0) {
            $plugin_data = $data[0];
            
            return new WP_REST_Response(array(
                'success' => $plugin_data['status'] === 'success',
                'message' => 'Plugin deactivated successfully'
            ), 200);
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Plugin deactivated'
        ), 200);
    }
    
    public function handle_uninstall_plugin($request) {
        $body = $request->get_json_params();
        $plugin_slug = $body['plugin_slug'];
        
        error_log('WP Plugin Hub: Uninstalling plugin: ' . $plugin_slug);
        
        // First deactivate
        $this->exec_wp_cli('plugin deactivate ' . escapeshellarg($plugin_slug));
        
        // Then delete
        $result = $this->exec_wp_cli('plugin delete ' . escapeshellarg($plugin_slug) . ' --format=json');
        
        if (!$result['success']) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => $result['output']
            ), 500);
        }
        
        // Parse JSON response
        $data = json_decode($result['output'], true);
        
        if (is_array($data) && count($data) > 0) {
            $plugin_data = $data[0];
            
            return new WP_REST_Response(array(
                'success' => $plugin_data['status'] === 'success',
                'message' => 'Plugin uninstalled successfully'
            ), 200);
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Plugin uninstalled'
        ), 200);
    }
    
    private function exec_wp_cli($command, $log = true) {
        if (!class_exists('WP_CLI')) {
            if ($log) {
                error_log('WP Plugin Hub: WP-CLI internal API not available');
            }
            return array('success' => false, 'output' => 'WP-CLI not available');
        }
        
        if ($log) {
            error_log('WP Plugin Hub: Executing WP-CLI: ' . $command);
        }
        
        ob_start();
        
        try {
            WP_CLI::run_command(explode(' ', $command));
            $output = ob_get_clean();
            
            if ($log) {
                error_log('WP Plugin Hub: WP-CLI output: ' . $output);
            }
            
            return array(
                'success' => true,
                'output' => $output
            );
        } catch (Exception $e) {
            ob_end_clean();
            
            if ($log) {
                error_log('WP Plugin Hub: WP-CLI error: ' . $e->getMessage());
            }
            
            return array(
                'success' => false,
                'output' => $e->getMessage()
            );
        }
    }
    
    public function add_admin_menu() {
        add_options_page(
            'WP Plugin Hub',
            'WP Plugin Hub',
            'manage_options',
            'wp-plugin-hub',
            array($this, 'settings_page')
        );
    }
    
    public function register_settings() {
        register_setting('wphub_settings', 'wphub_api_key');
    }
    
    public function settings_page() {
        ?>
        <div class="wrap">
            <h1>WP Plugin Hub Connector</h1>
            <form method="post" action="options.php">
                <?php
                settings_fields('wphub_settings');
                do_settings_sections('wphub_settings');
                ?>
                <table class="form-table">
                    <tr>
                        <th scope="row">API Key</th>
                        <td>
                            <input type="text" name="wphub_api_key" 
                                   value="<?php echo esc_attr(get_option('wphub_api_key')); ?>" 
                                   class="regular-text" />
                            <p class="description">Voer de API key in van je WP Plugin Hub site</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
            
            <hr>
            
            <h2>Status</h2>
            <?php
            $api_key = get_option('wphub_api_key');
            if ($api_key) {
                echo '<p><span class="dashicons dashicons-yes-alt" style="color: green;"></span> API Key is ingesteld</p>';
                
                if (class_exists('WP_CLI')) {
                    echo '<p><span class="dashicons dashicons-yes-alt" style="color: green;"></span> WP-CLI beschikbaar</p>';
                } else {
                    echo '<p><span class="dashicons dashicons-warning" style="color: red;"></span> WP-CLI niet beschikbaar. Deze plugin vereist WP-CLI.</p>';
                }
            } else {
                echo '<p><span class="dashicons dashicons-warning" style="color: orange;"></span> API Key is niet ingesteld</p>';
            }
            ?>
        </div>
        <?php
    }
}

new WPPluginHubConnector();