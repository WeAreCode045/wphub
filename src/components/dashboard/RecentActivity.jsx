import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Package, Globe, Users, Bell } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function RecentActivity({ activities }) {
  const getEntityIcon = (entityType) => {
    switch (entityType) {
      case "plugin":
        return <Package className="w-4 h-4 text-indigo-600" />;
      case "site":
        return <Globe className="w-4 h-4 text-emerald-600" />;
      case "user":
        return <Users className="w-4 h-4 text-purple-600" />;
      case "notification":
        return <Bell className="w-4 h-4 text-amber-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEntityColor = (entityType) => {
    const colors = {
      plugin: "bg-indigo-100 text-indigo-700",
      site: "bg-emerald-100 text-emerald-700",
      user: "bg-purple-100 text-purple-700",
      notification: "bg-amber-100 text-amber-700"
    };
    return colors[entityType] || "bg-gray-100 text-gray-700";
  };

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="border-b border-gray-100 pb-4">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-600" />
          Recente Activiteiten
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nog geen activiteiten</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div 
                key={activity.id}
                className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all duration-200 border border-gray-100"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getEntityColor(activity.entity_type).replace('text-', 'bg-').replace('-700', '-100')}`}>
                  {getEntityIcon(activity.entity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{activity.action}</p>
                  {activity.details && (
                    <p className="text-sm text-gray-500 mt-1">{activity.details}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-xs text-gray-400">
                      {activity.user_email}
                    </p>
                    <span className="text-xs text-gray-400">•</span>
                    <p className="text-xs text-gray-400">
                      {format(new Date(activity.created_date), "d MMM yyyy HH:mm", { locale: nl })}
                    </p>
                  </div>
                </div>
                <Badge className={getEntityColor(activity.entity_type)}>
                  {activity.entity_type}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}