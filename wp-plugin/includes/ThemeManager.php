<?php
namespace WPHub;

class ThemeManager {
    private static $instance = null;

    private function __construct() {}

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function install($theme_slug) {
        include_once ABSPATH . 'wp-admin/includes/theme-install.php';
        include_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

        $upgrader = new \Theme_Upgrader();
        
        // Download and install theme
        $result = $upgrader->install('https://downloads.wordpress.org/theme/' . $theme_slug . '.zip');
        
        return $result;
    }

    public function get_installed() {
        return wp_get_themes();
    }

    public function get_active() {
        return wp_get_theme();
    }

    public function activate($theme_slug) {
        switch_theme($theme_slug);
    }
}
