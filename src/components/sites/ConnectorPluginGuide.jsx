
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Download,
  Code,
  CheckCircle,
  ExternalLink,
  Copy,
  Check
} from "lucide-react";
import { useState } from "react";

export default function ConnectorPluginGuide({ apiKey }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);

  const pluginCode = `<?php
/**
 * Plugin Name: WP Plugin Hub Connector
 * Plugin URI: https://wphub.pro
 * Description: Verbindt je WordPress site met WP Plugin Hub voor centraal plugin management
 * Version: 1.3.0
 * Author: Code045
 * License: GPL v2 or later
 */

if (!defined('ABSPATH')) exit;

class WPPluginHubConnector {
    private $api_key = '';
    private $api_base_url = 'https://wphub.pro/api/functions';
    
    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        
        // Schedule sync every hour
        if (!wp_next_scheduled('wphub_sync_cron')) {
            wp_schedule_event(time(), 'hourly', 'wphub_sync_cron');
        }
        add_action('wphub_sync_cron', array($this, 'sync_site_data'));
        add_action('wphub_sync_cron', array($this, 'execute_commands'));
    }
    
    public function register_rest_routes() {
        register_rest_route('wphub/v1', '/sync', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_sync_trigger'),
            'permission_callback' => array($this, 'verify_sync_request')
        ));
    }
    
    public function verify_sync_request($request) {
        $body = $request->get_json_params();
        $provided_key = isset($body['api_key']) ? $body['api_key'] : '';
        $stored_key = get_option('wphub_api_key');
        
        return $provided_key === $stored_key && !empty($stored_key);
    }
    
    public function handle_sync_trigger($request) {
        $this->sync_site_data();
        $this->execute_commands();
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Sync completed successfully',
            'timestamp' => current_time('mysql')
        ), 200);
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
                
                // Check if WP-CLI is available
                $wp_cli_check = $this->exec_wp_cli('--version', false);
                if ($wp_cli_check['success']) {
                    echo '<p><span class="dashicons dashicons-yes-alt" style="color: green;"></span> WP-CLI beschikbaar: ' . esc_html(trim($wp_cli_check['output'])) . '</p>';
                } else {
                    echo '<p><span class="dashicons dashicons-warning" style="color: orange;"></span> WP-CLI niet gevonden. Installeer WP-CLI voor automatische plugin management.</p>';
                }
                
                echo '<button type="button" class="button" onclick="wpHubSyncNow()">Nu Synchroniseren</button>';
                
                // Show managed plugins
                $managed = get_option('wphub_managed_plugins', array());
                if (!empty($managed)) {
                    echo '<h3>Beheerde Plugins</h3>';
                    echo '<ul>';
                    foreach ($managed as $plugin_id => $plugin_data) {
                        echo '<li>' . esc_html($plugin_data['plugin_slug']) . '</li>';
                    }
                    echo '</ul>';
                }
            } else {
                echo '<p><span class="dashicons dashicons-warning" style="color: orange;"></span> API Key is niet ingesteld</p>';
            }
            ?>
            
            <script>
            function wpHubSyncNow() {
                jQuery.post(ajaxurl, {
                    action: 'wphub_sync_now'
                }, function(response) {
                    alert(response.data.message || 'Synchronisatie gestart');
                    location.reload();
                });
            }
            </script>
        </div>
        <?php
    }
    
    /**
     * Execute WP-CLI command
     */
    private function exec_wp_cli($command, $log = true) {
        $wp_cli_path = $this->find_wp_cli();
        
        if (!$wp_cli_path) {
            if ($log) {
                error_log('WP Plugin Hub: WP-CLI not found');
            }
            return array('success' => false, 'output' => 'WP-CLI not found');
        }
        
        $full_command = $wp_cli_path . ' ' . $command . ' --path=' . escapeshellarg(ABSPATH) . ' --allow-root 2>&1';
        
        if ($log) {
            error_log('WP Plugin Hub: Executing: ' . $full_command);
        }
        
        exec($full_command, $output, $return_code);
        
        $output_str = implode("\\n", $output);
        
        if ($log) {
            error_log('WP Plugin Hub: Return code: ' . $return_code . ', Output: ' . $output_str);
        }
        
        return array(
            'success' => $return_code === 0,
            'output' => $output_str,
            'return_code' => $return_code
        );
    }
    
    /**
     * Find WP-CLI executable
     */
    private function find_wp_cli() {
        $possible_paths = array(
            '/usr/local/bin/wp',
            '/usr/bin/wp',
            '/bin/wp',
            '/opt/wp-cli/wp',
            'wp' // Try PATH
        );
        
        foreach ($possible_paths as $path) {
            // Check if the command exists and is executable
            // We use 'wp --version' to ensure it's a working WP-CLI installation
            $output = [];
            $return_code = 1; // Assume failure
            @exec(escapeshellarg($path) . ' --version 2>&1', $output, $return_code);
            if ($return_code === 0) {
                return $path;
            }
        }
        
        return false;
    }
    
    public function sync_site_data() {
        $api_key = get_option('wphub_api_key');
        if (!$api_key) return;
        
        global $wp_version;
        
        // Get all installed plugins
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        
        $all_plugins = get_plugins();
        $active_plugins = get_option('active_plugins', array());
        
        $plugins_data = array();
        
        // Only send plugins that are managed by the hub
        $installations = $this->get_managed_plugins();
        
        foreach ($installations as $plugin_id => $install) {
            $plugin_file = $install['plugin_slug'] . '/' . $install['plugin_slug'] . '.php';
            $is_active = in_array($plugin_file, $active_plugins);
            $version = isset($all_plugins[$plugin_file]['Version']) ? $all_plugins[$plugin_file]['Version'] : '';
            
            $plugins_data[] = array(
                'plugin_id' => $plugin_id,
                'is_active' => $is_active,
                'version' => $version
            );
        }
        
        $response = wp_remote_post($this->api_base_url . '/syncSiteData', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array(
                'api_key' => $api_key,
                'wp_version' => $wp_version,
                'site_url' => get_site_url(),
                'plugins' => $plugins_data
            )),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            error_log('WP Plugin Hub sync error: ' . $response->get_error_message());
        }
    }
    
    public function execute_commands() {
        $api_key = get_option('wphub_api_key');
        if (!$api_key) return;
        
        // Get commands from platform
        $response = wp_remote_post($this->api_base_url . '/getPluginCommands', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array(
                'api_key' => $api_key
            )),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            error_log('WP Plugin Hub get commands error: ' . $response->get_error_message());
            return;
        }
        
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        if (!isset($body['commands']) || empty($body['commands'])) {
            return;
        }
        
        // Log what we're about to execute
        error_log('WP Plugin Hub: Executing ' . count($body['commands']) . ' commands');
        
        // Execute each command
        foreach ($body['commands'] as $command) {
            error_log('WP Plugin Hub: Executing command ' . $command['action'] . ' for plugin ' . $command['plugin_name']);
            $this->execute_single_command($command);
        }
    }
    
    private function execute_single_command($command) {
        $api_key = get_option('wphub_api_key');
        $status = 'error';
        $error_message = '';
        
        try {
            switch ($command['action']) {
                case 'install':
                    $result = $this->install_plugin($command);
                    $status = $result['status'];
                    $error_message = $result['message'];
                    break;
                    
                case 'activate':
                    $result = $this->activate_plugin($command);
                    $status = $result['status'];
                    $error_message = $result['message'];
                    break;
                    
                case 'deactivate':
                    $result = $this->deactivate_plugin($command);
                    $status = $result['status'];
                    $error_message = $result['message'];
                    break;
                    
                case 'update':
                    $result = $this->update_plugin($command);
                    $status = $result['status'];
                    $error_message = $result['message'];
                    break;
                    
                case 'uninstall':
                    $result = $this->uninstall_plugin($command);
                    $status = $result['status'];
                    $error_message = $result['message'];
                    break;
            }
        } catch (Exception $e) {
            $status = 'error';
            $error_message = $e->getMessage();
        }
        
        error_log('WP Plugin Hub: Command result - status: ' . $status . ', message: ' . $error_message);
        
        // Report status back
        wp_remote_post($this->api_base_url . '/reportCommandStatus', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array(
                'api_key' => $api_key,
                'installation_id' => $command['installation_id'],
                'status' => $status,
                'error_message' => $error_message,
                'version' => isset($command['version']) ? $command['version'] : null
            )),
            'timeout' => 30
        ));
    }
    
    private function install_plugin($command) {
        // Use WP-CLI to install plugin
        $result = $this->exec_wp_cli('plugin install ' . escapeshellarg($command['file_url']) . ' --force');
        
        if (!$result['success']) {
            return array('status' => 'error', 'message' => 'Installation failed: ' . $result['output']);
        }
        
        // Track this plugin as managed
        $this->add_managed_plugin(array(
            'plugin_id' => $command['plugin_id'],
            'plugin_slug' => $command['plugin_slug']
        ));
        
        return array('status' => 'installed', 'message' => 'Plugin successfully installed via WP-CLI');
    }
    
    private function activate_plugin($command) {
        // Use WP-CLI to activate plugin
        $result = $this->exec_wp_cli('plugin activate ' . escapeshellarg($command['plugin_slug']));
        
        if (!$result['success']) {
            return array('status' => 'error', 'message' => 'Activation failed: ' . $result['output']);
        }
        
        return array('status' => 'active', 'message' => 'Plugin successfully activated via WP-CLI');
    }
    
    private function deactivate_plugin($command) {
        // Use WP-CLI to deactivate plugin
        $result = $this->exec_wp_cli('plugin deactivate ' . escapeshellarg($command['plugin_slug']));
        
        if (!$result['success']) {
            return array('status' => 'error', 'message' => 'Deactivation failed: ' . $result['output']);
        }
        
        return array('status' => 'inactive', 'message' => 'Plugin successfully deactivated via WP-CLI');
    }
    
    private function update_plugin($command) {
        // First uninstall old version, then install new
        // Note: Uninstall might fail if the plugin isn't installed. We log it but continue with install.
        $uninstall_result = $this->uninstall_plugin($command);
        if ($uninstall_result['status'] === 'error') {
            error_log('WP Plugin Hub: Update pre-uninstall failed (may not be installed): ' . $uninstall_result['message']);
        }
        return $this->install_plugin($command);
    }
    
    private function uninstall_plugin($command) {
        // First deactivate (if active). This command won't error if plugin is already inactive.
        $this->exec_wp_cli('plugin deactivate ' . escapeshellarg($command['plugin_slug']));
        
        // Then delete using WP-CLI
        $result = $this->exec_wp_cli('plugin delete ' . escapeshellarg($command['plugin_slug']));
        
        if (!$result['success']) {
            return array('status' => 'error', 'message' => 'Uninstall failed: ' . $result['output']);
        }
        
        // Remove from managed plugins
        $this->remove_managed_plugin($command['plugin_id']);
        
        return array('status' => 'inactive', 'message' => 'Plugin successfully uninstalled via WP-CLI');
    }
    
    private function get_managed_plugins() {
        return get_option('wphub_managed_plugins', array());
    }
    
    private function add_managed_plugin($plugin_data) {
        $managed = $this->get_managed_plugins();
        $managed[$plugin_data['plugin_id']] = $plugin_data;
        update_option('wphub_managed_plugins', $managed);
    }
    
    private function remove_managed_plugin($plugin_id) {
        $managed = $this->get_managed_plugins();
        unset($managed[$plugin_id]);
        update_option('wphub_managed_plugins', $managed);
    }
}

// Initialize plugin
new WPPluginHubConnector();

// AJAX handler for manual sync
add_action('wp_ajax_wphub_sync_now', function() {
    $connector = new WPPluginHubConnector();
    $connector->sync_site_data();
    $connector->execute_commands();
    wp_send_json_success(array('message' => 'Synchronisatie voltooid'));
});`;

  const copyCode = () => {
    navigator.clipboard.writeText(pluginCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedApiKey(true);
    setTimeout(() => setCopiedApiKey(false), 2000);
  };

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="border-b border-gray-100">
        <CardTitle className="flex items-center gap-2">
          <Code className="w-5 h-5 text-indigo-600" />
          WordPress Connector Plugin Installatie
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-indigo-200">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-indigo-600" />
            Installatie Stappen
          </h3>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Badge className="bg-indigo-600 text-white mt-0.5">1</Badge>
              <div>
                <p className="font-medium">Maak een nieuwe plugin aan</p>
                <p className="text-gray-600 mt-1">Maak een map <code className="bg-white px-2 py-0.5 rounded">wp-plugin-hub-connector</code> in je WordPress <code className="bg-white px-2 py-0.5 rounded">wp-content/plugins/</code> directory</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Badge className="bg-indigo-600 text-white mt-0.5">2</Badge>
              <div>
                <p className="font-medium">Kopieer de plugin code</p>
                <p className="text-gray-600 mt-1">Maak een bestand <code className="bg-white px-2 py-0.5 rounded">wp-plugin-hub-connector.php</code> en plak de onderstaande code erin</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Badge className="bg-indigo-600 text-white mt-0.5">3</Badge>
              <div>
                <p className="font-medium">Pas de API URL aan</p>
                <p className="text-gray-600 mt-1">Vervang <code className="bg-white px-2 py-0.5 rounded">https://wphub.pro</code> met jouw Base44 app URL</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Badge className="bg-indigo-600 text-white mt-0.5">4</Badge>
              <div>
                <p className="font-medium">Activeer de plugin</p>
                <p className="text-gray-600 mt-1">Ga naar WordPress Admin → Plugins en activeer "WP Plugin Hub Connector"</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Badge className="bg-indigo-600 text-white mt-0.5">5</Badge>
              <div>
                <p className="font-medium">Voer de API Key in</p>
                <p className="text-gray-600 mt-1">Ga naar Instellingen → WP Plugin Hub en voer je API key in (zie hieronder)</p>
              </div>
            </li>
          </ol>
        </div>

        {apiKey && (
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <h4 className="font-semibold text-gray-900 mb-2">Jouw API Key:</h4>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white px-3 py-2 rounded font-mono text-sm border border-amber-300">
                {apiKey}
              </code>
              <Button size="icon" variant="outline" onClick={copyApiKey}>
                {copiedApiKey ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">Plugin Code:</h4>
            <Button variant="outline" size="sm" onClick={copyCode}>
              {copiedCode ? (
                <>
                  <Check className="w-4 h-4 mr-2 text-green-600" />
                  Gekopieerd
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Kopieer Code
                </>
              )}
            </Button>
          </div>
          <div className="bg-gray-900 p-4 rounded-xl overflow-auto max-h-96">
            <pre className="text-sm text-gray-100 font-mono">
              <code>{pluginCode}</code>
            </pre>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Wat doet de connector plugin?
          </h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">•</span>
              <span>Synchroniseert elk uur automatisch je plugin status met het platform</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">•</span>
              <span>Voert direct synchronisatie uit wanneer je wijzigingen maakt op het platform</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">•</span>
              <span>Gebruikt WP-CLI voor betrouwbare plugin installatie, activering, en verwijdering</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">•</span>
              <span>Rapporteert WordPress versie en plugin status terug naar het platform</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">•</span>
              <span>Biedt een handmatige sync knop in WordPress Admin → Instellingen</span>
            </li>
          </ul>
        </div>

        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
          <h4 className="font-semibold text-gray-900 mb-2">💡 Tips:</h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>Zorg dat WP-CLI geïnstalleerd is op je server voor automatische plugin management</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>Test de connector eerst op een staging site voordat je deze op productie gebruikt</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>Maak altijd een backup voordat je plugins automatisch laat installeren/updaten</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>Je kunt de sync frequentie aanpassen door 'hourly' te vervangen door 'twicedaily' of 'daily'</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>Controleer de WP-CLI status in WordPress Admin → Instellingen → WP Plugin Hub</span>
            </li>
          </ul>
        </div>

        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
          <h4 className="font-semibold text-gray-900 mb-2">⚠️ Vereisten:</h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-amber-600 mt-1">•</span>
              <span><strong>WP-CLI moet geïnstalleerd zijn</strong> op je server. Zonder WP-CLI kan de plugin geen automatische installaties uitvoeren.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 mt-1">•</span>
              <span>Test of WP-CLI werkt: <code className="bg-white px-2 py-0.5 rounded">wp --version</code></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 mt-1">•</span>
              <span>De connector plugin controleert automatisch of WP-CLI beschikbaar is</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
