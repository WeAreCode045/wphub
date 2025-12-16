import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, User, Users, Inbox, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function SendMessageDialog({ 
  open, 
  onOpenChange,
  // Context-based props
  toUserId,
  toUserName,
  toTeamId,
  toTeamName,
  toTeamMemberId,
  toTeamMemberName,
  isTeamInbox,
  isProjectInbox,
  projectId,
  projectName,
  context,
  // NEW: indicates if this is an admin action
  isAdminAction = false
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const sendMessageMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('sendMessage', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['user-messages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-messages'] });
      queryClient.invalidateQueries({ queryKey: ['header-messages'] });
      toast({
        title: "Bericht verzonden",
        description: "Je bericht is succesvol verzonden",
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij verzenden",
        description: error.response?.data?.error || "Er is iets misgegaan",
      });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!subject.trim() || !message.trim()) {
      toast({
        variant: "destructive",
        title: "Velden vereist",
        description: "Vul zowel onderwerp als bericht in",
      });
      return;
    }

    const messageData = {
      subject,
      message,
      context: context || {},
      to_user_id: toUserId,
      to_team_id: toTeamId,
      to_team_member_id: toTeamMemberId,
      is_team_inbox: isTeamInbox,
      is_project_inbox: isProjectInbox,
      project_id: projectId,
      is_admin_action: isAdminAction // Pass admin action flag
    };

    sendMessageMutation.mutate(messageData);
  };

  const handleClose = () => {
    setSubject("");
    setMessage("");
    onOpenChange(false);
  };

  // Determine recipient display
  const getRecipientDisplay = () => {
    if (isTeamInbox && toTeamName) {
      return {
        icon: Inbox,
        label: "Team Inbox",
        name: toTeamName
      };
    }
    if (isProjectInbox && projectName) {
      return {
        icon: Inbox,
        label: "Project Inbox",
        name: projectName
      };
    }
    if (toTeamMemberId && toTeamMemberName) {
      return {
        icon: User,
        label: "Teamlid",
        name: toTeamMemberName
      };
    }
    if (toUserId && toUserName && toTeamName) {
      return {
        icon: Users,
        label: "Team Eigenaar",
        name: `${toUserName} (${toTeamName})`
      };
    }
    if (toUserId && toUserName) {
      return {
        icon: User,
        label: "Gebruiker",
        name: toUserName
      };
    }
    return {
      icon: User,
      label: "Ontvanger",
      name: "Onbekend"
    };
  };

  const recipient = getRecipientDisplay();
  const RecipientIcon = recipient.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAdminAction ? (
              <>
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <span>Admin Bericht Verzenden</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5 text-indigo-600" />
                <span>Nieuw Bericht</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient Display */}
          <div className={`rounded-lg p-4 border ${isAdminAction ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
            <Label className="text-xs text-gray-500 mb-2 block">{recipient.label}</Label>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAdminAction ? 'bg-gradient-to-br from-purple-500 to-pink-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                <RecipientIcon className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900">{recipient.name}</span>
            </div>
            {isAdminAction && (
              <p className="text-xs text-purple-700 mt-2 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Dit bericht wordt verzonden als admin actie
              </p>
            )}
          </div>

          {/* Subject */}
          <div>
            <Label htmlFor="subject">Onderwerp</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Onderwerp van het bericht"
              required
            />
          </div>

          {/* Message */}
          <div>
            <Label htmlFor="message">Bericht</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Typ je bericht hier..."
              rows={8}
              required
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={sendMessageMutation.isPending}
            >
              Annuleren
            </Button>
            <Button
              type="submit"
              disabled={sendMessageMutation.isPending}
              className={isAdminAction 
                ? "bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
              }
            >
              {sendMessageMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verzenden...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Verzenden
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}