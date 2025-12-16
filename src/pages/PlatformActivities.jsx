import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Package, Globe, Users, Bell, Search } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PlatformActivities() {
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
    
    if (currentUser.role !== "admin") {
      navigate(createPageUrl("Dashboard"));
    }
  };

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['platform-activities'],
    queryFn: () => base44.entities.ActivityLog.list("-created_date", 200),
    initialData: [],
  });

  const filteredActivities = activities.filter(activity => 
    activity.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    activity.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    activity.details?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pluginActivities = filteredActivities.filter(a => 
    a.entity_type === "plugin" || a.entity_type === "plugin_version"
  );

  const siteActivities = filteredActivities.filter(a => 
    a.entity_type === "site"
  );

  const userActivities = filteredActivities.filter(a => 
    a.entity_type === "user"
  );

  const notificationActivities = filteredActivities.filter(a => 
    a.entity_type === "notification"
  );

  const getEntityIcon = (entityType) => {
    switch (entityType) {
      case "plugin":
      case "plugin_version":
        return <Package className="w-5 h-5 text-indigo-600" />;
      case "site":
        return <Globe className="w-5 h-5 text-emerald-600" />;
      case "user":
        return <Users className="w-5 h-5 text-purple-600" />;
      case "notification":
        return <Bell className="w-5 h-5 text-amber-600" />;
      default:
        return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const getEntityColor = (entityType) => {
    const colors = {
      plugin: "bg-indigo-100 text-indigo-700 border-indigo-200",
      plugin_version: "bg-indigo-100 text-indigo-700 border-indigo-200",
      site: "bg-emerald-100 text-emerald-700 border-emerald-200",
      user: "bg-purple-100 text-purple-700 border-purple-200",
      notification: "bg-amber-100 text-amber-700 border-amber-200"
    };
    return colors[entityType] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getEntityLabel = (entityType) => {
    const labels = {
      plugin: "Plugin",
      plugin_version: "Plugin Versie",
      site: "Site",
      user: "Gebruiker",
      notification: "Notificatie"
    };
    return labels[entityType] || entityType;
  };

  const ActivityList = ({ activities }) => (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div 
          key={activity.id}
          className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-all"
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getEntityColor(activity.entity_type).replace('text-', 'bg-').replace('-700', '-100')}`}>
            {getEntityIcon(activity.entity_type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">{activity.action}</p>
            {activity.details && (
              <p className="text-sm text-gray-600 mt-1">{activity.details}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <p className="text-xs text-gray-500">
                {activity.user_email}
              </p>
              <span className="text-xs text-gray-400">•</span>
              <p className="text-xs text-gray-500">
                {format(new Date(activity.created_date), "d MMM yyyy HH:mm", { locale: nl })}
              </p>
            </div>
          </div>
          <Badge className={getEntityColor(activity.entity_type)}>
            {getEntityLabel(activity.entity_type)}
          </Badge>
        </div>
      ))}
    </div>
  );

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Platform Activiteiten</h1>
          <p className="text-gray-500">Volg alle acties en wijzigingen op het platform</p>
        </div>

        <Card className="border-none shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Zoek activiteiten..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <Tabs defaultValue="all" className="w-full">
            <div className="border-b border-gray-100 px-6 pt-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all" className="gap-2">
                  <Activity className="w-4 h-4" />
                  Alle ({filteredActivities.length})
                </TabsTrigger>
                <TabsTrigger value="plugins" className="gap-2">
                  <Package className="w-4 h-4" />
                  Plugins ({pluginActivities.length})
                </TabsTrigger>
                <TabsTrigger value="sites" className="gap-2">
                  <Globe className="w-4 h-4" />
                  Sites ({siteActivities.length})
                </TabsTrigger>
                <TabsTrigger value="users" className="gap-2">
                  <Users className="w-4 h-4" />
                  Gebruikers ({userActivities.length})
                </TabsTrigger>
                <TabsTrigger value="notifications" className="gap-2">
                  <Bell className="w-4 h-4" />
                  Notificaties ({notificationActivities.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="m-0">
              <CardContent className="p-6">
                {filteredActivities.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Activity className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {searchQuery ? "Geen activiteiten gevonden" : "Nog geen activiteiten"}
                    </h3>
                    <p className="text-gray-500">
                      {searchQuery && "Probeer een andere zoekopdracht"}
                    </p>
                  </div>
                ) : (
                  <ActivityList activities={filteredActivities} />
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="plugins" className="m-0">
              <CardContent className="p-6">
                {pluginActivities.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Nog geen plugin activiteiten
                    </h3>
                  </div>
                ) : (
                  <ActivityList activities={pluginActivities} />
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="sites" className="m-0">
              <CardContent className="p-6">
                {siteActivities.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Globe className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Nog geen site activiteiten
                    </h3>
                  </div>
                ) : (
                  <ActivityList activities={siteActivities} />
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="users" className="m-0">
              <CardContent className="p-6">
                {userActivities.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Nog geen gebruiker activiteiten
                    </h3>
                  </div>
                ) : (
                  <ActivityList activities={userActivities} />
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="notifications" className="m-0">
              <CardContent className="p-6">
                {notificationActivities.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Bell className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Nog geen notificatie activiteiten
                    </h3>
                  </div>
                ) : (
                  <ActivityList activities={notificationActivities} />
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}