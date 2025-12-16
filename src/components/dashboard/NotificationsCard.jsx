
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Trash2, Reply, Send, CheckCircle, Info, AlertTriangle, XCircle, ChevronDown, ChevronUp, Inbox, SendHorizontal, Plus, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function NotificationsCard({ userId, userEmail, isAdmin }) {
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [expandedReplies, setExpandedReplies] = useState({});
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [newNotification, setNewNotification] = useState({
    recipient_id: "",
    title: "",
    message: "",
    type: "info"
  });
  const queryClient = useQueryClient();

  // Fetch inbox notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      return base44.entities.Notification.filter({ recipient_id: userId }, "-created_date");
    },
    enabled: !!userId,
    initialData: [],
  });

  // Fetch sent notifications (outbox)
  const { data: sentNotifications = [] } = useQuery({
    queryKey: ['sent-notifications', userEmail],
    queryFn: async () => {
      if (!userEmail) return [];
      const allNotifications = await base44.entities.Notification.list("-created_date");
      return allNotifications.filter(n => n.created_by === userEmail);
    },
    enabled: !!userEmail,
    initialData: [],
  });

  // Query for all users (for recipient selection)
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-notifications'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  // Filter users based on current user's role
  const availableRecipients = isAdmin 
    ? users
    : users.filter(u => u.role === "admin");

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId) => 
      base44.entities.Notification.update(notificationId, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (notificationId) => 
      base44.entities.Notification.delete(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['sent-notifications'] });
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async (notificationData) => {
      const currentUser = await base44.auth.me();
      
      if (notificationData.recipient_id === "all") {
        const allUsers = users.filter(u => u.id !== currentUser.id);
        const promises = allUsers.map(user => 
          base44.entities.Notification.create({
            recipient_id: user.id,
            recipient_email: user.email,
            title: notificationData.title,
            message: notificationData.message,
            type: notificationData.type,
            is_read: false
          })
        );
        await Promise.all(promises);
        
        await base44.entities.ActivityLog.create({
          user_email: currentUser.email,
          action: `Notificatie gestuurd naar alle gebruikers`,
          entity_type: "notification",
          details: notificationData.title
        });
      } else {
        const recipient = users.find(u => u.id === notificationData.recipient_id);
        await base44.entities.Notification.create({
          recipient_id: recipient.id,
          recipient_email: recipient.email,
          title: notificationData.title,
          message: notificationData.message,
          type: notificationData.type,
          is_read: false
        });
        
        await base44.entities.ActivityLog.create({
          user_email: currentUser.email,
          action: `Notificatie gestuurd naar ${recipient.full_name}`,
          entity_type: "notification",
          details: notificationData.title
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['sent-notifications'] });
      setShowSendDialog(false);
      setNewNotification({ recipient_id: "", title: "", message: "", type: "info" });
      alert('✅ Notificatie succesvol verzonden!');
    },
    onError: (error) => {
      alert('❌ Fout bij verzenden: ' + error.message);
    }
  });

  const acceptInviteMutation = useMutation({
    mutationFn: async (notification) => {
      if (!notification.team_invite_id) {
        throw new Error('Geen team uitnodiging ID gevonden');
      }

      // Get the invite
      const invites = await base44.entities.TeamInvite.filter({ id: notification.team_invite_id });
      if (invites.length === 0) {
        throw new Error('Uitnodiging niet gevonden');
      }

      const invite = invites[0];

      // Update invite status
      await base44.entities.TeamInvite.update(invite.id, {
        status: "accepted",
        accepted_at: new Date().toISOString()
      });

      // Get team
      const teams = await base44.entities.Team.filter({ id: invite.team_id });
      if (teams.length === 0) throw new Error("Team niet gevonden");
      
      const team = teams[0];
      const currentMembers = team.members || [];

      // Check if user is already in members array
      const currentUser = await base44.auth.me();
      const existingMemberIndex = currentMembers.findIndex(m => m.user_id === currentUser.id);
      
      let updatedMembers;
      if (existingMemberIndex !== -1) {
        // User already exists (was added as pending) - update status to active
        updatedMembers = currentMembers.map((m, index) => 
          index === existingMemberIndex 
            ? { ...m, status: "active" }
            : m
        );
      } else {
        // User doesn't exist yet - add new member with active status
        updatedMembers = [
          ...currentMembers,
          {
            user_id: currentUser.id,
            email: currentUser.email,
            team_role_id: invite.team_role_id,
            status: "active",
            joined_at: new Date().toISOString()
          }
        ];
      }

      await base44.entities.Team.update(team.id, { members: updatedMembers });

      // Mark notification as read
      await base44.entities.Notification.update(notification.id, { is_read: true });

      // Log activity
      await base44.entities.ActivityLog.create({
        user_email: currentUser.email,
        action: `Toegetreden tot team: ${team.name}`,
        entity_type: "team",
        entity_id: team.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team-invites'] });
      alert('✅ Uitnodiging geaccepteerd!');
    },
    onError: (error) => {
      alert('❌ Fout bij accepteren: ' + error.message);
    }
  });

  const declineInviteMutation = useMutation({
    mutationFn: async (notification) => {
      if (!notification.team_invite_id) {
        throw new Error('Geen team uitnodiging ID gevonden');
      }

      // Get the invite
      const invites = await base44.entities.TeamInvite.filter({ id: notification.team_invite_id });
      if (invites.length === 0) {
        throw new Error('Uitnodiging niet gevonden');
      }

      const invite = invites[0];

      // Update invite status
      await base44.entities.TeamInvite.update(invite.id, { status: "declined" });

      // Remove from team members if exists as pending
      const teams = await base44.entities.Team.filter({ id: invite.team_id });
      if (teams.length > 0) {
        const team = teams[0];
        const currentUser = await base44.auth.me();
        const updatedMembers = (team.members || []).filter(m => m.user_id !== currentUser.id);
        await base44.entities.Team.update(team.id, { members: updatedMembers });
      }

      // Mark notification as read
      await base44.entities.Notification.update(notification.id, { is_read: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team-invites'] });
      alert('✅ Uitnodiging geweigerd');
    },
    onError: (error) => {
      alert('❌ Fout bij weigeren: ' + error.message);
    }
  });

  const replyMutation = useMutation({
    mutationFn: async ({ notification, reply }) => {
      const currentUser = await base44.auth.me();
      
      const existingReplies = notification.replies || [];
      const newReply = {
        message: reply,
        sender_email: currentUser.email,
        sender_name: currentUser.full_name,
        created_at: new Date().toISOString()
      };
      
      await base44.entities.Notification.update(notification.id, { 
        replies: [...existingReplies, newReply],
        is_read: true 
      });

      const allUsers = await base44.entities.User.list();
      const sender = allUsers.find(u => u.email === notification.created_by);
      
      if (sender && sender.id !== currentUser.id) {
        await base44.entities.Notification.create({
          recipient_id: sender.id,
          recipient_email: sender.email,
          title: `Reactie op: ${notification.title}`,
          message: reply,
          type: "info",
          is_read: false,
          reply_to_notification_id: notification.id
        });

        await base44.entities.ActivityLog.create({
          user_email: currentUser.email,
          action: `Reactie gegeven op notificatie`,
          entity_type: "notification",
          details: notification.title
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['sent-notifications'] });
      setReplyingTo(null);
      setReplyText("");
    },
  });

  const handleReply = (notification) => {
    if (replyText.trim()) {
      replyMutation.mutate({ notification, reply: replyText });
    }
  };

  const handleSendNotification = () => {
    if (newNotification.recipient_id && newNotification.title && newNotification.message) {
      sendNotificationMutation.mutate(newNotification);
    }
  };

  const toggleReplies = (notificationId) => {
    setExpandedReplies(prev => ({
      ...prev,
      [notificationId]: !prev[notificationId]
    }));
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "team_invite":
        return <Users className="w-4 h-4 text-indigo-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const renderNotification = (notification, isOutbox = false) => {
    const isReply = notification.reply_to_notification_id;
    const isTeamInvite = notification.type === "team_invite";
    const replies = notification.replies || [];
    const hasReplies = replies.length > 0;
    const showReplies = expandedReplies[notification.id];
    
    return (
      <div 
        key={notification.id}
        className={`p-4 rounded-xl border transition-all duration-200 ${
          notification.is_read 
            ? "border-gray-100 bg-white" 
            : isTeamInvite
              ? "border-indigo-200 bg-indigo-50"
              : isReply
                ? "border-indigo-200 bg-indigo-50"
                : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {getTypeIcon(notification.type)}
            <h4 className="font-semibold text-gray-900">{notification.title}</h4>
          </div>
          <div className="flex items-center gap-2">
            {isOutbox && (
              <Badge variant="outline" className="text-xs">
                Verzonden
              </Badge>
            )}
            {isTeamInvite && !isOutbox && (
              <Badge className="bg-indigo-100 text-indigo-700">
                <Users className="w-3 h-3 mr-1" />
                Team Uitnodiging
              </Badge>
            )}
            {isReply && !isTeamInvite && (
              <Badge className="bg-indigo-100 text-indigo-700">
                <Reply className="w-3 h-3 mr-1" />
                Reactie
              </Badge>
            )}
            {!notification.is_read && !isOutbox && (
              <Badge variant="secondary" className="text-xs">Nieuw</Badge>
            )}
          </div>
        </div>
        
        <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
        
        {isOutbox && (
          <p className="text-xs text-gray-500 mb-2">
            Naar: {notification.recipient_email}
          </p>
        )}
        
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <span>{format(new Date(notification.created_date), "d MMM yyyy HH:mm", { locale: nl })}</span>
        </div>

        {hasReplies && (
          <div className="mt-3 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleReplies(notification.id)}
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 -ml-2"
            >
              {showReplies ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Verberg reacties ({replies.length})
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Bekijk reacties ({replies.length})
                </>
              )}
            </Button>

            {showReplies && (
              <div className="space-y-2 pl-4 border-l-2 border-indigo-200">
                {replies.map((reply, index) => (
                  <div key={index} className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-indigo-900">
                        {reply.sender_name || reply.sender_email}
                      </p>
                      <p className="text-xs text-indigo-600">
                        {format(new Date(reply.created_at), "d MMM HH:mm", { locale: nl })}
                      </p>
                    </div>
                    <p className="text-sm text-gray-700">{reply.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isOutbox && replyingTo === notification.id ? (
          <div className="mt-3 space-y-2">
            <Textarea
              placeholder="Typ je reactie..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={() => handleReply(notification)}
                disabled={!replyText.trim() || replyMutation.isPending}
              >
                <Send className="w-4 h-4 mr-2" />
                Verstuur
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => {
                  setReplyingTo(null);
                  setReplyText("");
                }}
              >
                Annuleer
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mt-3 flex-wrap">
            {isTeamInvite && !isOutbox && !notification.is_read && (
              <>
                <Button 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => acceptInviteMutation.mutate(notification)}
                  disabled={acceptInviteMutation.isPending}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accepteer Uitnodiging
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => declineInviteMutation.mutate(notification)}
                  disabled={declineInviteMutation.isPending}
                >
                  Weiger
                </Button>
              </>
            )}
            {!isOutbox && !notification.is_read && !isTeamInvite && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => markAsReadMutation.mutate(notification.id)}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Markeer gelezen
              </Button>
            )}
            {!isOutbox && !isReply && !isTeamInvite && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setReplyingTo(notification.id)}
              >
                <Reply className="w-4 h-4 mr-2" />
                Reageer
              </Button>
            )}
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => deleteMutation.mutate(notification.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="border-b border-gray-100 pb-4">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-600" />
          Notificaties
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white">
              {unreadCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs defaultValue="inbox" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="inbox" className="gap-2">
              <Inbox className="w-4 h-4" />
              Inbox ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="outbox" className="gap-2">
              <SendHorizontal className="w-4 h-4" />
              Verzonden
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="m-0">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Geen notificaties</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notifications.map((notification) => renderNotification(notification, false))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="outbox" className="m-0">
            <div className="mb-6">
              <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Nieuwe Notificatie Versturen
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Notificatie Versturen</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="recipient">Ontvanger *</Label>
                      <Select
                        value={newNotification.recipient_id}
                        onValueChange={(value) => setNewNotification({ ...newNotification, recipient_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer ontvanger" />
                        </SelectTrigger>
                        <SelectContent>
                          {isAdmin && (
                            <SelectItem value="all">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Alle Gebruikers
                              </div>
                            </SelectItem>
                          )}
                          {availableRecipients.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.full_name} ({user.email})
                              {user.role === "admin" && " - Admin"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        {isAdmin 
                          ? "Je kunt naar alle gebruikers of specifieke gebruikers sturen" 
                          : "Je kunt alleen naar admins sturen"}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="title">Titel *</Label>
                      <Input
                        id="title"
                        placeholder="Notificatie titel"
                        value={newNotification.title}
                        onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="message">Bericht *</Label>
                      <Textarea
                        id="message"
                        placeholder="Typ je bericht hier..."
                        value={newNotification.message}
                        onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label htmlFor="type">Type</Label>
                      <Select
                        value={newNotification.type}
                        onValueChange={(value) => setNewNotification({ ...newNotification, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">
                            <div className="flex items-center gap-2">
                              <Info className="w-4 h-4 text-blue-500" />
                              Info
                            </div>
                          </SelectItem>
                          <SelectItem value="success">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              Success
                            </div>
                          </SelectItem>
                          <SelectItem value="warning">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                              Waarschuwing
                            </div>
                          </SelectItem>
                          <SelectItem value="error">
                            <div className="flex items-center gap-2">
                              <XCircle className="w-4 h-4 text-red-500" />
                              Error
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleSendNotification}
                        disabled={!newNotification.recipient_id || !newNotification.title || !newNotification.message || sendNotificationMutation.isPending}
                        className="flex-1"
                      >
                        {sendNotificationMutation.isPending ? (
                          "Versturen..."
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Versturen
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setShowSendDialog(false)}
                      >
                        Annuleren
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {sentNotifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <SendHorizontal className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nog geen notificaties verzonden</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sentNotifications.map((notification) => renderNotification(notification, true))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
