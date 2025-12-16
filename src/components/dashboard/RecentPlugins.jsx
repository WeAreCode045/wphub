import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowRight, HardDrive, Cloud } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function RecentPlugins({ plugins, allSites }) {
  const recentPlugins = plugins.slice(0, 5);

  const getInstalledSitesCount = (plugin) => {
    return plugin.installed_on?.length || 0;
  };

  return (
    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-indigo-50 to-purple-50 border-b border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-gray-900">Recente Plugins</CardTitle>
              <p className="text-xs text-gray-600 mt-1">Jouw laatste WordPress plugins</p>
            </div>
          </div>
          <Button 
            asChild 
            variant="ghost"
            size="sm"
            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100"
          >
            <Link to={createPageUrl("Plugins")}>
              Alles bekijken
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {recentPlugins.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Nog geen plugins</h3>
            <p className="text-sm text-gray-500 mb-4">Voeg je eerste plugin toe</p>
            <Button 
              asChild
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-lg shadow-indigo-500/50"
            >
              <Link to={createPageUrl("Plugins")}>
                Plugin Toevoegen
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {recentPlugins.map((plugin) => {
              const isExternal = plugin.is_external || plugin.source === 'wplibrary';
              const installedCount = getInstalledSitesCount(plugin);
              
              return (
                <div
                  key={plugin.id}
                  className="group p-4 rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 bg-white"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                        {isExternal ? (
                          <Cloud className="w-5 h-5 text-white" />
                        ) : (
                          <HardDrive className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900 truncate">{plugin.name}</h4>
                          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">
                            {isExternal ? 'Remote' : 'Local'}
                          </Badge>
                        </div>
                        {plugin.description && (
                          <p className="text-xs text-gray-600 line-clamp-1 mb-2">
                            {plugin.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                            <span>{installedCount} {installedCount === 1 ? 'site' : 'sites'}</span>
                          </div>
                          {plugin.latest_version && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                              <span>v{plugin.latest_version}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                    >
                      <Link to={createPageUrl(`PluginDetail?id=${plugin.id}`)}>
                        Beheren
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}