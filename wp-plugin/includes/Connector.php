<?php
namespace WPPluginHub;

class Connector {
    private static $instance = null;
    private $api_endpoint;

    private function __construct() {
        // Will be set from stored options or platform API
        $hub_url = get_option('wphc_hub_url', '');
        $this->api_endpoint = !empty($hub_url) ? rtrim($hub_url, '/') . '/api' : '';
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function init() {
        // OAuth flow
        add_action('admin_init', array($this, 'handle_oauth_callback'));
        
        // Admin menu is registered in wp_plugin_hub_connector_init()
        add_action('wp_ajax_wphc_oauth_login', array($this, 'oauth_login'));
        add_action('wp_ajax_wphc_disconnect', array($this, 'disconnect'));
        add_action('wp_ajax_wphc_sync_plugins', array($this, 'sync_plugins'));
        add_action('wp_ajax_wphc_sync_themes', array($this, 'sync_themes'));
        add_action('wp_ajax_wphc_install_plugin', array($this, 'install_plugin'));
        add_action('wp_ajax_wphc_install_theme', array($this, 'install_theme'));
        add_action('wp_ajax_wphc_get_status', array($this, 'get_status'));
        add_action('wp_ajax_wphc_get_plugins', array($this, 'get_plugins'));
        add_action('wp_ajax_wphc_get_themes', array($this, 'get_themes'));
        add_action('wp_ajax_wphc_save_settings', array($this, 'save_settings'));
        add_action('wp_ajax_wphc_check_updates', array($this, 'check_updates'));
        add_action('wp_ajax_wphc_update_plugin', array($this, 'update_plugin'));
    }

    public function activate() {
        $this->create_log_table();
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
            array($this, 'render_admin_page'),
            'dashicons-store'
        );
    }

    public function oauth_login() {
        check_ajax_referer('wphc_nonce', 'nonce');
        
        $supabase_url = get_option('wphc_supabase_url', 'https://ossyxxlplvqakowiwbok.supabase.co');
        $supabase_anon_key = get_option('wphc_supabase_anon_key', 'sb_publishable_5iOa2uiY5e9dGvvGupyvwA_WWtCNmQT');
        
        $redirect_uri = admin_url('admin.php?page=wp-plugin-hub&oauth_callback=1');
        
        // Build Supabase OAuth URL directly (no need to call edge function)
        $oauth_url = rtrim($supabase_url, '/') . '/auth/v1/authorize?' .
            'client_id=' . urlencode($supabase_anon_key) .
            '&response_type=code' .
            '&redirect_uri=' . urlencode($redirect_uri) .
            '&scope=user';
        
        // Generate state token for CSRF protection
        $state = bin2hex(random_bytes(16));
        set_transient('wphc_oauth_state', $state, HOUR_IN_SECONDS);
        $oauth_url .= '&state=' . urlencode($state);

        wp_send_json_success(array('oauth_url' => $oauth_url));
    }

