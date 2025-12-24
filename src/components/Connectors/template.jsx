export const generateConnectorPluginCode = (apiKey) => {
  return `<?php
/**
 * Plugin Name: WP Plugin Hub Connector
 * Description: Verbindt deze WordPress site met WP Plugin Hub voor centraal plugin en theme beheer
 * Version: 2.1.0
 * Author: WP Plugin Hub
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPPluginHubConnector {
    private $api_key = '${apiKey}';
    private $hub_url = 'https://wphub.pro';

    public function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'admin_styles'));
    }

    public function add_admin_menu() {
        add_menu_page(
            'WP Plugin Hub',
            'Plugin Hub',
            'manage_options',
            'wp-plugin-hub',
            array($this, 'admin_page'),
            'dashicons-cloud',
            65
        );
    }

    public function admin_styles($hook) {
        if ($hook !== 'toplevel_page_wp-plugin-hub') {
            return;
        }
        wp_add_inline_style('wp-admin', '
            .wphub-wrap { max-width: 800px; margin: 20px auto; }
            .wphub-card { background: #fff; border: 1px solid #ccd0d4; border-radius: 8px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
            .wphub-card h2 { margin-top: 0; color: #1d2327; display: flex; align-items: center; gap: 10px; }
            .wphub-card h2 .dashicons { color: #6366f1; }
            .wphub-status { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; }
            .wphub-status.connected { background: #d1fae5; color: #065f46; }
            .wphub-status.disconnected { background: #fee2e2; color: #991b1b; }
            .wphub-info { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 16px; margin: 16px 0; }
            .wphub-info p { margin: 0; color: #0369a1; }
            .wphub-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 16px; }
            .wphub-stat { background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center; }
            .wphub-stat-value { font-size: 28px; font-weight: 700; color: #6366f1; }
            .wphub-stat-label { font-size: 13px; color: #64748b; margin-top: 4px; }
            .wphub-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none; }
            .wphub-btn:hover { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #fff; }
            .wphub-footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px; }
        ');
    }

    public function admin_page() {
        global $wp_version;
        
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        
        $all_plugins = get_plugins();
        $all_themes = wp_get_themes();
        $active_plugins = get_option('active_plugins', array());
        $active_theme = wp_get_theme();
        
        ?>
        <div class="wrap wphub-wrap">
            <div class="wphub-card">
                <h2><span class="dashicons dashicons-cloud"></span> WP Plugin Hub Connector</h2>
                <p style="color: #64748b; margin-bottom: 20px;">Beheer je plugins en themes centraal via het WP Plugin Hub dashboard.</p>
                
                <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                    <span class="wphub-status connected">
                        <span class="dashicons dashicons-yes-alt"></span> Verbonden
                    </span>
                    <span style="color: #64748b; font-size: 13px;">
                        Connector v2.1.0 | WordPress <?php echo esc_html($wp_version); ?>
                    </span>
                </div>

                <div class="wphub-info">
                    <p><strong>Dashboard:</strong> <a href="<?php echo esc_url($this->hub_url); ?>" target="_blank"><?php echo esc_html($this->hub_url); ?></a></p>
                </div>

                <div class="wphub-grid">
                    <div class="wphub-stat">
                        <div class="wphub-stat-value"><?php echo count($all_plugins); ?></div>
                        <div class="wphub-stat-label">Plugins geïnstalleerd</div>
                    </div>
                    <div class="wphub-stat">
                        <div class="wphub-stat-value"><?php echo count($active_plugins); ?></div>
                        <div class="wphub-stat-label">Plugins actief</div>
                    </div>
                    <div class="wphub-stat">
                        <div class="wphub-stat-value"><?php echo count($all_themes); ?></div>
                        <div class="wphub-stat-label">Themes geïnstalleerd</div>
                    </div>
                    <div class="wphub-stat">
                        <div class="wphub-stat-value">1</div>
                        <div class="wphub-stat-label">Theme actief</div>
                    </div>
                </div>
            </div>

            <div class="wphub-card">
                <h2><span class="dashicons dashicons-admin-appearance"></span> Actief Theme</h2>
                <p style="margin-bottom: 16px;">
                    <strong><?php echo esc_html($active_theme->get('Name')); ?></strong> 
                    <span style="color: #64748b;">v<?php echo esc_html($active_theme->get('Version')); ?></span>
                </p>
                <?php if ($active_theme->get_screenshot()) : ?>
                    <img src="<?php echo esc_url($active_theme->get_screenshot()); ?>" 
                         alt="<?php echo esc_attr($active_theme->get('Name')); ?>" 
                         style="max-width: 300px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <?php endif; ?>
            </div>

            <div class="wphub-card" style="text-align: center;">
                <h2 style="justify-content: center;"><span class="dashicons dashicons-external"></span> Ga naar Dashboard</h2>
                <p style="color: #64748b; margin-bottom: 20px;">Beheer al je sites, plugins en themes vanuit één centraal dashboard.</p>
                <a href="<?php echo esc_url($this->hub_url); ?>" target="_blank" class="wphub-btn">
                    <span class="dashicons dashicons-dashboard"></span> Open Plugin Hub Dashboard
                </a>
            </div>

            <div class="wphub-footer">
                <p>WP Plugin Hub Connector v2.1.0 | API Key: <?php echo esc_html(substr($this->api_key, 0, 8) . '...'); ?></p>
            </div>
        </div>
        <?php
    }

    public function register_routes() {
        $namespace = 'wphub/v1';

        // Test connection endpoint
        register_rest_route($namespace, '/testConnection', array(
            'methods' => 'POST',
            'callback' => array($this, 'test_connection'),
            'permission_callback' => array($this, 'verify_api_key')
        ));

        // List all plugins
        register_rest_route($namespace, '/listPlugins', array(
            'methods' => 'POST',
            'callback' => array($this, 'list_plugins'),
            'permission_callback' => array($this, 'verify_api_key')
        ));

        // Get installed plugins with details
        register_rest_route($namespace, '/getInstalledPlugins', array(
            'methods' => 'POST',
            'callback' => array($this, 'get_installed_plugins'),
            'permission_callback' => array($this, 'verify_api_key')
        ));

        // Install plugin
        register_rest_route($namespace, '/installPlugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'install_plugin'),
            'permission_callback' => array($this, 'verify_api_key')
        ));

        // Toggle plugin activation state
        register_rest_route($namespace, '/togglePlugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'toggle_plugin'),
            'permission_callback' => array($this, 'verify_api_key')
        ));

        // Uninstall plugin
        register_rest_route($namespace, '/uninstallPlugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'uninstall_plugin'),
            'permission_callback' => array($this, 'verify_api_key')
        ));

        // Download plugin from WordPress site
        register_rest_route($namespace, '/downloadPlugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'download_plugin'),
            'permission_callback' => array($this, 'verify_api_key')
        ));

        // Update self endpoint
        register_rest_route($namespace, '/updateSelf', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_self'),
            'permission_callback' => array($this, 'verify_api_key')
        ));

        // ========== THEME ENDPOINTS ==========

        // List all themes
        register_rest_route($namespace, '/listThemes', array(
            'methods' => 'POST',
            'callback' => array($this, 'list_themes'),
            'permission_callback' => array($this, 'verify_api_key')
        ));

        // Get installed themes with details
        register_rest_route($namespace, '/getInstalledThemes', array(
            'methods' => 'POST',
            'callback' => array($this, 'get_installed_themes'),
            'permission_callback' => array($this, 'verify_api_key')
        ));

        // Install theme
        register_rest_route($namespace, '/installTheme', array(
            'methods' => 'POST',
            'callback' => array($this, 'install_theme'),
            'permission_callback' => array($this, 'verify_api_key')
        ));

        // Activate theme
        register_rest_route($namespace, '/activateTheme', array(
            'methods' => 'POST',
            'callback' => array($this, 'activate_theme'),
            'permission_callback' => array($this, 'verify_api_key')
        ));

        // Uninstall theme
        register_rest_route($namespace, '/uninstallTheme', array(
            'methods' => 'POST',
            'callback' => array($this, 'uninstall_theme'),
            'permission_callback' => array($this, 'verify_api_key')
        ));

        // Download theme from WordPress site
        register_rest_route($namespace, '/downloadTheme', array(
            'methods' => 'POST',
            'callback' => array($this, 'download_theme'),
            'permission_callback' => array($this, 'verify_api_key')
        ));
    }

    public function verify_api_key($request) {
        $params = $request->get_json_params();
        $provided_key = isset($params['api_key']) ? $params['api_key'] : '';
        
        if ($provided_key !== $this->api_key) {
            return new WP_Error('invalid_api_key', 'Invalid API key', array('status' => 401));
        }
        
        return true;
    }

    public function test_connection($request) {
        global $wp_version;
        
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        
        $all_plugins = get_plugins();
        $all_themes = wp_get_themes();
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Verbinding succesvol',
            'wp_version' => $wp_version,
            'plugins_count' => count($all_plugins),
            'themes_count' => count($all_themes),
            'active_theme' => get_stylesheet(),
            'site_url' => get_site_url(),
            'timestamp' => current_time('mysql')
        ));
    }

    public function list_plugins($request) {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $all_plugins = get_plugins();
        $active_plugins = get_option('active_plugins', array());
        
        $plugins_list = array();
        
        foreach ($all_plugins as $plugin_file => $plugin_data) {
            $slug = dirname($plugin_file);
            if ($slug === '.') {
                $slug = basename($plugin_file, '.php');
            }
            
            $is_active = in_array($plugin_file, $active_plugins);
            
            $plugins_list[] = array(
                'name' => $plugin_data['Name'],
                'slug' => $slug,
                'version' => $plugin_data['Version'],
                'status' => $is_active ? 'active' : 'inactive',
                'plugin_file' => $plugin_file,
                'update' => 'none',
                'update_version' => null
            );
        }

        return rest_ensure_response(array(
            'success' => true,
            'plugins' => $plugins_list,
            'total' => count($plugins_list)
        ));
    }

    public function get_installed_plugins($request) {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $all_plugins = get_plugins();
        $active_plugins = get_option('active_plugins', array());
        
        $plugins_list = array();
        
        foreach ($all_plugins as $plugin_file => $plugin_data) {
            $slug = dirname($plugin_file);
            if ($slug === '.') {
                $slug = basename($plugin_file, '.php');
            }
            
            $is_active = in_array($plugin_file, $active_plugins);
            
            $plugins_list[] = array(
                'name' => $plugin_data['Name'],
                'slug' => $slug,
                'version' => $plugin_data['Version'],
                'description' => $plugin_data['Description'],
                'author' => strip_tags($plugin_data['Author']),
                'is_active' => $is_active
            );
        }

        return rest_ensure_response(array(
            'success' => true,
            'plugins' => $plugins_list,
            'total' => count($plugins_list)
        ));
    }

    public function install_plugin($request) {
        $params = $request->get_json_params();
        $file_url = isset($params['file_url']) ? $params['file_url'] : '';
        $plugin_slug = isset($params['plugin_slug']) ? $params['plugin_slug'] : '';

        if (empty($file_url)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'File URL is required'
            ));
        }

        if (!function_exists('download_url')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        if (!class_exists('Plugin_Upgrader')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        }
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        // Download the plugin ZIP file
        $temp_file = download_url($file_url);
        
        if (is_wp_error($temp_file)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Failed to download plugin: ' . $temp_file->get_error_message()
            ));
        }

        // Install the plugin
        $upgrader = new Plugin_Upgrader(new WP_Ajax_Upgrader_Skin());
        $result = $upgrader->install($temp_file);

        // Clean up temp file
        @unlink($temp_file);

        if (is_wp_error($result)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Installation failed: ' . $result->get_error_message()
            ));
        }

        if ($result === true) {
            return rest_ensure_response(array(
                'success' => true,
                'message' => 'Plugin installed successfully',
                'slug' => $plugin_slug
            ));
        }

        return rest_ensure_response(array(
            'success' => false,
            'message' => 'Installation failed'
        ));
    }

    public function toggle_plugin($request) {
        $params = $request->get_json_params();
        $plugin_slug = isset($params['plugin_slug']) ? $params['plugin_slug'] : '';

        if (empty($plugin_slug)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Plugin slug is required'
            ));
        }

        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if (!function_exists('activate_plugin')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if (!function_exists('deactivate_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        // Find the plugin file
        $all_plugins = get_plugins();
        $plugin_file = null;

        foreach ($all_plugins as $file => $plugin_data) {
            $slug = dirname($file);
            if ($slug === '.') {
                $slug = basename($file, '.php');
            }
            
            if ($slug === $plugin_slug) {
                $plugin_file = $file;
                break;
            }
        }

        if (!$plugin_file) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Plugin not found'
            ));
        }

        // Check current status
        $active_plugins = get_option('active_plugins', array());
        $is_active = in_array($plugin_file, $active_plugins);

        // Toggle the state
        if ($is_active) {
            // Deactivate
            deactivate_plugins($plugin_file);
            $new_status = 'inactive';
            $message = 'Plugin deactivated successfully';
        } else {
            // Activate
            $result = activate_plugin($plugin_file);
            
            if (is_wp_error($result)) {
                return rest_ensure_response(array(
                    'success' => false,
                    'message' => 'Activation failed: ' . $result->get_error_message()
                ));
            }
            
            $new_status = 'active';
            $message = 'Plugin activated successfully';
        }

        return rest_ensure_response(array(
            'success' => true,
            'message' => $message,
            'new_status' => $new_status
        ));
    }

    public function uninstall_plugin($request) {
        $params = $request->get_json_params();
        $plugin_slug = isset($params['plugin_slug']) ? $params['plugin_slug'] : '';

        if (empty($plugin_slug)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Plugin slug is required'
            ));
        }

        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if (!function_exists('delete_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        // Find the plugin file
        $all_plugins = get_plugins();
        $plugin_file = null;

        foreach ($all_plugins as $file => $plugin_data) {
            $slug = dirname($file);
            if ($slug === '.') {
                $slug = basename($file, '.php');
            }
            
            if ($slug === $plugin_slug) {
                $plugin_file = $file;
                break;
            }
        }

        if (!$plugin_file) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Plugin not found'
            ));
        }

        // First deactivate if active
        deactivate_plugins($plugin_file);

        // Then delete
        $result = delete_plugins(array($plugin_file));

        if (is_wp_error($result)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Uninstall failed: ' . $result->get_error_message()
            ));
        }

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Plugin uninstalled successfully'
        ));
    }

    public function download_plugin($request) {
        $params = $request->get_json_params();
        $plugin_slug = isset($params['plugin_slug']) ? $params['plugin_slug'] : '';

        if (empty($plugin_slug)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Plugin slug is required'
            ));
        }

        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        // Find the plugin
        $all_plugins = get_plugins();
        $plugin_file = null;
        $plugin_data = null;

        foreach ($all_plugins as $file => $data) {
            $slug = dirname($file);
            if ($slug === '.') {
                $slug = basename($file, '.php');
            }
            
            if ($slug === $plugin_slug) {
                $plugin_file = $file;
                $plugin_data = $data;
                break;
            }
        }

        if (!$plugin_file) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Plugin not found'
            ));
        }

        // Get plugin directory path
        $plugin_dir = WP_PLUGIN_DIR . '/' . dirname($plugin_file);
        
        if (!file_exists($plugin_dir)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Plugin directory not found'
            ));
        }

        // Create ZIP file
        if (!class_exists('ZipArchive')) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'ZipArchive extension not available'
            ));
        }

        $zip = new ZipArchive();
        $zip_file = sys_get_temp_dir() . '/' . $plugin_slug . '.zip';

        if ($zip->open($zip_file, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Failed to create ZIP file'
            ));
        }

        // Add all plugin files to ZIP
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($plugin_dir),
            RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($files as $file) {
            if (!$file->isDir()) {
                $file_path = $file->getRealPath();
                $relative_path = $plugin_slug . '/' . substr($file_path, strlen($plugin_dir) + 1);
                $zip->addFile($file_path, $relative_path);
            }
        }

        $zip->close();

        // Read ZIP file as base64
        $zip_content = file_get_contents($zip_file);
        $zip_base64 = base64_encode($zip_content);

        // Clean up temp file
        @unlink($zip_file);

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Plugin downloaded successfully',
            'plugin_data' => array(
                'name' => $plugin_data['Name'],
                'version' => $plugin_data['Version'],
                'description' => $plugin_data['Description'],
                'author' => strip_tags($plugin_data['Author'])
            ),
            'zip_base64' => $zip_base64
        ));
    }

    public function update_self($request) {
        $params = $request->get_json_params();
        $file_url = isset($params['file_url']) ? $params['file_url'] : '';
        $new_version = isset($params['new_version']) ? $params['new_version'] : '';

        if (empty($file_url)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'File URL is required'
            ));
        }

        if (!function_exists('download_url')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        if (!class_exists('Plugin_Upgrader')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        }
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        // Find current connector plugin
        $all_plugins = get_plugins();
        $plugin_file = null;
        
        foreach ($all_plugins as $file => $plugin_data) {
            if (strpos($file, 'wp-plugin-hub-connector') !== false) {
                $plugin_file = $file;
                break;
            }
        }

        if (!$plugin_file) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Connector plugin not found'
            ));
        }

        $was_active = is_plugin_active($plugin_file);

        // Download the new version
        $temp_file = download_url($file_url);
        
        if (is_wp_error($temp_file)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Failed to download new version: ' . $temp_file->get_error_message()
            ));
        }

        // Deactivate current version
        deactivate_plugins($plugin_file);

        // Delete current version
        $deleted = delete_plugins(array($plugin_file));
        
        if (is_wp_error($deleted)) {
            @unlink($temp_file);
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Failed to delete old version: ' . $deleted->get_error_message()
            ));
        }

        // Install new version
        $upgrader = new Plugin_Upgrader(new WP_Ajax_Upgrader_Skin());
        $result = $upgrader->install($temp_file);

        // Clean up temp file
        @unlink($temp_file);

        if (is_wp_error($result)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Failed to install new version: ' . $result->get_error_message()
            ));
        }

        // Find the new plugin file
        $all_plugins = get_plugins();
        $new_plugin_file = null;
        
        foreach ($all_plugins as $file => $plugin_data) {
            if (strpos($file, 'wp-plugin-hub-connector') !== false) {
                $new_plugin_file = $file;
                break;
            }
        }

        // Reactivate if it was active before
        if ($was_active && $new_plugin_file) {
            activate_plugin($new_plugin_file);
        }

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Connector plugin successfully updated to version ' . $new_version,
            'new_version' => $new_version
        ));
    }

    // ========== THEME METHODS ==========

    public function list_themes($request) {
        $all_themes = wp_get_themes();
        $active_theme = get_stylesheet();
        
        $themes_list = array();
        
        foreach ($all_themes as $theme_slug => $theme) {
            $is_active = ($theme_slug === $active_theme);
            
            $themes_list[] = array(
                'name' => $theme->get('Name'),
                'slug' => $theme_slug,
                'version' => $theme->get('Version'),
                'status' => $is_active ? 'active' : 'inactive',
                'author' => $theme->get('Author'),
                'screenshot' => $theme->get_screenshot(),
                'update' => 'none',
                'update_version' => null
            );
        }

        return rest_ensure_response(array(
            'success' => true,
            'themes' => $themes_list,
            'total' => count($themes_list),
            'active_theme' => $active_theme
        ));
    }

    public function get_installed_themes($request) {
        $all_themes = wp_get_themes();
        $active_theme = get_stylesheet();
        
        $themes_list = array();
        
        foreach ($all_themes as $theme_slug => $theme) {
            $is_active = ($theme_slug === $active_theme);
            
            $themes_list[] = array(
                'name' => $theme->get('Name'),
                'slug' => $theme_slug,
                'version' => $theme->get('Version'),
                'description' => $theme->get('Description'),
                'author' => $theme->get('Author'),
                'author_uri' => $theme->get('AuthorURI'),
                'theme_uri' => $theme->get('ThemeURI'),
                'screenshot' => $theme->get_screenshot(),
                'is_active' => $is_active
            );
        }

        return rest_ensure_response(array(
            'success' => true,
            'themes' => $themes_list,
            'total' => count($themes_list),
            'active_theme' => $active_theme
        ));
    }

    public function install_theme($request) {
        $params = $request->get_json_params();
        $file_url = isset($params['file_url']) ? $params['file_url'] : '';
        $theme_slug = isset($params['theme_slug']) ? $params['theme_slug'] : '';

        if (empty($file_url)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'File URL is required'
            ));
        }

        if (!function_exists('download_url')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        if (!class_exists('Theme_Upgrader')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        }

        // Download the theme ZIP file
        $temp_file = download_url($file_url);
        
        if (is_wp_error($temp_file)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Failed to download theme: ' . $temp_file->get_error_message()
            ));
        }

        // Install the theme
        $upgrader = new Theme_Upgrader(new WP_Ajax_Upgrader_Skin());
        $result = $upgrader->install($temp_file);

        // Clean up temp file
        @unlink($temp_file);

        if (is_wp_error($result)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Installation failed: ' . $result->get_error_message()
            ));
        }

        if ($result === true) {
            return rest_ensure_response(array(
                'success' => true,
                'message' => 'Theme installed successfully',
                'slug' => $theme_slug
            ));
        }

        return rest_ensure_response(array(
            'success' => false,
            'message' => 'Installation failed'
        ));
    }

    public function activate_theme($request) {
        $params = $request->get_json_params();
        $theme_slug = isset($params['theme_slug']) ? $params['theme_slug'] : '';

        if (empty($theme_slug)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Theme slug is required'
            ));
        }

        // Check if theme exists
        $theme = wp_get_theme($theme_slug);
        
        if (!$theme->exists()) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Theme not found'
            ));
        }

        // Switch to the theme
        switch_theme($theme_slug);

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Theme activated successfully',
            'active_theme' => get_stylesheet()
        ));
    }

    public function uninstall_theme($request) {
        $params = $request->get_json_params();
        $theme_slug = isset($params['theme_slug']) ? $params['theme_slug'] : '';

        if (empty($theme_slug)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Theme slug is required'
            ));
        }

        // Check if theme exists
        $theme = wp_get_theme($theme_slug);
        
        if (!$theme->exists()) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Theme not found'
            ));
        }

        // Cannot delete active theme
        if ($theme_slug === get_stylesheet()) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Cannot delete the active theme. Please activate another theme first.'
            ));
        }

        // Delete the theme
        if (!function_exists('delete_theme')) {
            require_once ABSPATH . 'wp-admin/includes/theme.php';
        }

        $result = delete_theme($theme_slug);

        if (is_wp_error($result)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Uninstall failed: ' . $result->get_error_message()
            ));
        }

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Theme uninstalled successfully'
        ));
    }

    public function download_theme($request) {
        $params = $request->get_json_params();
        $theme_slug = isset($params['theme_slug']) ? $params['theme_slug'] : '';

        if (empty($theme_slug)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Theme slug is required'
            ));
        }

        // Check if theme exists
        $theme = wp_get_theme($theme_slug);
        
        if (!$theme->exists()) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Theme not found'
            ));
        }

        // Get theme directory path
        $theme_dir = $theme->get_stylesheet_directory();
        
        if (!file_exists($theme_dir)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Theme directory not found'
            ));
        }

        // Create ZIP file
        if (!class_exists('ZipArchive')) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'ZipArchive extension not available'
            ));
        }

        $zip = new ZipArchive();
        $zip_file = sys_get_temp_dir() . '/' . $theme_slug . '.zip';

        if ($zip->open($zip_file, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Failed to create ZIP file'
            ));
        }

        // Add all theme files to ZIP
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($theme_dir),
            RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($files as $file) {
            if (!$file->isDir()) {
                $file_path = $file->getRealPath();
                $relative_path = $theme_slug . '/' . substr($file_path, strlen($theme_dir) + 1);
                $zip->addFile($file_path, $relative_path);
            }
        }

        $zip->close();

        // Read ZIP file as base64
        $zip_content = file_get_contents($zip_file);
        $zip_base64 = base64_encode($zip_content);

        // Clean up temp file
        @unlink($zip_file);

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Theme downloaded successfully',
            'theme_data' => array(
                'name' => $theme->get('Name'),
                'version' => $theme->get('Version'),
                'description' => $theme->get('Description'),
                'author' => $theme->get('Author'),
                'screenshot' => $theme->get_screenshot()
            ),
            'zip_base64' => $zip_base64
        ));
    }
}

// Initialize the connector
new WPPluginHubConnector();
`;
};