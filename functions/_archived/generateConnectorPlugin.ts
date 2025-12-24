import { createClientFromRequest } from './base44Shim.js';
import JSZip from 'npm:jszip@3.10.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        const { api_key, version, description, custom_code } = await req.json();

        console.log('[generateConnectorPlugin] === START ===');
        console.log('[generateConnectorPlugin] Version:', version);
        console.log('[generateConnectorPlugin] Using custom code:', !!custom_code);

        if (!version) {
            return Response.json({ error: 'Version is required' }, { status: 400 });
        }

        // Use custom code if provided, otherwise generate from template
        let pluginCode;
        if (custom_code) {
            // Replace placeholders in custom code
            pluginCode = custom_code
                .replace(/\{\{API_KEY\}\}/g, api_key || '{{API_KEY}}')
                .replace(/\{\{VERSION\}\}/g, version);
        } else {
            // Generate from template - hub_url is now fixed
            if (!api_key) {
                return Response.json({ error: 'API key is required for template generation' }, { status: 400 });
            }
            pluginCode = generateConnectorPluginCode(api_key, version);
        }

        console.log('[generateConnectorPlugin] Plugin code generated, length:', pluginCode.length);

        // Create ZIP file with JSZip
        const zip = new JSZip();
        zip.file('wp-plugin-hub-connector/wp-plugin-hub-connector.php', pluginCode);

        // Generate ZIP as blob
        const zipBlob = await zip.generateAsync({ 
            type: 'uint8array',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });

        console.log('[generateConnectorPlugin] ZIP created, size:', zipBlob.length);

        // Upload to Base44 storage
        const file = new File([zipBlob], `wp-plugin-hub-connector-v${version}.zip`, {
            type: 'application/zip'
        });

        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        console.log('[generateConnectorPlugin] Uploaded to storage:', file_url);

        // Create Connector entity record
        const connector = await base44.asServiceRole.entities.Connector.create({
            version: version,
            plugin_code: pluginCode,
            file_url: file_url,
            description: description || `Connector plugin versie ${version}`
        });

        console.log('[generateConnectorPlugin] Connector entity created:', connector.id);

        // Set as active connector version in settings
        const settings = await base44.asServiceRole.entities.SiteSettings.list();
        const activeVersionSetting = settings.find(s => s.setting_key === 'active_connector_version');

        if (activeVersionSetting) {
            await base44.asServiceRole.entities.SiteSettings.update(activeVersionSetting.id, {
                setting_value: version
            });
        } else {
            await base44.asServiceRole.entities.SiteSettings.create({
                setting_key: 'active_connector_version',
                setting_value: version,
                description: 'Huidige actieve connector plugin versie'
            });
        }

        console.log('[generateConnectorPlugin] Active version updated to:', version);

        // Log activity
        await base44.asServiceRole.entities.ActivityLog.create({
            user_email: user.email,
            action: `Connector plugin gegenereerd${custom_code ? ' (custom code)' : ''}`,
            entity_type: 'connector',
            details: `Versie ${version} - ${file_url}`
        });

        console.log('[generateConnectorPlugin] === END ===');

        return Response.json({
            success: true,
            message: `Connector plugin versie ${version} succesvol gegenereerd`,
            file_url: file_url,
            version: version,
            connector_id: connector.id
        });

    } catch (error) {
        console.error('[generateConnectorPlugin] ❌ ERROR:', error.message);
        console.error('[generateConnectorPlugin] Stack:', error.stack);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});

