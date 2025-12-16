
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Search, Plus, Trash2, Send } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import SendNotificationDialog from "../components/messaging/SendNotificationDialog";
import { useUser } from "../Layout";

export default function AdminNotifications() {
  const user = useUser();
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Only redirect if user exists and is not admin
    if (user && user.role !== "admin") {
      navigate(createPageUrl("Dashboard"));
    }
  }, [user, navigate]);

  // Removed loadUser function as it's replaced by useUser and useQuery

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['admin-all-notifications'],
    queryFn: async () => {
      if (!user || user.role !== 'admin') return [];
      
      const notifs = await base44.entities.Notification.list("-created_date", 100);
      return notifs;
    },
    enabled: !!user && user.role === "admin", // Only run query if user is admin
    staleTime: 500,
    initialData: [],
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId) => base44.entities.Notification.delete(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-notifications'] });
    },
  });

  const notificationTemplates = [
    {
      icon: Plus, // Placeholder, original was Users
      title: "Alle Gebruikers",
      description: "Stuur een notificatie naar alle platform gebruikers",
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      recipientType: "all_users"
    },
    {
      icon: Plus, // Placeholder, original was Crown
      title: "Team Owners",
      description: "Stuur een notificatie naar alle team eigenaren",
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50",
      recipientType: "all_team_owners"
    },
    {
      icon: Plus, // Placeholder, original was Building
      title: "Alle Teams",
      description: "Stuur een notificatie naar alle team inboxes",
      color: "from-indigo-500 to-indigo-600",
      bgColor: "bg-indigo-50",
      recipientType: "all_team_inboxes"
    },
    {
      icon: Plus, // Placeholder, original was UserCheck
      title: "Specifieke Gebruiker",
      description: "Stuur een notificatie naar één specifieke gebruiker",
      color: "from-emerald-500 to-emerald-600",
      bgColor: "bg-emerald-50",
      recipientType: "user"
    },
    {
      icon: Plus, // Placeholder, original was Users
      title: "Selectie Gebruikers",
      description: "Selecteer meerdere gebruikers om een notificatie te sturen",
      color: "from-cyan-500 to-cyan-600",
      bgColor: "bg-cyan-50",
      recipientType: "multiple_users"
    },
    {
      icon: Plus, // Placeholder, original was Building
      title: "Selectie Teams",
      description: "Selecteer meerdere teams om een notificatie te sturen",
      color: "from-violet-500 to-violet-600",
      bgColor: "bg-violet-50",
      recipientType: "multiple_teams"
    }
  ];

  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const handleTemplateClick = (template) => {
    setSelectedTemplate(template);
    setShowNotificationDialog(true);
  };

  const filteredNotifications = notifications.filter(
    (notif) =>
      notif.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notif.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notif.recipient_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notif.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user || user.role !== "admin") {
    return null; // Don't render anything if not an admin
  }

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Admin Notificaties</h1>
            <Button
              onClick={() => {
                setSelectedTemplate(null);
                setShowNotificationDialog(true);
              }}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nieuwe Notificatie
            </Button>
          </div>
          <p className="text-gray-500">
            Verstuur notificaties naar gebruikers en teams op het platform
          </p>
        </div>

        {/* Info Card */}
        <Card className="border-none shadow-lg mb-8 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Platform Notificaties</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Gebruik deze pagina om belangrijke mededelingen, updates of waarschuwingen te versturen 
                  naar gebruikers en teams. Notificaties verschijnen in de notificatiebalk van ontvangers.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    Real-time notificaties
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Bulk verzending
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Categorieën: Info, Success, Warning, Error
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Quick Actions and Sent Notifications */}
        <Tabs defaultValue="quick-actions" className="mt-8">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick-actions">Snelle Acties</TabsTrigger>
            <TabsTrigger value="sent-notifications">Verzonden Notificaties</TabsTrigger>
          </TabsList>

          <TabsContent value="quick-actions" className="mt-6">
            {/* Templates Grid (Quick Actions) */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Selecteer een Snel Sjabloon</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {notificationTemplates.map((template, index) => (
                  <Card
                    key={index}
                    className="border-2 border-gray-200 hover:border-indigo-300 cursor-pointer transition-all hover:shadow-lg group"
                    onClick={() => handleTemplateClick(template)}
                  >
                    <div className="p-6"> {/* CardHeader content moved to a div as CardHeader was removed */}
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${template.bgColor} group-hover:scale-110 transition-transform`}>
                          <template.icon className={`w-6 h-6 bg-gradient-to-br ${template.color} bg-clip-text text-transparent`} style={{
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))`
                          }} />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold">{template.title}</h3> {/* CardTitle content moved to h3 */}
                    </div>
                    <CardContent className="pt-0 p-6">
                      <p className="text-sm text-gray-600">{template.description}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-4 group-hover:bg-indigo-50 group-hover:border-indigo-300 transition-colors"
                      >
                        <Bell className="w-4 h-4 mr-2" />
                        Verstuur Notificatie
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Best Practices */}
            <Card className="border-none shadow-lg mt-8">
              <div className="p-6 border-b border-gray-100"> {/* CardHeader content moved to a div as CardHeader was removed */}
                <h3 className="text-lg font-semibold">Best Practices</h3> {/* CardTitle content moved to h3 */}
              </div>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-sm">✓</span>
                      Wel doen
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">•</span>
                        <span>Gebruik duidelijke en beknopte titels</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">•</span>
                        <span>Geef relevante context in het bericht</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">•</span>
                        <span>Gebruik het juiste type notificatie (info, success, warning, error)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">•</span>
                        <span>Test eerst met een kleine groep voordat je broadcast</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-sm">✗</span>
                      Niet doen
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-start gap-2">
                        <span className="text-red-600 mt-0.5">•</span>
                        <span>Vermijd te frequente notificaties (notification fatigue)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-600 mt-0.5">•</span>
                        <span>Gebruik geen vage of cryptische berichten</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-600 mt-0.5">•</span>
                        <span>Stuur geen marketing of promotionele content als system notificatie</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-600 mt-0.5">•</span>
                        <span>Gebruik error type niet voor algemene mededelingen</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sent-notifications" className="mt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Verzonden Notificaties</h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Zoeken op titel, bericht of ontvanger..."
                className="pl-9 pr-4 py-2 border rounded-md w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {isLoading ? (
              <p className="text-gray-600">Laden van notificaties...</p>
            ) : filteredNotifications.length === 0 ? (
              <p className="text-gray-600">Geen notificaties gevonden.</p>
            ) : (
              <div className="space-y-4">
                {filteredNotifications.map((notif) => (
                  <Card key={notif.id} className="shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{notif.title}</h4>
                          <Badge variant="outline" className="text-xs">{notif.category}</Badge>
                          <Badge variant="secondary" className="text-xs">{notif.recipient_type}</Badge>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2 mb-1">{notif.message}</p>
                        <p className="text-xs text-gray-500">
                          Verzonden op: {format(new Date(notif.created_date), "PPP p", { locale: nl })}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="flex-shrink-0 ml-4"
                        onClick={() => deleteNotificationMutation.mutate(notif.id)}
                        disabled={deleteNotificationMutation.isLoading}
                      >
                        {deleteNotificationMutation.isLoading ? (
                          <Send className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Send Notification Dialog */}
        <SendNotificationDialog
          open={showNotificationDialog}
          onOpenChange={setShowNotificationDialog}
          user={user}
          defaultRecipientType={selectedTemplate?.recipientType}
        />
      </div>
    </div>
  );
}
