import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Package, Globe, Users } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function TeamActivity({ teamId }) {
  const { data: activities = [] } = useQuery({
    queryKey: ['team-activities', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      return await base44.entities.ActivityLog.filter({ 
        entity_type: "team",
        entity_id: teamId 
      }, "-created_date", 10);
    },
    enabled: !!teamId,
    initialData: [],
  });

  const getEntityIcon = (entityType) => {
    switch (entityType) {
      case "plugin":
        return <Package className="w-4 h-4 text-indigo-600" />;
      case "site":
        return <Globe className="w-4 h-4 text-emerald-600" />;
      case "team":
        return <Users className="w-4 h-4 text-blue-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEntityColor = (entityType) => {
    const colors = {
      plugin: "bg-indigo-100 text-indigo-700",
      site: "bg-emerald-100 text-emerald-700",
      team: "bg-blue-100 text-blue-700"
    };
    return colors[entityType] || "bg-gray-100 text-gray-700";
  };

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="border-b border-gray-100 pb-4">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-600" />
          Team Activiteiten
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nog geen team activiteiten</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div 
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-all duration-200"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getEntityColor(activity.entity_type).replace('text-', 'bg-').replace('-700', '-100')}`}>
                  {getEntityIcon(activity.entity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                  {activity.details && (
                    <p className="text-xs text-gray-500 mt-1">{activity.details}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-400">
                      {activity.user_email}
                    </p>
                    <span className="text-xs text-gray-400">•</span>
                    <p className="text-xs text-gray-400">
                      {format(new Date(activity.created_date), "d MMM HH:mm", { locale: nl })}
                    </p>
                  </div>
                </div>
                <Badge className={`${getEntityColor(activity.entity_type)} text-xs`}>
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