function generateConnectorPluginCode(apiKey, version) {
    return `<?php
/**
 * Plugin Name: WP Plugin Hub Connector
 * Description: Verbindt deze WordPress site met WP Plugin Hub voor centraal plugin en theme beheer
 * Version: ${version}
 * Author: Code045
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPPluginHubConnector {
    private $api_key = '';
    private $hub_url = 'https://wphub.pro';
    private $option_name = 'wphub_connector_settings';

    public function __construct() {
        // Load settings
        $settings = get_option($this->option_name, array());
        $this->api_key = isset($settings['api_key']) ? $settings['api_key'] : '';
        
        // Register hooks
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('rest_api_init', array($this, 'register_routes'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
    }

    public function add_admin_menu() {
        add_menu_page(
            'WP Plugin Hub',           // Page title
            'Plugin Hub',              // Menu title  
            'manage_options',          // Capability
            'wphub-connector',         // Menu slug
            array($this, 'settings_page'), // Callback
            'dashicons-cloud',         // Icon
            65                         // Position (na Plugins menu)
        );
    }

    public function register_settings() {
        register_setting($this->option_name, $this->option_name);
    }

    public function enqueue_admin_scripts($hook) {
        if ($hook !== 'toplevel_page_wphub-connector') {
            return;
        }
        
        wp_enqueue_style('wphub-connector-admin', false);
        wp_add_inline_style('wphub-connector-admin', '
            .wphub-container {
                max-width: 800px;
                margin: 20px 0;
            }
            .wphub-card {
                background: #fff;
                border: 1px solid #ccd0d4;
                border-radius: 4px;
                padding: 20px;
                margin-bottom: 20px;
            }
            .wphub-card h3 {
                margin-top: 0;
                border-bottom: 1px solid #eee;
                padding-bottom: 10px;
            }
            .wphub-status {
                padding: 10px;
                border-radius: 4px;
                margin: 10px 0;
            }
            .wphub-status.success {
                background: #d4edda;
                border: 1px solid #c3e6cb;
                color: #155724;
            }
            .wphub-status.error {
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                color: #721c24;
            }
            .wphub-status.inactive {
                background: #fff3cd;
                border: 1px solid #ffeeba;
                color: #856404;
            }
            .wphub-status.configured {
                background: #cfe2ff;
                border: 1px solid #b6d4fe;
                color: #084298;
            }
            .wphub-field {
                margin-bottom: 15px;
            }
            .wphub-field label {
                display: block;
                font-weight: 600;
                margin-bottom: 5px;
            }
            .wphub-field input[type="text"],
            .wphub-field input[type="password"] {
                width: 100%;
                max-width: 500px;
            }
            .wphub-info {
                background: #e7f3ff;
                border-left: 4px solid #2271b1;
                padding: 12px;
                margin: 15px 0;
            }
            .wphub-button-group {
                margin-top: 20px;
            }
            .wphub-test-result {
                margin-top: 15px;
                padding: 10px;
                border-radius: 4px;
                display: none;
            }
        ');
    }

    public function settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        // Handle form submission
        if (isset($_POST['wphub_save_settings']) && check_admin_referer('wphub_settings')) {
            $settings = array(
                'api_key' => sanitize_text_field($_POST['wphub_api_key'])
            );
            update_option($this->option_name, $settings);
            $this->api_key = $settings['api_key'];
            echo '<div class="notice notice-success"><p>Instellingen opgeslagen!</p></div>';
        }

        $settings = get_option($this->option_name, array());
        $api_key = isset($settings['api_key']) ? $settings['api_key'] : '';
        
        // Get site stats
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        $all_plugins = get_plugins();
        $all_themes = wp_get_themes();
        $active_plugins = get_option('active_plugins', array());
        $active_theme = wp_get_theme();
        
        // Check connection status
        $connection_status = 'inactive';
        $connection_message = 'Nog niet geconfigureerd - vul je API key in';
        
        if (!empty($api_key)) {
            $connection_status = 'configured';
            $connection_message = 'Configuratie compleet - klik op "Test Verbinding" om te testen';
        }

        ?>
        <div class="wrap wphub-container">
            <h1 style="display: flex; align-items: center; gap: 10px;">
                <span class="dashicons dashicons-cloud" style="font-size: 32px; color: #6366f1;"></span>
                WP Plugin Hub Connector
            </h1>
            <p style="color: #64748b;">Beheer je plugins en themes centraal via het WP Plugin Hub dashboard.</p>

            <div class="wphub-card">
                <h3>📊 Verbinding Status</h3>
                <div class="wphub-status <?php echo esc_attr($connection_status); ?>">
                    <strong><?php echo esc_html($connection_message); ?></strong>
                </div>
                
                <?php if (!empty($api_key)): ?>
                <div class="wphub-button-group">
                    <button type="button" id="wphub-test-connection" class="button button-secondary">
                        🔍 Test Verbinding
                    </button>
                    <a href="<?php echo esc_url($this->hub_url); ?>" target="_blank" class="button button-primary" style="margin-left: 10px;">
                        🚀 Open Dashboard
                    </a>
                </div>
                <div id="wphub-test-result" class="wphub-test-result"></div>
                <?php endif; ?>
            </div>

            <div class="wphub-card">
                <h3>📈 Site Overzicht</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-top: 16px;">
                    <div style="background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; color: #6366f1;"><?php echo count($all_plugins); ?></div>
                        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Plugins</div>
                    </div>
                    <div style="background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; color: #10b981;"><?php echo count($active_plugins); ?></div>
                        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Actief</div>
                    </div>
                    <div style="background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; color: #8b5cf6;"><?php echo count($all_themes); ?></div>
                        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Themes</div>
                    </div>
                </div>
                
                <div style="margin-top: 20px; padding: 16px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
                    <strong style="color: #166534;">Actief Theme:</strong> 
                    <span style="color: #15803d;"><?php echo esc_html($active_theme->get('Name')); ?> v<?php echo esc_html($active_theme->get('Version')); ?></span>
                </div>
            </div>

            <div class="wphub-card">
                <h3>⚙️ Instellingen</h3>
                
                <div class="wphub-info">
                    <p><strong>ℹ️ Hoe te gebruiken:</strong></p>
                    <ol>
                        <li>Voeg deze site toe in het <a href="<?php echo esc_url($this->hub_url); ?>" target="_blank">WP Plugin Hub dashboard</a></li>
                        <li>Kopieer de API Key</li>
                        <li>Vul deze hieronder in en sla op</li>
                        <li>Test de verbinding</li>
                    </ol>
                </div>

                <form method="post" action="">
                    <?php wp_nonce_field('wphub_settings'); ?>
                    
                    <div class="wphub-field">
                        <label for="wphub_api_key">API Key *</label>
                        <input 
                            type="password" 
                            id="wphub_api_key" 
                            name="wphub_api_key" 
                            value="<?php echo esc_attr($api_key); ?>"
                            class="regular-text"
                            placeholder="Vul je API key in"
                        />
                        <p class="description">De API key die je hebt ontvangen bij het toevoegen van de site</p>
                    </div>

                    <p class="submit">
                        <input 
                            type="submit" 
                            name="wphub_save_settings" 
                            class="button button-primary" 
                            value="💾 Instellingen Opslaan"
                        />
                    </p>
                </form>
            </div>

            <div class="wphub-card">
                <h3>📝 Informatie</h3>
                <table class="widefat">
                    <tr>
                        <td><strong>Plugin Versie</strong></td>
                        <td>${version}</td>
                    </tr>
                    <tr>
                        <td><strong>Dashboard URL</strong></td>
                        <td><a href="<?php echo esc_url($this->hub_url); ?>" target="_blank"><?php echo esc_html($this->hub_url); ?></a></td>
                    </tr>
                    <tr>
                        <td><strong>WordPress Versie</strong></td>
                        <td><?php echo get_bloginfo('version'); ?></td>
                    </tr>
                    <tr>
                        <td><strong>Site URL</strong></td>
                        <td><?php echo get_site_url(); ?></td>
                    </tr>
                    <tr>
                        <td><strong>REST API Endpoint</strong></td>
                        <td><?php echo rest_url('wphub/v1/'); ?></td>
                    </tr>
                </table>
            </div>
        </div>

        <script>
        jQuery(document).ready(function($) {
            $('#wphub-test-connection').on('click', function() {
                var button = $(this);
                var resultDiv = $('#wphub-test-result');
                
                button.prop('disabled', true).text('⏳ Testen...');
                resultDiv.hide();
                
                $.ajax({
                    url: '<?php echo rest_url('wphub/v1/testConnection'); ?>',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        api_key: $('#wphub_api_key').val()
                    }),
                    success: function(response) {
                        if (response.success) {
                            resultDiv.removeClass('error').addClass('success wphub-status')
                                .html('<strong>✅ Verbinding succesvol!</strong><br>' +
                                      'WordPress versie: ' + response.wp_version + '<br>' +
                                      'Plugins: ' + response.plugins_count + '<br>' +
                                      'Themes: ' + response.themes_count)
                                .fadeIn();
                        } else {
                            resultDiv.removeClass('success').addClass('error wphub-status')
                                .html('<strong>❌ Verbinding mislukt</strong><br>' + (response.message || 'Onbekende fout'))
                                .fadeIn();
                        }
                    },
                    error: function(jqXHR) {
                        var errorMsg = 'Controleer je instellingen';
                        if (jqXHR.responseJSON && jqXHR.responseJSON.message) {
                            errorMsg = jqXHR.responseJSON.message;
                        }
                        resultDiv.removeClass('success').addClass('error wphub-status')
                            .html('<strong>❌ Fout bij testen</strong><br>' + errorMsg)
                            .fadeIn();
                    },
                    complete: function() {
                        button.prop('disabled', false).text('🔍 Test Verbinding');
                    }
                });
            });
        });
        </script>
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

        // Update plugin
        register_rest_route($namespace, '/updatePlugin', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_plugin'),
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
    }

    public function verify_api_key($request) {
        $params = $request->get_json_params();
        $provided_key = isset($params['api_key']) ? $params['api_key'] : '';
        
        if (empty($this->api_key)) {
            return new WP_Error('api_key_not_set', 'API Key not configured in WP Plugin Hub settings.', array('status' => 401));
        }
        
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
        if (!class_exists('WP_Ajax_Upgrader_Skin')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-ajax-upgrader-skin.php';
        }

        $temp_file = download_url($file_url);
        
        if (is_wp_error($temp_file)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Failed to download plugin: ' . $temp_file->get_error_message()
            ));
        }

        $upgrader = new Plugin_Upgrader(new WP_Ajax_Upgrader_Skin());
        $result = $upgrader->install($temp_file);

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

    public function update_plugin($request) {
        $params = $request->get_json_params();
        $plugin_slug = isset($params['plugin_slug']) ? $params['plugin_slug'] : '';
        $file_url = isset($params['file_url']) ? $params['file_url'] : '';

        if (empty($plugin_slug)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Plugin slug is required'
            ));
        }

        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if (!class_exists('Plugin_Upgrader')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        }
        if (!function_exists('download_url')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        if (!class_exists('WP_Ajax_Upgrader_Skin')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-ajax-upgrader-skin.php';
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

        $was_active = is_plugin_active($plugin_file);

        // If file_url is provided, download and upgrade from that URL
        if (!empty($file_url)) {
            $temp_file = download_url($file_url);
            
            if (is_wp_error($temp_file)) {
                return rest_ensure_response(array(
                    'success' => false,
                    'message' => 'Failed to download plugin: ' . $temp_file->get_error_message()
                ));
            }

            // Deactivate if active
            if ($was_active) {
                deactivate_plugins($plugin_file);
            }

            // Upgrade the plugin
            $upgrader = new Plugin_Upgrader(new WP_Ajax_Upgrader_Skin());
            $result = $upgrader->install($temp_file, array('overwrite_package' => true));

            @unlink($temp_file);

            if (is_wp_error($result)) {
                // Try to reactivate if it was active
                if ($was_active) {
                    activate_plugin($plugin_file);
                }
                return rest_ensure_response(array(
                    'success' => false,
                    'message' => 'Update failed: ' . $result->get_error_message()
                ));
            }

            // Find the new plugin file (slug might have changed)
            $all_plugins = get_plugins();
            $new_plugin_file = null;
            
            foreach ($all_plugins as $file => $plugin_data) {
                $slug = dirname($file);
                if ($slug === '.') {
                    $slug = basename($file, '.php');
                }
                
                if ($slug === $plugin_slug) {
                    $new_plugin_file = $file;
                    break;
                }
            }

            // Reactivate if it was active before
            if ($was_active && $new_plugin_file) {
                $activate_result = activate_plugin($new_plugin_file);
                if (is_wp_error($activate_result)) {
                    return rest_ensure_response(array(
                        'success' => true,
                        'message' => 'Plugin updated but failed to reactivate: ' . $activate_result->get_error_message(),
                        'slug' => $plugin_slug
                    ));
                }
            }

            // Get new version
            $all_plugins = get_plugins();
            $new_version = 'unknown';
            if ($new_plugin_file && isset($all_plugins[$new_plugin_file])) {
                $new_version = $all_plugins[$new_plugin_file]['Version'];
            }

            return rest_ensure_response(array(
                'success' => true,
                'message' => 'Plugin updated successfully',
                'slug' => $plugin_slug,
                'version' => $new_version
            ));
        } else {
            // Use WP-CLI style upgrade (from wordpress.org)
            include_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
            
            $upgrader = new Plugin_Upgrader(new WP_Ajax_Upgrader_Skin());
            $result = $upgrader->upgrade($plugin_file);

            if (is_wp_error($result)) {
                return rest_ensure_response(array(
                    'success' => false,
                    'message' => 'Update failed: ' . $result->get_error_message()
                ));
            }

            if ($result === false) {
                return rest_ensure_response(array(
                    'success' => false,
                    'message' => 'Plugin is already at the latest version'
                ));
            }

            // Get new version
            $all_plugins = get_plugins();
            $new_version = 'unknown';
            if (isset($all_plugins[$plugin_file])) {
                $new_version = $all_plugins[$plugin_file]['Version'];
            }

            return rest_ensure_response(array(
                'success' => true,
                'message' => 'Plugin updated successfully',
                'slug' => $plugin_slug,
                'version' => $new_version
            ));
        }
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

        $active_plugins = get_option('active_plugins', array());
        $is_active = in_array($plugin_file, $active_plugins);

        if ($is_active) {
            deactivate_plugins($plugin_file);
            $new_status = 'inactive';
            $message = 'Plugin deactivated successfully';
        } else {
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

        // Load required WordPress admin files for REST API context
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if (!function_exists('request_filesystem_credentials')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        if (!function_exists('delete_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if (!function_exists('deactivate_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        // Find the plugin file
        $all_plugins = get_plugins();
        $plugin_file = null;
        $plugin_name = '';

        foreach ($all_plugins as $file => $plugin_data) {
            $slug = dirname($file);
            if ($slug === '.') {
                $slug = basename($file, '.php');
            }
            
            if ($slug === $plugin_slug) {
                $plugin_file = $file;
                $plugin_name = $plugin_data['Name'];
                break;
            }
        }

        if (!$plugin_file) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Plugin not found: ' . $plugin_slug
            ));
        }

        // Check if plugin is active
        $active_plugins = get_option('active_plugins', array());
        $was_active = in_array($plugin_file, $active_plugins);

        // Step 1: Deactivate the plugin (silently, no redirects)
        if ($was_active) {
            deactivate_plugins($plugin_file, true);
            
            // Verify deactivation
            $active_plugins_after = get_option('active_plugins', array());
            if (in_array($plugin_file, $active_plugins_after)) {
                return rest_ensure_response(array(
                    'success' => false,
                    'message' => 'Failed to deactivate plugin before uninstall'
                ));
            }
        }

        // Step 2: Try wp plugin uninstall (calls uninstall.php)
        // Since we're in REST API context, we need to set filesystem method to 'direct'
        // to avoid prompting for FTP credentials
        add_filter('filesystem_method', function() { return 'direct'; });
        
        // Initialize WP_Filesystem with direct method
        if (!function_exists('WP_Filesystem')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        
        // Initialize filesystem - this prevents the request_filesystem_credentials error
        WP_Filesystem();
        
        $deleted = delete_plugins(array($plugin_file));
        $used_fallback = false;

        if (is_wp_error($deleted)) {
            // FALLBACK: Use wp plugin delete (force delete without uninstall.php)
            $plugin_dir = WP_PLUGIN_DIR . '/' . dirname($plugin_file);
            
            if (file_exists($plugin_dir)) {
                $delete_result = $this->force_delete_plugin_directory($plugin_dir);
                
                if (!$delete_result) {
                    // Rollback: reactivate if it was active
                    if ($was_active) {
                        activate_plugin($plugin_file);
                    }
                    
                    return rest_ensure_response(array(
                        'success' => false,
                        'message' => 'Both uninstall and delete methods failed: ' . $deleted->get_error_message()
                    ));
                }
                
                $used_fallback = true;
            } else {
                return rest_ensure_response(array(
                    'success' => false,
                    'message' => 'Uninstall failed and plugin directory not found: ' . $deleted->get_error_message()
                ));
            }
        }

        // Step 3: Verify files are really deleted
        clearstatcache();
        $plugin_dir = WP_PLUGIN_DIR . '/' . dirname($plugin_file);
        if (file_exists($plugin_dir)) {
            // Try fallback if not already used
            if (!$used_fallback) {
                $delete_result = $this->force_delete_plugin_directory($plugin_dir);
                if (!$delete_result) {
                    return rest_ensure_response(array(
                        'success' => false,
                        'message' => 'Plugin files still exist after delete operation'
                    ));
                }
                $used_fallback = true;
            } else {
                return rest_ensure_response(array(
                    'success' => false,
                    'message' => 'Plugin files still exist after both delete attempts'
                ));
            }
        }

        $message = 'Plugin "' . $plugin_name . '" successfully ';
        $message .= $used_fallback ? 'deleted (forced removal)' : 'uninstalled and removed';

        return rest_ensure_response(array(
            'success' => true,
            'message' => $message,
            'slug' => $plugin_slug,
            'was_active' => $was_active,
            'method' => $used_fallback ? 'delete' : 'uninstall'
        ));
    }

    private function force_delete_plugin_directory($dir) {
        if (!is_dir($dir)) {
            return false;
        }

        $files = array_diff(scandir($dir), array('.', '..'));
        
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            
            if (is_dir($path)) {
                // Recursive delete
                if (!$this->force_delete_plugin_directory($path)) {
                    return false;
                }
            } else {
                // Delete file
                if (!@unlink($path)) {
                    return false;
                }
            }
        }

        // Delete the directory itself
        return @rmdir($dir);
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

        $plugin_dir = WP_PLUGIN_DIR . '/' . dirname($plugin_file);
        
        if (!file_exists($plugin_dir)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Plugin directory not found'
            ));
        }

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

        $zip_content = file_get_contents($zip_file);
        $zip_base64 = base64_encode($zip_content);

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
        if (!class_exists('WP_Ajax_Upgrader_Skin')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-ajax-upgrader-skin.php';
        }

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

        $temp_file = download_url($file_url);
        
        if (is_wp_error($temp_file)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Failed to download new version: ' . $temp_file->get_error_message()
            ));
        }

        deactivate_plugins($plugin_file);
        $deleted = delete_plugins(array($plugin_file));
        
        if (is_wp_error($deleted)) {
            @unlink($temp_file);
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Failed to delete old version: ' . $deleted->get_error_message()
            ));
        }

        $upgrader = new Plugin_Upgrader(new WP_Ajax_Upgrader_Skin());
        $result = $upgrader->install($temp_file);

        @unlink($temp_file);

        if (is_wp_error($result)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => 'Failed to install new version: ' . $result->get_error_message()
            ));
        }

        $all_plugins = get_plugins();
        $new_plugin_file = null;
        
        foreach ($all_plugins as $file => $plugin_data) {
            if (strpos($file, 'wp-plugin-hub-connector') !== false) {
                $new_plugin_file = $file;
                break;
            }
        }

        if ($was_active && $new_plugin_file) {
            activate_plugin($new_plugin_file);
        }

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Connector plugin successfully updated to version ' . $new_version,
            'new_version' => $new_version
        ));
    }
}

// Initialize the connector
new WPPluginHubConnector();
`;
}