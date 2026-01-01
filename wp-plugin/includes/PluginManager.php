<?php
namespace WPHub;

class PluginManager {
    private static $instance = null;

    private function __construct() {}

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function install($plugin_slug) {
        // Use WordPress plugin installer
        include_once ABSPATH . 'wp-admin/includes/plugin-install.php';
        include_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

        $upgrader = new \Plugin_Upgrader();
        
        // Download and install plugin
        $result = $upgrader->install('https://downloads.wordpress.org/plugin/' . $plugin_slug . '.zip');
        
        return $result;
    }

    public function get_installed() {
        if (!function_exists('get_plugins')) {
            include_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        return get_plugins();
    }

    public function get_active() {
        $active_plugins = get_option('active_plugins', array());
        return $active_plugins;
    }

    public function activate($plugin_file) {
        activate_plugin($plugin_file);
    }

    public function deactivate($plugin_file) {
        deactivate_plugins(array($plugin_file));
    }
}
