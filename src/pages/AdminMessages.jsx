
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Mail,
  Inbox,
  Send,
  Trash2,
  Reply,
  Search,
  Plus,
  Loader2,
  ShieldCheck,
  MessageSquare
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import SendMessageDialog from "../components/messaging/SendMessageDialog";
import { useUser } from "../Layout";
import { useToast } from "@/components/ui/use-toast";

export default function AdminMessages() {
  const user = useUser();
  const navigate = useNavigate();
  const [selectedFolder, setSelectedFolder] = useState("admin");
  const [selectedThread, setSelectedThread] = useState(null);
  const [sortBy, setSortBy] = useState("date-desc");
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [adminGlobalInboxId, setAdminGlobalInboxId] = useState(null);
  const [adminOutboxId, setAdminOutboxId] = useState(null);

  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate(createPageUrl("Dashboard"));
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user && user.role === "admin") {
      loadAdminMailboxes();
    }
  }, [user]);

  const loadAdminMailboxes = async () => {
    if (!user) return;

    const settings = await base44.entities.SiteSettings.list();
    const globalInboxId = settings.find(s => s.setting_key === 'admin_global_inbox_id')?.setting_value;
    setAdminGlobalInboxId(globalInboxId);

    const currentUser = await base44.entities.User.get(user.id);
    const adminOutbox = currentUser.mailboxes?.find(m => m.type === 'adminoutbox');
    setAdminOutboxId(adminOutbox?.id);
  };

  const { data: allMessages = [], isLoading } = useQuery({
    queryKey: ['admin-all-messages', adminGlobalInboxId],
    queryFn: async () => {
      if (!user || user.role !== 'admin' || !adminGlobalInboxId) return [];
      
      const messages = await base44.entities.Message.filter({
        to_mailbox_id: adminGlobalInboxId
      }, "-created_date");
      
      return messages;
    },
    enabled: !!user && user.role === "admin" && !!adminGlobalInboxId,
    staleTime: 0,
    initialData: [],
  });

  const markAsReadMutation = useMutation({
    mutationFn: (messageId) =>
      base44.entities.Message.update(messageId, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-messages'] });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId) => base44.entities.Message.delete(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-messages'] });
      setSelectedThread(null);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ messageId, status }) =>
      base44.entities.Message.update(messageId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-messages'] });
    },
  });

  const replyToMessageMutation = useMutation({
    mutationFn: async ({ originalMessage, replyText }) => {
      const response = await base44.functions.invoke('sendMessage', {
        subject: originalMessage.subject,
        message: replyText,
        to_user_id: originalMessage.sender_id,
        reply_to_message_id: originalMessage.id,
        thread_id: originalMessage.thread_id || originalMessage.id,
        is_admin_action: true,
        context: originalMessage.context || {}
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-messages'] });
      setReplyText("");
      toast({
        title: "Antwoord verzonden",
        description: "Je antwoord is succesvol verzonden als admin",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij verzenden",
        description: error.message,
      });
    }
  });

  const filteredMessages = allMessages.filter(message => {
    const matchesFolder = 
      selectedFolder === "admin" ? message.to_mailbox_id === adminGlobalInboxId :
      selectedFolder === "sent" ? message.from_mailbox_id === adminOutboxId :
      selectedFolder === "unread" ? !message.is_read :
      selectedFolder === "support" ? message.category === "support" :
      false;

    const matchesSearch = searchQuery === "" ||
      message.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.sender_name?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFolder && matchesSearch;
  });

  // Group messages by thread
  const threadMap = {};
  filteredMessages.forEach(msg => {
    const threadId = msg.thread_id || msg.id;
    if (!threadMap[threadId]) {
      threadMap[threadId] = [];
    }
    threadMap[threadId].push(msg);
  });

  const threads = Object.entries(threadMap).map(([threadId, messages]) => {
    const sortedMessages = messages.sort((a, b) => 
      new Date(b.created_date) - new Date(a.created_date)
    );
    return {
      threadId,
      messages: sortedMessages,
      latestMessage: sortedMessages[0],
      messageCount: messages.length,
      hasUnread: messages.some(m => !m.is_read)
    };
  });

  const sortedThreads = [...threads].sort((a, b) => {
    switch (sortBy) {
      case "date-desc":
        return new Date(b.latestMessage.created_date) - new Date(a.latestMessage.created_date);
      case "date-asc":
        return new Date(a.latestMessage.created_date) - new Date(a.latestMessage.created_date); // Bug: This should be `new Date(a.latestMessage.created_date) - new Date(b.latestMessage.created_date);`
      case "sender":
        return (a.latestMessage.sender_name || "").localeCompare(b.latestMessage.sender_name || "");
      case "priority":
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        return priorityOrder[a.latestMessage.priority] - priorityOrder[b.latestMessage.priority];
      default:
        return 0;
    }
  });

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: "bg-red-100 text-red-700",
      high: "bg-orange-100 text-orange-700",
      normal: "bg-blue-100 text-blue-700",
      low: "bg-gray-100 text-gray-700"
    };
    return colors[priority] || colors.normal;
  };

  const getUnreadCount = (folder) => {
    if (folder === "admin") return allMessages.filter(m => !m.is_read && m.to_mailbox_id === adminGlobalInboxId).length;
    if (folder === "sent") return 0;
    if (folder === "support") return allMessages.filter(m => !m.is_read && m.category === "support").length;
    if (folder === "unread") return allMessages.filter(m => !m.is_read).length;
    return 0;
  };

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

  if (!user || user.role !== "admin") {
    return null;
  }

  if (!adminGlobalInboxId) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Inbox</h1>
            <p className="text-gray-600">Berichten gericht aan platform admins</p>
          </div>
          <Button
            onClick={() => setShowSendDialog(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Admin Bericht Verzenden
          </Button>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-2">
            <Card className="border-none shadow-md">
              <CardContent className="p-4 space-y-1">
                <button
                  onClick={() => setSelectedFolder("admin")}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    selectedFolder === "admin"
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5" />
                    <span>Admin Inbox</span>
                  </div>
                  {getUnreadCount("admin") > 0 && (
                    <Badge className="bg-red-500 text-white text-xs">
                      {getUnreadCount("admin")}
                    </Badge>
                  )}
                </button>

                <button
                  onClick={() => setSelectedFolder("sent")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    selectedFolder === "sent"
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Send className="w-5 h-5" />
                  <span>Verzonden (Admin)</span>
                </button>

                <button
                  onClick={() => setSelectedFolder("unread")}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    selectedFolder === "unread"
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5" />
                    <span>Ongelezen</span>
                  </div>
                  {getUnreadCount("unread") > 0 && (
                    <Badge className="bg-red-500 text-white text-xs">
                      {getUnreadCount("unread")}
                    </Badge>
                  )}
                </button>

                <button
                  onClick={() => setSelectedFolder("support")}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    selectedFolder === "support"
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5" />
                    <span>Support</span>
                  </div>
                  {getUnreadCount("support") > 0 && (
                    <Badge className="bg-red-500 text-white text-xs">
                      {getUnreadCount("support")}
                    </Badge>
                  )}
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Thread List */}
          <div className="lg:col-span-4 space-y-3">
            <Card className="border-none shadow-md">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Zoek berichten..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-desc">Nieuwste eerst</SelectItem>
                      <SelectItem value="date-asc">Oudste eerst</SelectItem>
                      <SelectItem value="sender">Op afzender</SelectItem>
                      <SelectItem value="priority">Op prioriteit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
              {isLoading ? (
                <Card className="border-none shadow-md">
                  <CardContent className="p-8 text-center">
                    <Loader2 className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-spin" />
                    <p className="text-gray-500">Berichten laden...</p>
                  </CardContent>
                </Card>
              ) : sortedThreads.length === 0 ? (
                <Card className="border-none shadow-md">
                  <CardContent className="p-8 text-center">
                    <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Geen berichten gevonden</p>
                  </CardContent>
                </Card>
              ) : (
                sortedThreads.map((thread) => {
                  const msg = thread.latestMessage;
                  return (
                    <Card
                      key={thread.threadId}
                      className={`border-none shadow-md cursor-pointer transition-all ${
                        selectedThread?.threadId === thread.threadId
                          ? 'ring-2 ring-indigo-500 shadow-lg'
                          : 'hover:shadow-lg'
                      } ${thread.hasUnread ? 'bg-purple-50' : ''}`}
                      onClick={() => handleThreadClick(thread)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-10 h-10 border-2 border-gray-200">
                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white text-xs font-semibold">
                              {getInitials(msg.sender_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className={`text-sm ${thread.hasUnread ? 'font-bold' : 'font-medium'} text-gray-900 truncate`}>
                                {msg.subject}
                              </p>
                              {thread.messageCount > 1 && (
                                <Badge className="bg-purple-500 text-white text-xs ml-2">
                                  <MessageSquare className="w-3 h-3 mr-1" />
                                  {thread.messageCount}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mb-1">
                              Van: {msg.sender_name}
                            </p>
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {msg.message.split('\n\n--- Origineel bericht ---')[0]}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <p className="text-xs text-gray-400">
                                {format(new Date(msg.created_date), "d MMM HH:mm", { locale: nl })}
                              </p>
                              <Badge className={`${getPriorityColor(msg.priority)} text-xs`}>
                                {msg.priority}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {msg.category}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Thread Detail */}
          <div className="lg:col-span-5">
            {selectedThread ? (
              <Card className="border-none shadow-lg">
                <CardContent className="p-6">
                  <div className="space-y-4 mb-6 max-h-[calc(100vh-400px)] overflow-y-auto">
                    {selectedThread.messages
                      .slice() // Use slice to create a shallow copy before sorting, preventing direct mutation of state.
                      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                      .map((msg, idx) => {
                        const isFirstMessage = idx === selectedThread.messages.length - 1;
                        return (
                          <div 
                            key={msg.id}
                            className={`p-4 rounded-lg ${isFirstMessage ? 'bg-purple-50 border-2 border-purple-200' : 'bg-white border border-gray-200'}`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-10 h-10 border-2 border-gray-200">
                                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white font-semibold text-xs">
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
                              {isFirstMessage && (
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

                            <div className="mb-3">
                              <p className="font-semibold text-gray-900 text-sm">{msg.subject}</p>
                            </div>

                            <div className="prose prose-sm max-w-none">
                              <p className="text-gray-700 text-sm whitespace-pre-wrap">
                                {msg.message.split('\n\n--- Origineel bericht ---')[0]}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 mt-3">
                              <Badge className={`${getPriorityColor(msg.priority)}`}>
                                {msg.priority}
                              </Badge>
                              <Badge variant="outline">{msg.category}</Badge>
                              <Select 
                                value={msg.status} 
                                onValueChange={(value) => updateStatusMutation.mutate({ messageId: msg.id, status: value })}
                              >
                                <SelectTrigger className="w-32 h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open">Open</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="resolved">Opgelost</SelectItem>
                                  <SelectItem value="closed">Gesloten</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    <Label htmlFor="reply">Admin Antwoord Versturen</Label>
                    <Textarea
                      id="reply"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Schrijf je antwoord..."
                      rows={4}
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
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                    >
                      {replyToMessageMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Versturen...
                        </>
                      ) : (
                        <>
                          <Reply className="w-4 h-4 mr-2" />
                          Admin Antwoord Versturen
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-none shadow-md">
                <CardContent className="p-12 text-center">
                  <ShieldCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Selecteer een conversatie
                  </h3>
                  <p className="text-gray-600">
                    Kies een conversatie uit de lijst om de berichten te bekijken
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <SendMessageDialog
          open={showSendDialog}
          onOpenChange={setShowSendDialog}
          user={user}
          isAdminAction={true}
        />
      </div>
    </div>
  );
}
