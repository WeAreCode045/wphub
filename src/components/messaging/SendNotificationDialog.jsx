import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SendNotificationDialog({ 
  open, 
  onOpenChange, 
  user, 
  context = null,
  defaultRecipientType = null,
  defaultRecipientId = null 
}) {
  const [notificationData, setNotificationData] = useState({
    title: "",
    message: "",
    type: "info",
    recipient_type: defaultRecipientType || "all_users",
    recipient_id: defaultRecipientId || "",
    recipient_ids: [],
    team_id: "",
    team_ids: []
  });
  const queryClient = useQueryClient();

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (defaultRecipientType) {
      setNotificationData(prev => ({ ...prev, recipient_type: defaultRecipientType }));
    }
    if (defaultRecipientId) {
      setNotificationData(prev => ({ ...prev, recipient_id: defaultRecipientId }));
    }
  }, [defaultRecipientType, defaultRecipientId]);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin && open,
    initialData: [],
  });

  const { data: allTeams = [] } = useQuery({
    queryKey: ['all-teams'],
    queryFn: () => base44.entities.Team.list(),
    enabled: isAdmin && open,
    initialData: [],
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async (data) => {
      const notificationPayload = {
        ...data,
        sender_id: user.id,
        sender_name: user.full_name,
        context: context || {}
      };

      // Set recipient details based on type
      if (data.recipient_type === "user" && data.recipient_id) {
        const recipient = allUsers.find(u => u.id === data.recipient_id);
        notificationPayload.recipient_email = recipient?.email;
      } else if (data.recipient_type === "team" && data.team_id) {
        notificationPayload.recipient_id = data.team_id;
      }

      return base44.entities.Notification.create(notificationPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      onOpenChange(false);
      resetForm();
      alert('✅ Notificatie succesvol verzonden');
    },
    onError: (error) => {
      alert('❌ Fout: ' + error.message);
    }
  });

  const resetForm = () => {
    setNotificationData({
      title: "",
      message: "",
      type: "info",
      recipient_type: defaultRecipientType || "all_users",
      recipient_id: defaultRecipientId || "",
      recipient_ids: [],
      team_id: "",
      team_ids: []
    });
  };

  const handleSend = () => {
    if (!notificationData.title || !notificationData.message) {
      alert('Vul alle verplichte velden in');
      return;
    }
    
    sendNotificationMutation.mutate(notificationData);
  };

  const toggleRecipient = (id) => {
    setNotificationData(prev => ({
      ...prev,
      recipient_ids: prev.recipient_ids.includes(id)
        ? prev.recipient_ids.filter(rid => rid !== id)
        : [...prev.recipient_ids, id]
    }));
  };

  const toggleTeam = (teamId) => {
    setNotificationData(prev => ({
      ...prev,
      team_ids: prev.team_ids.includes(teamId)
        ? prev.team_ids.filter(tid => tid !== teamId)
        : [...prev.team_ids, teamId]
    }));
  };

  const toggleAllUsers = () => {
    const currentSelection = notificationData.recipient_ids;
    const availableIds = allUsers.map(u => u.id);
    
    if (currentSelection.length === availableIds.length) {
      setNotificationData(prev => ({ ...prev, recipient_ids: [] }));
    } else {
      setNotificationData(prev => ({ ...prev, recipient_ids: availableIds }));
    }
  };

  const toggleAllTeams = () => {
    const currentSelection = notificationData.team_ids;
    const availableIds = allTeams.map(t => t.id);
    
    if (currentSelection.length === availableIds.length) {
      setNotificationData(prev => ({ ...prev, team_ids: [] }));
    } else {
      setNotificationData(prev => ({ ...prev, team_ids: availableIds }));
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notificatie Versturen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>Ontvanger Type</Label>
            <Select 
              value={notificationData.recipient_type} 
              onValueChange={(value) => {
                setNotificationData({...notificationData, recipient_type: value, recipient_id: "", recipient_ids: [], team_id: "", team_ids: []});
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Specifieke Gebruiker</SelectItem>
                <SelectItem value="multiple_users">Selectie van Gebruikers</SelectItem>
                <SelectItem value="all_users">Alle Gebruikers</SelectItem>
                <SelectItem value="all_team_owners">Alle Team Owners</SelectItem>
                <SelectItem value="team">Specifiek Team</SelectItem>
                <SelectItem value="multiple_teams">Selectie van Teams</SelectItem>
                <SelectItem value="all_team_inboxes">Alle Teams</SelectItem>
                <SelectItem value="admin">Andere Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Single User */}
          {notificationData.recipient_type === "user" && (
            <div>
              <Label>Gebruiker</Label>
              <Select 
                value={notificationData.recipient_id} 
                onValueChange={(value) => setNotificationData({...notificationData, recipient_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer gebruiker" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Multiple Users Selection */}
          {notificationData.recipient_type === "multiple_users" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Selecteer Gebruikers</Label>
                <Button size="sm" variant="outline" onClick={toggleAllUsers}>
                  {notificationData.recipient_ids.length === allUsers.length ? "Deselecteer alles" : "Selecteer alles"}
                </Button>
              </div>
              <ScrollArea className="h-48 border rounded-lg p-2">
                <div className="space-y-2">
                  {allUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                      <Checkbox
                        checked={notificationData.recipient_ids.includes(u.id)}
                        onCheckedChange={() => toggleRecipient(u.id)}
                      />
                      <span className="text-sm">{u.full_name} ({u.email}) {u.role === "admin" && "- Admin"}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-xs text-gray-500 mt-1">{notificationData.recipient_ids.length} gebruikers geselecteerd</p>
            </div>
          )}

          {/* Single Team */}
          {notificationData.recipient_type === "team" && (
            <div>
              <Label>Team</Label>
              <Select 
                value={notificationData.team_id} 
                onValueChange={(value) => setNotificationData({...notificationData, team_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer team" />
                </SelectTrigger>
                <SelectContent>
                  {allTeams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Multiple Teams Selection */}
          {notificationData.recipient_type === "multiple_teams" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Selecteer Teams</Label>
                <Button size="sm" variant="outline" onClick={toggleAllTeams}>
                  {notificationData.team_ids.length === allTeams.length ? "Deselecteer alles" : "Selecteer alles"}
                </Button>
              </div>
              <ScrollArea className="h-48 border rounded-lg p-2">
                <div className="space-y-2">
                  {allTeams.map(team => (
                    <div key={team.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                      <Checkbox
                        checked={notificationData.team_ids.includes(team.id)}
                        onCheckedChange={() => toggleTeam(team.id)}
                      />
                      <span className="text-sm">{team.name}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-xs text-gray-500 mt-1">{notificationData.team_ids.length} teams geselecteerd</p>
            </div>
          )}

          {/* Title and Message */}
          <div>
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              value={notificationData.title}
              onChange={(e) => setNotificationData({...notificationData, title: e.target.value})}
              placeholder="Titel van de notificatie"
            />
          </div>

          <div>
            <Label htmlFor="message">Bericht *</Label>
            <Textarea
              id="message"
              value={notificationData.message}
              onChange={(e) => setNotificationData({...notificationData, message: e.target.value})}
              placeholder="Schrijf je notificatie..."
              rows={5}
            />
          </div>

          {/* Type */}
          <div>
            <Label>Type</Label>
            <Select 
              value={notificationData.type} 
              onValueChange={(value) => setNotificationData({...notificationData, type: value})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Informatie</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Waarschuwing</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="team_announcement">Aankondiging</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button 
              onClick={handleSend}
              disabled={sendNotificationMutation.isPending}
              className="flex-1"
            >
              {sendNotificationMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Versturen...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Verstuur Notificatie
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}