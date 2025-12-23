import { createClientFromRequest } from '../base44Shim.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { site_id } = await req.json();

        console.log('[performHealthCheck] Starting health check for site:', site_id);

        if (!site_id) {
            return Response.json({ error: 'Site ID is required' }, { status: 400 });
        }

        // Get site details
        const sites = await base44.asServiceRole.entities.Site.filter({ id: site_id });
        if (sites.length === 0) {
            return Response.json({ error: 'Site not found' }, { status: 404 });
        }
        const site = sites[0];

        console.log('[performHealthCheck] Site:', site.name);

        // Call connector health check endpoint
        const connectorUrl = `${site.url}/wp-json/wphub/v1/healthCheck`;
        
        const startTime = Date.now();
        let healthData = {
            last_check: new Date().toISOString(),
            status: 'unknown',
            uptime: {},
            performance: {},
            security: {},
            updates: {},
            debug_settings: {}
        };

        try {
            const response = await fetch(connectorUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    api_key: site.api_key
                })
            });

            const responseTime = Date.now() - startTime;

            if (!response.ok) {
                console.error('[performHealthCheck] Connector error:', response.status);
                healthData.status = 'critical';
                healthData.uptime = {
                    is_up: false,
                    response_time: responseTime,
                    last_down: new Date().toISOString()
                };
            } else {
                const result = await response.json();
                console.log('[performHealthCheck] Health check result:', result);

                // Uptime check
                healthData.uptime = {
                    is_up: true,
                    response_time: responseTime,
                    uptime_percentage: 99.9 // This would be calculated from historical data
                };

                // Performance check
                healthData.performance = {
                    page_load_time: responseTime,
                    ttfb: result.ttfb || responseTime,
                    score: responseTime < 500 ? 'excellent' : responseTime < 1000 ? 'good' : responseTime < 2000 ? 'fair' : 'poor',
                    recommendations: []
                };

                if (responseTime > 1000) {
                    healthData.performance.recommendations.push('Consider optimizing your WordPress site for better performance');
                }
                if (result.plugins_count > 30) {
                    healthData.performance.recommendations.push('You have many plugins installed. Consider deactivating unused ones.');
                }

                // Security check
                const sslValid = site.url.startsWith('https://');
                healthData.security = {
                    ssl_valid: sslValid,
                    vulnerabilities: [],
                    last_scan: new Date().toISOString()
                };

                if (!sslValid) {
                    healthData.security.vulnerabilities.push({
                        type: 'ssl',
                        severity: 'high',
                        description: 'Site is not using HTTPS/SSL encryption',
                        affected_plugin: null
                    });
                }

                // Updates check
                healthData.updates = {
                    core: {
                        current_version: result.wp_version,
                        latest_version: result.wp_latest_version || result.wp_version,
                        update_available: result.wp_update_available || false
                    },
                    plugins: result.plugin_updates || [],
                    themes: result.theme_updates || [],
                    last_checked: new Date().toISOString()
                };

                // Debug settings
                healthData.debug_settings = {
                    wp_debug: result.wp_debug || false,
                    wp_debug_log: result.wp_debug_log || false,
                    wp_debug_display: result.wp_debug_display || false
                };

                // Determine overall status
                const hasVulnerabilities = healthData.security.vulnerabilities.length > 0;
                const hasCriticalUpdates = healthData.updates.core.update_available;
                const poorPerformance = healthData.performance.score === 'poor';

                if (hasVulnerabilities || hasCriticalUpdates) {
                    healthData.status = 'critical';
                } else if (poorPerformance || healthData.updates.plugins.length > 5) {
                    healthData.status = 'warning';
                } else {
                    healthData.status = 'healthy';
                }
            }
        } catch (fetchError) {
            console.error('[performHealthCheck] Fetch error:', fetchError);
            healthData.status = 'critical';
            healthData.uptime = {
                is_up: false,
                response_time: Date.now() - startTime,
                last_down: new Date().toISOString()
            };
        }

        // Update site with health check data
        await base44.asServiceRole.entities.Site.update(site_id, {
            health_check: healthData
        });

        console.log('[performHealthCheck] Health check completed with status:', healthData.status);

        // Create notification if status is critical or warning and alerts are enabled
        if ((healthData.status === 'critical' || healthData.status === 'warning') && site.health_alerts_enabled !== false) {
            await base44.asServiceRole.entities.Notification.create({
                recipient_id: site.owner_id,
                title: `Health Alert: ${site.name}`,
                message: `Health check detected issues on ${site.name}. Status: ${healthData.status}`,
                type: healthData.status === 'critical' ? 'error' : 'warning',
                context: {
                    type: 'site',
                    id: site.id,
                    name: site.name
                }
            });
        }

        return Response.json({
            success: true,
            health_check: healthData
        });

    } catch (error) {
        console.error('[performHealthCheck] Error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});