import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Inbox,
  Mail,
  MessageSquare,
  Reply,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function ProjectInboxPopover({ 
  projectId, 
  projectName, 
  unreadCount,
  canDelete = false 
}) {
  const [open, setOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState(null);
  const [replyText, setReplyText] = useState("");
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await base44.entities.Project.filter({ id: projectId });
      return projects[0] || null;
    },
    enabled: !!projectId && open,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['project-inbox-messages', projectId],
    queryFn: async () => {
      if (!project?.inbox_id) return [];
      return base44.entities.Message.filter({
        to_mailbox_id: project.inbox_id
      }, "-created_date");
    },
    enabled: !!project?.inbox_id && open,
    initialData: [],
  });

  const markAsReadMutation = useMutation({
    mutationFn: (messageId) =>
      base44.entities.Message.update(messageId, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-inbox-messages'] });
      queryClient.invalidateQueries({ queryKey: ['user-messages'] });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId) => base44.entities.Message.delete(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-inbox-messages'] });
      queryClient.invalidateQueries({ queryKey: ['user-messages'] });
      setSelectedThread(null);
    },
  });

  const replyToMessageMutation = useMutation({
    mutationFn: async ({ originalMessage, replyText }) => {
      const isReplyToAdmin = originalMessage.from_admin_outbox;
      
      const response = await base44.functions.invoke('sendMessage', {
        subject: originalMessage.subject,
        message: replyText,
        to_user_id: isReplyToAdmin ? null : originalMessage.sender_id,
        to_platform_admin: isReplyToAdmin,
        reply_to_message_id: originalMessage.id,
        thread_id: originalMessage.thread_id || originalMessage.id,
        context: originalMessage.context || {}
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-inbox-messages'] });
      queryClient.invalidateQueries({ queryKey: ['user-messages'] });
      setReplyText("");
    },
  });

  // Group messages by thread
  const threadMap = {};
  messages.forEach(msg => {
    const threadId = msg.thread_id || msg.id;
    if (!threadMap[threadId]) {
      threadMap[threadId] = [];
    }
    threadMap[threadId].push(msg);
  });

  const threads = Object.entries(threadMap).map(([threadId, msgs]) => {
    const sortedMessages = msgs.sort((a, b) => 
      new Date(b.created_date) - new Date(a.created_date)
    );
    return {
      threadId,
      messages: sortedMessages,
      latestMessage: sortedMessages[0],
      messageCount: msgs.length,
      hasUnread: msgs.some(m => !m.is_read)
    };
  });

  const sortedThreads = [...threads].sort((a, b) => 
    new Date(b.latestMessage.created_date) - new Date(a.latestMessage.created_date)
  );

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleThreadClick = (thread) => {
    setSelectedThread(thread);
    thread.messages.forEach(msg => {
      if (!msg.is_read) {
        markAsReadMutation.mutate(msg.id);
      }
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Inbox className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-blue-500 text-white text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-0" align="end">
        {!selectedThread ? (
          <>
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Project Inbox - {projectName}</h3>
              <p className="text-xs text-gray-500 mt-1">{unreadCount} ongelezen</p>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="p-2">
                {sortedThreads.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Geen berichten</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {sortedThreads.map((thread) => {
                      const msg = thread.latestMessage;
                      return (
                        <div
                          key={thread.threadId}
                          className={`p-3 rounded-lg transition-colors cursor-pointer ${
                            thread.hasUnread ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-gray-50'
                          }`}
                          onClick={() => handleThreadClick(thread)}
                        >
                          <div className="flex items-start gap-2">
                            <Avatar className="w-8 h-8 border-2 border-gray-200">
                              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-semibold">
                                {getInitials(msg.sender_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className={`text-sm ${thread.hasUnread ? 'font-bold' : 'font-medium'} text-gray-900 truncate`}>
                                  {msg.subject}
                                </p>
                                {thread.messageCount > 1 && (
                                  <Badge className="bg-blue-500 text-white text-xs">
                                    <MessageSquare className="w-3 h-3 mr-1" />
                                    {thread.messageCount}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 flex items-center gap-1">
                                Van: {msg.sender_name}
                                {msg.from_admin_outbox && (
                                  <Badge className="bg-purple-100 text-purple-700 text-xs py-0 px-1">
                                    Admin
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 line-clamp-1 mt-1">
                                {msg.message.split('\n\n--- Origineel bericht ---')[0]}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {format(new Date(msg.created_date), "d MMM HH:mm", { locale: nl })}
                              </p>
                            </div>
                            {!msg.is_read && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <>
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedThread(null);
                  setReplyText("");
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Terug
              </Button>
              <h3 className="font-semibold text-gray-900 flex-1">{selectedThread.latestMessage.subject}</h3>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-4">
                {selectedThread.messages
                  .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                  .map((msg, idx) => {
                    const isFirstMessage = idx === selectedThread.messages.length - 1;
                    return (
                      <div 
                        key={msg.id}
                        className={`p-4 rounded-lg ${isFirstMessage ? 'bg-blue-50 border-2 border-blue-200' : 'bg-white border border-gray-200'}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8 border-2 border-gray-200">
                              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-xs">
                                {getInitials(msg.sender_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900 text-sm">{msg.sender_name}</p>
                                {msg.from_admin_outbox && (
                                  <Badge className="bg-purple-100 text-purple-700 text-xs py-0 px-1.5">
                                    <ShieldCheck className="w-3 h-3 mr-1" />
                                    Admin
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">{msg.sender_email}</p>
                              <p className="text-xs text-gray-400">
                                {format(new Date(msg.created_date), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
                              </p>
                            </div>
                          </div>
                          {isFirstMessage && canDelete && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm("Weet je zeker dat je deze conversatie wilt verwijderen?")) {
                                  selectedThread.messages.forEach(m => {
                                    deleteMessageMutation.mutate(m.id);
                                  });
                                }
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        <div className="prose prose-sm max-w-none">
                          <p className="text-gray-700 text-sm whitespace-pre-wrap">
                            {msg.message.split('\n\n--- Origineel bericht ---')[0]}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                {/* Reply Form */}
                <div className="space-y-3 pt-4 border-t mt-4">
                  <Label htmlFor="project-reply">Antwoord versturen</Label>
                  <Textarea
                    id="project-reply"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Schrijf je antwoord..."
                    rows={3}
                  />
                  <Button
                    onClick={() => {
                      if (replyText.trim()) {
                        replyToMessageMutation.mutate({
                          originalMessage: selectedThread.latestMessage,
                          replyText
                        });
                      }
                    }}
                    disabled={!replyText.trim() || replyToMessageMutation.isPending}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                    size="sm"
                  >
                    {replyToMessageMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Versturen...
                      </>
                    ) : (
                      <>
                        <Reply className="w-4 h-4 mr-2" />
                        Antwoord Versturen
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}