import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Globe, ArrowRight, HardDrive, Cloud, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PluginSiteOverview({ plugins = [], sites = [], allPlugins = [] }) {
  const getInstalledPluginsCount = (site) => {
    return allPlugins.filter(plugin => 
      plugin.installed_on?.some(install => install.site_id === site.id)
    ).length;
  };

  const getInstalledSitesCount = (plugin) => {
    return plugin.installed_on?.length || 0;
  };

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="border-b border-gray-100 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Overzicht</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              <Package className="w-3 h-3 mr-1" />
              {plugins.length} plugins
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Globe className="w-3 h-3 mr-1" />
              {sites.length} sites
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs defaultValue="plugins" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="plugins">
              <Package className="w-4 h-4 mr-2" />
              Plugins ({plugins.length})
            </TabsTrigger>
            <TabsTrigger value="sites">
              <Globe className="w-4 h-4 mr-2" />
              Sites ({sites.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plugins" className="space-y-3 mt-0">
            {plugins.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nog geen plugins</p>
                <Button asChild size="sm" className="mt-4" variant="outline">
                  <Link to={createPageUrl("Plugins")}>
                    Plugin Toevoegen
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                {plugins.slice(0, 5).map((plugin) => {
                  const isExternal = plugin.source === 'wplibrary';
                  const installedCount = getInstalledSitesCount(plugin);
                  
                  return (
                    <div key={plugin.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        {isExternal ? (
                          <Cloud className="w-5 h-5 text-white" />
                        ) : (
                          <HardDrive className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{plugin.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Badge className="bg-indigo-100 text-indigo-700 text-xs">
                            {isExternal ? 'Remote' : 'Local'}
                          </Badge>
                          <span>•</span>
                          <span>{installedCount} {installedCount === 1 ? 'site' : 'sites'}</span>
                          {plugin.latest_version && (
                            <>
                              <span>•</span>
                              <span>v{plugin.latest_version}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button asChild size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link to={createPageUrl(`PluginDetail?id=${plugin.id}`)}>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  );
                })}
                <Button asChild variant="outline" size="sm" className="w-full mt-4">
                  <Link to={createPageUrl("Plugins")}>
                    Bekijk Alle Plugins
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="sites" className="space-y-3 mt-0">
            {sites.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nog geen sites</p>
                <Button asChild size="sm" className="mt-4" variant="outline">
                  <Link to={createPageUrl("Sites")}>
                    Site Toevoegen
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                {sites.slice(0, 5).map((site) => {
                  const installedCount = getInstalledPluginsCount(site);
                  
                  return (
                    <div key={site.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Globe className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{site.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Badge className={
                            site.connection_status === "active" 
                              ? "bg-green-100 text-green-700 text-xs" 
                              : "bg-amber-100 text-amber-700 text-xs"
                          }>
                            {site.connection_status === "active" ? "Actief" : "Inactief"}
                          </Badge>
                          <span>•</span>
                          <span>{installedCount} {installedCount === 1 ? 'plugin' : 'plugins'}</span>
                          {site.wp_version && (
                            <>
                              <span>•</span>
                              <span>WP {site.wp_version}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          asChild 
                          size="sm" 
                          variant="ghost" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a href={site.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                        <Button asChild size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link to={createPageUrl(`SiteDetail?id=${site.id}`)}>
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Button asChild variant="outline" size="sm" className="w-full mt-4">
                  <Link to={createPageUrl("Sites")}>
                    Bekijk Alle Sites
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}