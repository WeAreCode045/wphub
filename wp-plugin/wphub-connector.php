<?php
/**
 * Plugin Name: WP Hub Connector
 * Plugin URI: https://wphub.pro
 * Description: Connector plugin for WPHub Pro - Manages plugins and themes from your hub
 * Version: 1.0.21
 * Author: Code045
 * Author URI: https://wphub.pro
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wphub-connector
 * Domain Path: /languages
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
if (!defined('WPHC_VERSION')) {
    $plugin_data = get_file_data(__FILE__, array('Version' => 'Version'));
    define('WPHC_VERSION', $plugin_data['Version'] ?: '1.0.0');
}
define('WPHC_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WPHC_PLUGIN_URL', plugin_dir_url(__FILE__));

// Autoloader
spl_autoload_register(function($class) {
    if (strpos($class, 'WPHub' . chr(92)) !== 0) {
        return;
    }
    $file = WPHC_PLUGIN_DIR . 'includes/' . str_replace(chr(92), '/', substr($class, 6)) . '.php';
    if (file_exists($file)) {
        require_once $file;
    }
});

/**
 * Initialize the connector plugin
 */
function wp_plugin_hub_connector_init() {
    load_plugin_textdomain(
        'wphub-connector',
        false,
        dirname(plugin_basename(__FILE__)) . '/languages'
    );

    // Explicitly load the Connector class
    if (!class_exists('WPHub' . chr(92) . 'Connector')) {
        $connector_file = WPHC_PLUGIN_DIR . 'includes/Connector.php';
        if (file_exists($connector_file)) {
            require_once $connector_file;
        }
    }

    $class_name = 'WPHub' . chr(92) . 'Connector';
    if (class_exists($class_name)) {
        $connector = $class_name::getInstance();
        $connector->init();
        // Ensure admin menu is registered
        add_action('admin_menu', array($connector, 'add_admin_menu'), 5);
    }
}

// Use earlier hook to ensure menu is registered
add_action('plugins_loaded', 'wp_plugin_hub_connector_init', 5);

function wp_plugin_hub_connector_activate() {
    $class_name = 'WPHub' . chr(92) . 'Connector';
    if (class_exists($class_name)) {
        $class_name::getInstance()->activate();
    }
}

function wp_plugin_hub_connector_deactivate() {
    $class_name = 'WPHub' . chr(92) . 'Connector';
    if (class_exists($class_name)) {
        $class_name::getInstance()->deactivate();
    }
}

register_activation_hook(__FILE__, 'wp_plugin_hub_connector_activate');
register_deactivation_hook(__FILE__, 'wp_plugin_hub_connector_deactivate');