    public function handle_oauth_callback_redirect() {
        // This is called when user returns from Supabase OAuth
        if (!isset($_GET['code']) || !isset($_GET['state'])) {
            return;
        }

        $code = sanitize_text_field($_GET['code']);
        $state = sanitize_text_field($_GET['state']);
        $supabase_url = get_option('wphc_supabase_url', 'https://ossyxxlplvqakowiwbok.supabase.co');
        $supabase_anon_key = get_option('wphc_supabase_anon_key', 'sb_publishable_5iOa2uiY5e9dGvvGupyvwA_WWtCNmQT');
        $platform_url = get_option('wphc_platform_url', 'https://wphub.pro');

        // Verify state token
        $stored_state = get_transient('wphc_oauth_state');
        if ($stored_state !== $state) {
            wp_die('OAuth state mismatch - possible CSRF attack');
        }

        // Exchange code for access token via Supabase
        $response = wp_remote_post(
            rtrim($supabase_url, '/') . '/auth/v1/token?grant_type=authorization_code',
            array(
                'body' => array(
                    'code' => $code,
                ),
                'timeout' => 15,
            )
        );

        if (is_wp_error($response)) {
            wp_die('Failed to authenticate with Supabase');
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (!isset($body['access_token']) || !isset($body['user']['id'])) {
            wp_die('Invalid Supabase authentication response');
        }

        $access_token = $body['access_token'];
        $user_id = $body['user']['id'];

        // Call Edge Function to match site and get API key
        $callback_response = wp_remote_post(
            rtrim($platform_url, '/') . '/functions/v1/connectorOAuthCallback',
            array(
                'headers' => array(
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer ' . $supabase_anon_key,
                ),
                'body' => json_encode(array(
                    'access_token' => $access_token,
                    'wordpress_url' => home_url(),
                    'user_id' => $user_id,
                )),
                'timeout' => 15,
            )
        );

        if (is_wp_error($callback_response)) {
            wp_die('Failed to connect with platform: ' . $callback_response->get_error_message());
        }

        $callback_body = json_decode(wp_remote_retrieve_body($callback_response), true);
        
        if (!isset($callback_body['success']) || !$callback_body['success']) {
            $error_msg = isset($callback_body['error']) ? $callback_body['error'] : 'Unknown error';
            wp_die('Connection failed: ' . esc_html($error_msg));
        }

        // Store connection info
        update_option('wphc_platform_url', $platform_url);
        update_option('wphc_site_id', $callback_body['site_id']);
        update_option('wphc_site_name', $callback_body['site_name']);
        update_option('wphc_api_key', $callback_body['api_key']);
        update_option('wphc_access_token', $access_token);
        update_option('wphc_connected', true);

        $this->log('Successfully connected to platform site: ' . $callback_body['site_name']);

        // Redirect back to admin page
        wp_safe_redirect(admin_url('admin.php?page=wp-plugin-hub&connected=1'));
        exit;
    }

    public function handle_oauth_callback() {
        if (!isset($_GET['code']) || $_GET['action'] !== 'wphc_oauth_callback') {
            return;
        }

        if (!isset($_GET['state'])) {
            wp_die('OAuth state missing');
        }

        $stored_state = get_transient('wphc_oauth_state');
        if ($stored_state !== $_GET['state']) {
            wp_die('OAuth state mismatch - possible CSRF attack');
        }

        $code = sanitize_text_field($_GET['code']);
        $hub_url = get_option('wphc_hub_url', '');

        if (empty($hub_url)) {
            wp_die('Hub URL not configured');
        }

        // Exchange code for token
        $response = wp_remote_post(
            rtrim($hub_url, '/') . '/api/oauth/token',
            array(
                'body' => array(
                    'grant_type' => 'authorization_code',
                    'code' => $code,
                    'client_id' => get_option('wphc_client_id', ''),
                    'client_secret' => get_option('wphc_client_secret', ''),
                    'redirect_uri' => admin_url('admin-ajax.php?action=wphc_oauth_callback'),
                ),
                'timeout' => 15,
            )
        );

        if (is_wp_error($response)) {
            wp_die('Failed to exchange OAuth code: ' . $response->get_error_message());
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        if (!isset($body['access_token'])) {
            wp_die('Failed to get access token from OAuth response');
        }

        $access_token = $body['access_token'];
        update_option('wphc_access_token', $access_token);

        // Get user info and sites from platform
        $user_response = wp_remote_get(
            rtrim($hub_url, '/') . '/api/me/sites',
            array(
                'headers' => array(
                    'Authorization' => 'Bearer ' . $access_token,
                ),
                'timeout' => 15,
            )
        );

        if (is_wp_error($user_response)) {
            wp_die('Failed to fetch user sites: ' . $user_response->get_error_message());
        }

        $sites_data = json_decode(wp_remote_retrieve_body($user_response), true);
        $site_url = home_url();

        // Find matching site
        $matching_site = null;
        if (isset($sites_data['sites']) && is_array($sites_data['sites'])) {
            foreach ($sites_data['sites'] as $site) {
                if ($site['url'] === $site_url) {
                    $matching_site = $site;
                    break;
                }
            }
        }

        if (!$matching_site) {
            wp_die('Your WordPress site URL (' . esc_html($site_url) . ') was not found in your platform sites. Please add this site URL to your platform account first.');
        }

        // Store connected site info
        update_option('wphc_site_id', $matching_site['id']);
        update_option('wphc_site_name', $matching_site['name']);
        update_option('wphc_connected', true);

        $this->log('Successfully connected to platform site: ' . $matching_site['name']);

        // Redirect back to admin page
        wp_safe_remote_get(admin_url('admin.php?page=wp-plugin-hub&connected=1'));
        wp_die('Connection successful! Redirecting...', 'Connection Successful');
    }

    public function disconnect() {
        check_ajax_referer('wphc_nonce', 'nonce');
        
        delete_option('wphc_access_token');
        delete_option('wphc_site_id');
        delete_option('wphc_site_name');
        delete_option('wphc_connected');

        $this->log('Disconnected from platform');
        wp_send_json_success('Disconnected successfully');
    }

    public function render_admin_page() {
        $nonce = wp_create_nonce('wphc_nonce');
        $is_connected = get_option('wphc_connected', false);
        $site_name = get_option('wphc_site_name', '');
        $hub_url = get_option('wphc_hub_url', '');
        $access_token = get_option('wphc_access_token', '');
        $client_id = get_option('wphc_client_id', '');
        $client_secret = get_option('wphc_client_secret', '');

        // Show connection message if just connected
        if (isset($_GET['connected'])) {
            echo '<div class="updated notice"><p>✓ Successfully connected to WP Plugin Hub</p></div>';
        }

        echo '<div class="wrap">';
        echo '<h1>WP Plugin Hub Connector</h1>';

        // Connection Status Card
        echo '<div class="card">';
        echo '<h2>Connection Status</h2>';
        
        if ($is_connected && !empty($site_name)) {
            echo '<p><strong>Status:</strong> <span style="color:green;">✓ Connected</span></p>';
            echo '<p><strong>Site:</strong> ' . esc_html($site_name) . '</p>';
            echo '<button class="button button-primary" onclick="wphc_disconnect()">Disconnect</button>';
        } else {
            echo '<p><strong>Status:</strong> <span style="color:red;">✗ Not Connected</span></p>';
            echo '<p>Click the button below to log in with your WP Plugin Hub account. Your WordPress site will be automatically connected.</p>';
            echo '<button class="button button-primary" onclick="wphc_oauth_login()">Login to Hub</button>';
        }
        
        echo '</div>';

        // Update notification card
        echo '<div class="card">';
        echo '<h2>Connector Updates</h2>';
        echo '<p>Current Version: <strong>' . esc_html(WPHC_VERSION) . '</strong></p>';
        echo '<div id="wphc-update-status" style="margin-top:10px;">';
        echo '<p><em>Checking for updates...</em></p>';
        echo '</div>';
        echo '</div>';

        if ($is_connected) {
            echo '<div class="card">';
            echo '<h2>Synchronization</h2>';
            echo '<p>Click below to sync plugins and themes from your hub.</p>';
            echo '<button class="button button-primary" onclick="wphc_sync_plugins()">Sync Plugins</button> ';
            echo '<button class="button button-primary" onclick="wphc_sync_themes()">Sync Themes</button>';
            echo '<div id="wphc-status" style="margin-top:10px;"></div>';
            echo '</div>';

            echo '<div class="card">';
            echo '<h2>Installed Plugins from Hub</h2>';
            echo '<div id="wphc-plugins-list" style="margin-top:10px;">';
            echo '<p><em>Loading...</em></p>';
            echo '</div>';
            echo '</div>';

            echo '<div class="card">';
            echo '<h2>Installed Themes from Hub</h2>';
            echo '<div id="wphc-themes-list" style="margin-top:10px;">';
            echo '<p><em>Loading...</em></p>';
            echo '</div>';
            echo '</div>';
        }

        echo '<style>
            .wrap { max-width: 900px; }
            .card { border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin: 20px 0; background: white; }
            .card h2 { margin-top: 0; }
            button { margin-right: 10px; margin-top: 10px; }
            #wphc-status { padding: 10px; border-radius: 4px; }
            .wphc-success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .wphc-error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .plugin-item, .theme-item { padding: 10px; border: 1px solid #eee; margin: 5px 0; border-radius: 3px; }
        </style>';

        echo '<script>
            var wphc_nonce = "' . esc_js($nonce) . '";
            var wphc_ajax = ajaxurl || "' . admin_url('admin-ajax.php') . '";
            
            function wphc_oauth_login() {
                jQuery.post(wphc_ajax, {
                    action: "wphc_oauth_login",
                    nonce: wphc_nonce
                }).done(function(data) {
                    if (data.success) {
                        window.location.href = data.data.oauth_url;
                    } else {
                        alert("Error: " + data.data);
                    }
                }).fail(function(xhr) {
                    var message = xhr.responseText || "Request failed";
                    alert("Login request failed (" + xhr.status + "): " + message);
                });
            }
            
            function wphc_disconnect() {
                if (confirm("Are you sure you want to disconnect from the hub?")) {
                    jQuery.post(wphc_ajax, {
                        action: "wphc_disconnect",
                        nonce: wphc_nonce
                    }, function(data) {
                        if (data.success) {
                            location.reload();
                        }
                    });
                }
            }
            
            function wphc_check_updates() {
                jQuery.post(wphc_ajax, {
                    action: "wphc_check_updates",
                    nonce: wphc_nonce
                }, function(data) {
                    var html = "";
                    if (data.success) {
                        var update = data.data;
                        if (update.has_update) {
                            html = "<div style=\"border: 1px solid #ffb81c; background: #fff8e5; padding: 10px; border-radius: 4px;\">";
                            html += "<p><strong style=\"color:#ffb81c;\">⚠ Update Available!</strong></p>";
                            html += "<p>Latest version: <strong>" + update.latest_version + "</strong></p>";
                            html += "<button class=\"button button-primary\" onclick=\"wphc_update_plugin(\'" + update.download_url + "\'\">Update Now</button>";
                            html += "</div>";
                        } else {
                            html = "<p style=\"color: green;\">✓ You are running the latest version (" + update.current_version + ")</p>";
                        }
                    } else {
                        html = "<p style=\"color: #666;\">Could not check for updates</p>";
                    }
                    jQuery("#wphc-update-status").html(html);
                });
            }
            
            function wphc_update_plugin(downloadUrl) {
                if (!confirm("This will download and install the latest version. Continue?")) {
                    return;
                }
                jQuery("#wphc-update-status").html("<p>Downloading and installing update...</p>");
                jQuery.post(wphc_ajax, {
                    action: "wphc_update_plugin",
                    nonce: wphc_nonce,
                    download_url: downloadUrl
                }, function(data) {
                    if (data.success) {
                        jQuery("#wphc-update-status").html("<p style=\"color: green;\">✓ " + data.data.message + "</p>");
                        setTimeout(function() {
                            location.reload();
                        }, 2000);
                    } else {
                        jQuery("#wphc-update-status").html("<p style=\"color: red;\">✗ Update failed: " + data.data + "</p>");
                    }
                }).fail(function(xhr) {
                    jQuery("#wphc-update-status").html("<p style=\"color: red;\">✗ Update failed: Network error</p>");
                });
            }
            
            function wphc_sync_plugins() {
                jQuery("#wphc-status").html("<p>Syncing plugins...</p>");
                jQuery.post(wphc_ajax, {
                    action: "wphc_sync_plugins",
                    nonce: wphc_nonce
                }, function(data) {
                    jQuery("#wphc-status").html(data);
                    wphc_load_plugins();
                });
            }
            
            function wphc_sync_themes() {
                jQuery("#wphc-status").html("<p>Syncing themes...</p>");
                jQuery.post(wphc_ajax, {
                    action: "wphc_sync_themes",
                    nonce: wphc_nonce
                }, function(data) {
                    jQuery("#wphc-status").html(data);
                    wphc_load_themes();
                });
            }
            
            jQuery(function() {
                if (jQuery("body").hasClass("wp-admin")) {
                    wphc_load_plugins();
                    wphc_load_themes();
                    wphc_check_updates();
                }
            });
            
            function wphc_load_plugins() {
                jQuery.post(wphc_ajax, {
                    action: "wphc_get_plugins",
                    nonce: wphc_nonce
                }, function(data) {
                    jQuery("#wphc-plugins-list").html(data);
                });
            }
            
            function wphc_load_themes() {
                jQuery.post(wphc_ajax, {
                    action: "wphc_get_themes",
                    nonce: wphc_nonce
                }, function(data) {
                    jQuery("#wphc-themes-list").html(data);
                });
            }
        </script>';

        echo '</div>';
    }

    public function sync_plugins() {
        check_ajax_referer('wphc_nonce', 'nonce');
        $access_token = get_option('wphc_access_token', '');
        $hub_url = get_option('wphc_hub_url', '');

        if (empty($access_token) || empty($hub_url)) {
            wp_send_json_error('Not connected to hub');
        }

        $response = wp_remote_get(
            rtrim($hub_url, '/') . '/api/connectors/plugins',
            array(
                'headers' => array(
                    'Authorization' => 'Bearer ' . $access_token,
                    'Content-Type' => 'application/json',
                ),
            )
        );

        if (is_wp_error($response)) {
            wp_send_json_error('Failed to connect to hub: ' . $response->get_error_message());
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        $this->log('Synced ' . count($body['plugins'] ?? []) . ' plugins');
        wp_send_json_success('Plugins synced: ' . count($body['plugins'] ?? []));
    }

    public function sync_themes() {
        check_ajax_referer('wphc_nonce', 'nonce');
        $access_token = get_option('wphc_access_token', '');
        $hub_url = get_option('wphc_hub_url', '');

        if (empty($access_token) || empty($hub_url)) {
            wp_send_json_error('Not connected to hub');
        }

        $response = wp_remote_get(
            rtrim($hub_url, '/') . '/api/connectors/themes',
            array(
                'headers' => array(
                    'Authorization' => 'Bearer ' . $access_token,
                    'Content-Type' => 'application/json',
                ),
            )
        );

        if (is_wp_error($response)) {
            wp_send_json_error('Failed to connect to hub: ' . $response->get_error_message());
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        $this->log('Synced ' . count($body['themes'] ?? []) . ' themes');
        wp_send_json_success('Themes synced: ' . count($body['themes'] ?? []));
    }

    public function install_plugin() {
        check_ajax_referer('wphc_nonce', 'nonce');
        $plugin_id = sanitize_text_field($_POST['plugin_id'] ?? '');
        if (!empty($plugin_id)) {
            PluginManager::getInstance()->install($plugin_id);
        }
    }

    public function install_theme() {
        check_ajax_referer('wphc_nonce', 'nonce');
        $theme_id = sanitize_text_field($_POST['theme_id'] ?? '');
        if (!empty($theme_id)) {
            ThemeManager::getInstance()->install($theme_id);
        }
    }

    public function get_status() {
        wp_send_json_success(array(
            'version' => WPHC_VERSION,
            'connected' => get_option('wphc_connected', false),
            'site_name' => get_option('wphc_site_name', ''),
        ));
    }

    public function get_plugins() {
        check_ajax_referer('wphc_nonce', 'nonce');

        $plugins = PluginManager::getInstance()->get_installed();
        $active = PluginManager::getInstance()->get_active();

        if (empty($plugins)) {
            echo '<p><em>No plugins installed</em></p>';
            wp_die();
        }

        foreach ($plugins as $plugin_file => $plugin_data) {
            $is_active = in_array($plugin_file, $active);
            echo '<div class="plugin-item">';
            echo '<strong>' . esc_html($plugin_data['Name']) . '</strong> ';
            echo 'v' . esc_html($plugin_data['Version']);
            echo ' ' . ($is_active ? '<span style="color:green;">[Active]</span>' : '');
            echo '</div>';
        }
        wp_die();
    }

    public function get_themes() {
        check_ajax_referer('wphc_nonce', 'nonce');

        $themes = ThemeManager::getInstance()->get_installed();
        $active = ThemeManager::getInstance()->get_active();

        if (empty($themes)) {
            echo '<p><em>No themes installed</em></p>';
            wp_die();
        }

        foreach ($themes as $theme) {
            $is_active = $theme->get_stylesheet() === $active->get_stylesheet();
            echo '<div class="theme-item">';
            echo '<strong>' . esc_html($theme->get('Name')) . '</strong> ';
            echo 'v' . esc_html($theme->get('Version'));
            echo ' ' . ($is_active ? '<span style="color:green;">[Active]</span>' : '');
            echo '</div>';
        }
        wp_die();
    }

    private function create_log_table() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();
        $sql = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}wphc_logs (
            id mediumint(9) NOT NULL auto_increment,
            time datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            message text NOT NULL,
            type varchar(20) NOT NULL,
            PRIMARY KEY  (id)
        ) $charset_collate;";
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }

    public function check_updates() {
        check_ajax_referer('wphc_nonce', 'nonce');
        
        $platform_url = get_option('wphc_platform_url', 'https://wphub.pro');
        
        // Fetch available versions from platform
        $response = wp_remote_get(
            rtrim($platform_url, '/') . '/functions/v1/getConnectorVersions',
            array('timeout' => 15)
        );

        if (is_wp_error($response)) {
            wp_send_json_error('Failed to check for updates');
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (!isset($body['success']) || !$body['success'] || empty($body['versions'])) {
            wp_send_json_error('No versions available');
        }

        $current_version = WPHC_VERSION;
        $available_versions = $body['versions'];
        
        // Get the latest version
        usort($available_versions, function($a, $b) {
            return version_compare($b['version'], $a['version']);
        });
        
        $latest_version = $available_versions[0];
        $has_update = version_compare($latest_version['version'], $current_version, '>');

        wp_send_json_success(array(
            'current_version' => $current_version,
            'latest_version' => $latest_version['version'],
            'has_update' => $has_update,
            'download_url' => $latest_version['url'] ?? '',
            'latest_data' => $latest_version,
        ));
    }

    public function update_plugin() {
        check_ajax_referer('wphc_nonce', 'nonce');
        
        if (!isset($_POST['download_url']) || empty($_POST['download_url'])) {
            wp_send_json_error('Download URL is required');
        }

        $download_url = esc_url($_POST['download_url']);

        // Include WordPress upgrade library
        require_once ABSPATH . 'wp-admin/includes/plugin.php';

        // Create a temporary file to download the plugin
        $temp_file = download_url($download_url, 300);

        if (is_wp_error($temp_file)) {
            wp_send_json_error('Failed to download update: ' . $temp_file->get_error_message());
        }

        // Unzip the plugin
        $unzip_result = unzip_file($temp_file, ABSPATH . 'wp-content/plugins');

        if (is_wp_error($unzip_result)) {
            @unlink($temp_file);
            wp_send_json_error('Failed to extract update: ' . $unzip_result->get_error_message());
        }

        @unlink($temp_file);

        // Deactivate the old plugin
        $plugin_file = plugin_basename(WPHC_PLUGIN_DIR . 'wphub-connector.php');
        deactivate_plugins($plugin_file);

        // Activate the new version
        activate_plugin($plugin_file);

        $this->log('Plugin updated successfully');

        wp_send_json_success(array(
            'message' => 'Plugin updated successfully. Page will reload.',
        ));
    }

    private function log($message, $type = 'info') {
        global $wpdb;
        $wpdb->insert(
            $wpdb->prefix . 'wphc_logs',
            array(
                'message' => $message,
                'type' => $type,
            ),
            array('%s', '%s')
        );
    }
}
