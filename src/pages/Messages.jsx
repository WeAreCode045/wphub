
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  Send,
  Inbox,
  SendIcon,
  Users,
  Reply,
  Trash2,
  Forward,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  CornerDownRight
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import SendMessageDialog from "../components/messaging/SendMessageDialog";

export default function Messages() {
  const [user, setUser] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState("inbox");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showNewMessageDialog, setShowNewMessageDialog] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const isAdmin = user?.role === "admin";

  // Get all messages
  const { data: allMessages = [] } = useQuery({
    queryKey: ['all-messages', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.Message.list("-created_date");
    },
    enabled: !!user,
    initialData: [],
  });

  // Get user teams for inbox folders
  const { data: userTeams = [] } = useQuery({
    queryKey: ['user-teams', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const allTeams = await base44.entities.Team.list();
      return allTeams.filter(t => 
        t.owner_id === user.id || 
        t.members?.some(m => m.user_id === user.id && m.status === "active")
      );
    },
    enabled: !!user,
    initialData: [],
  });

  // Filter messages based on selected folder and expand replies
  const getMessagesForFolder = () => {
    if (!user) return [];

    let baseMessages = [];

    if (selectedFolder === "inbox") {
      // Personal inbox
      baseMessages = allMessages.filter(m => 
        m.recipient_id === user.id && 
        m.recipient_type === "user"
      );
    } else if (selectedFolder === "sent") {
      // Sent messages
      baseMessages = allMessages.filter(m => m.sender_id === user.id);
    } else {
      // Team inbox
      const teamId = selectedFolder.replace("team-", "");
      baseMessages = allMessages.filter(m => 
        m.recipient_type === "team" && 
        m.team_id === teamId
      );
    }

    // Expand replies as separate messages
    const expandedMessages = [];
    
    baseMessages.forEach(message => {
      // Add the original message
      expandedMessages.push({
        ...message,
        isReply: false,
        originalMessageId: message.id,
        displayId: message.id
      });

      // Add each reply as a separate message
      if (message.replies && message.replies.length > 0) {
        message.replies.forEach((reply, index) => {
          expandedMessages.push({
            id: `${message.id}-reply-${index}`,
            displayId: `${message.id}-reply-${index}`,
            subject: `RE: ${message.subject}`,
            message: reply.message,
            sender_id: reply.sender_id,
            sender_name: reply.sender_name,
            sender_email: reply.sender_email,
            recipient_id: message.sender_id, // Reply goes back to original sender
            recipient_email: message.sender_email,
            recipient_type: message.recipient_type,
            team_id: message.team_id,
            created_date: reply.created_at,
            priority: message.priority,
            category: message.category,
            is_read: message.is_read, // Use parent message read status
            isReply: true,
            replyIndex: index,
            originalMessageId: message.id,
            originalMessage: message,
            context: message.context
          });
        });
      }
    });

    return expandedMessages;
  };

  const folderMessages = getMessagesForFolder();

  // Sort messages
  const sortedMessages = [...folderMessages].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case "date":
        comparison = new Date(a.created_date) - new Date(b.created_date);
        break;
      case "sender":
        comparison = (a.sender_name || "").localeCompare(b.sender_name || "");
        break;
      case "priority":
        const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
        comparison = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
        break;
      default:
        break;
    }
    
    return sortOrder === "desc" ? -comparison : comparison;
  });

  const markAsReadMutation = useMutation({
    mutationFn: (messageId) => 
      base44.entities.Message.update(messageId, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-messages'] });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId) => base44.entities.Message.delete(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-messages'] });
      setSelectedMessage(null);
      alert('✅ Bericht verwijderd');
    },
  });

  const replyToMessageMutation = useMutation({
    mutationFn: async ({ messageId, replyText }) => {
      const message = allMessages.find(m => m.id === messageId);
      const replies = message.replies || [];
      replies.push({
        message: replyText,
        sender_id: user.id,
        sender_name: user.full_name,
        sender_email: user.email,
        created_at: new Date().toISOString()
      });
      
      // Mark message as unread to notify recipient of new reply
      return base44.entities.Message.update(messageId, { 
        replies,
        is_read: false // Mark as unread so recipient gets notified
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-messages'] });
      setReplyText("");
      alert('✅ Antwoord verzonden');
    },
  });

  const handleSelectMessage = (message) => {
    setSelectedMessage(message);
    
    // Mark the original message as read
    const originalMessageId = message.isReply ? message.originalMessageId : message.id;
    const originalMessage = allMessages.find(m => m.id === originalMessageId);
    
    if (originalMessage && !originalMessage.is_read && selectedFolder !== "sent") {
      markAsReadMutation.mutate(originalMessageId);
    }
  };

  const handleReply = () => {
    if (replyText.trim() && selectedMessage) {
      const originalMessageId = selectedMessage.isReply 
        ? selectedMessage.originalMessageId 
        : selectedMessage.id;
      
      replyToMessageMutation.mutate({ 
        messageId: originalMessageId, 
        replyText 
      });
    }
  };

  const handleDelete = () => {
    if (!selectedMessage) return;
    
    const originalMessageId = selectedMessage.isReply 
      ? selectedMessage.originalMessageId 
      : selectedMessage.id;
    
    if (confirm('Weet je zeker dat je dit bericht wilt verwijderen?')) {
      deleteMessageMutation.mutate(originalMessageId);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === "asc" ? "desc" : "asc");
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-gray-100 text-gray-700",
      normal: "bg-blue-100 text-blue-700",
      high: "bg-orange-100 text-orange-700",
      urgent: "bg-red-100 text-red-700"
    };
    return colors[priority] || colors.normal;
  };

  const getUnreadCount = (folder) => {
    if (!user) return 0;
    
    if (folder === "inbox") {
      // Count unread messages + messages with new replies (which also makes them unread)
      const unreadMessages = allMessages.filter(m => 
        m.recipient_id === user.id && 
        m.recipient_type === "user" && 
        !m.is_read
      );
      
      return unreadMessages.length;
    } else if (folder === "sent") {
      return 0;
    } else {
      const teamId = folder.replace("team-", "");
      const unreadTeamMessages = allMessages.filter(m => 
        m.recipient_type === "team" && 
        m.team_id === teamId && 
        !m.is_read
      );
      
      return unreadTeamMessages.length;
    }
  };

  // Check if a message has new replies (is unread and has replies)
  const hasNewReplies = (message) => {
    if (message.isReply) return false; // Replies themselves don't have "new reply" indicator
    
    const originalMessage = allMessages.find(m => m.id === message.id);
    if (!originalMessage) return false;
    
    return !originalMessage.is_read && 
           originalMessage.replies && 
           originalMessage.replies.length > 0;
  };

  // Get the full thread for display
  const getMessageThread = (message) => {
    if (!message) return null;

    const originalMessageId = message.isReply ? message.originalMessageId : message.id;
    const originalMessage = allMessages.find(m => m.id === originalMessageId);

    if (!originalMessage) return null;

    return {
      original: originalMessage,
      replies: originalMessage.replies || []
    };
  };

  const messageThread = getMessageThread(selectedMessage);

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4 p-6 md:p-8">
      {/* Left Sidebar - Folders (20%) */}
      <div className="w-1/5 min-w-[200px]">
        <Card className="border-none shadow-lg h-full">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Mappen</h2>
              <Button size="icon" variant="ghost" onClick={() => setShowNewMessageDialog(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedFolder("inbox")}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                  selectedFolder === "inbox" 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Inbox className="w-4 h-4" />
                  <span className="text-sm font-medium">Inbox</span>
                </div>
                {getUnreadCount("inbox") > 0 && (
                  <Badge className="bg-blue-500 text-white">
                    {getUnreadCount("inbox")}
                  </Badge>
                )}
              </button>
              
              <button
                onClick={() => setSelectedFolder("sent")}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                  selectedFolder === "sent" 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <SendIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">Verzonden</span>
                </div>
              </button>

              {userTeams.length > 0 && (
                <>
                  <div className="pt-4 pb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3">
                      Team Inboxes
                    </p>
                  </div>
                  {userTeams.map(team => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedFolder(`team-${team.id}`)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                        selectedFolder === `team-${team.id}` 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span className="text-sm font-medium truncate">{team.name}</span>
                      </div>
                      {getUnreadCount(`team-${team.id}`) > 0 && (
                        <Badge className="bg-emerald-500 text-white">
                          {getUnreadCount(`team-${team.id}`)}
                        </Badge>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle - Message List (20%) */}
      <div className="w-1/5 min-w-[250px]">
        <Card className="border-none shadow-lg h-full flex flex-col">
          <CardContent className="p-4 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h2 className="font-bold text-gray-900">Berichten</h2>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Datum</SelectItem>
                    <SelectItem value="sender">Afzender</SelectItem>
                    <SelectItem value="priority">Prioriteit</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={toggleSortOrder} className="h-8 w-8">
                  {sortOrder === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {sortedMessages.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Geen berichten</p>
                </div>
              ) : (
                sortedMessages.map((message) => {
                  const isUnread = !message.is_read && selectedFolder !== "sent";
                  const showNewReplyIndicator = hasNewReplies(message);
                  
                  return (
                    <div
                      key={message.displayId}
                      onClick={() => handleSelectMessage(message)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all relative ${
                        selectedMessage?.displayId === message.displayId
                          ? 'border-indigo-300 bg-indigo-50' 
                          : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                      } ${isUnread ? 'bg-blue-50' : ''} ${showNewReplyIndicator ? 'ring-2 ring-blue-400' : ''}`}
                    >
                      {showNewReplyIndicator && (
                        <div className="absolute -top-1 -right-1 flex items-center gap-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full shadow-lg">
                          <Reply className="w-3 h-3" />
                          <span className="font-semibold">Nieuw antwoord</span>
                        </div>
                      )}
                      
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          {message.isReply && (
                            <CornerDownRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          )}
                          <p className={`text-sm truncate flex-1 ${message.isReply ? 'text-gray-600' : 'font-semibold'}`}>
                            {message.subject}
                          </p>
                        </div>
                        {isUnread && !showNewReplyIndicator && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full ml-2 mt-1 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mb-1">
                        {selectedFolder === "sent" ? `Aan: ${message.recipient_email || "Team"}` : `Van: ${message.sender_name}`}
                      </p>
                      <p className="text-xs text-gray-500 mb-2">
                        {format(new Date(message.created_date), "d MMM HH:mm", { locale: nl })}
                      </p>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {message.message}
                      </p>
                      <div className="flex gap-1 mt-2">
                        <Badge className={`text-xs ${getPriorityColor(message.priority)}`}>
                          {message.priority}
                        </Badge>
                        {message.isReply && (
                          <Badge variant="outline" className="text-xs">
                            <Reply className="w-3 h-3 mr-1" />
                            Antwoord
                          </Badge>
                        )}
                        {!message.isReply && message.replies && message.replies.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {message.replies.length} {message.replies.length === 1 ? 'antwoord' : 'antwoorden'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right - Message Details (60%) */}
      <div className="flex-1">
        <Card className="border-none shadow-lg h-full">
          {messageThread ? (
            <div className="h-full flex flex-col">
              {/* Message Header */}
              <div className="border-b border-gray-100 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {messageThread.original.subject}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span className="font-medium">{messageThread.original.sender_name}</span>
                        <span className="text-gray-400">({messageThread.original.sender_email})</span>
                      </div>
                      <span>•</span>
                      <span>
                        {format(new Date(messageThread.original.created_date), "d MMMM yyyy HH:mm", { locale: nl })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getPriorityColor(messageThread.original.priority)}>
                      {messageThread.original.priority}
                    </Badge>
                    <Badge variant="outline">
                      {messageThread.original.category}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {selectedFolder !== "sent" && (
                    <Button size="sm" variant="outline" onClick={() => {}}>
                      <Reply className="w-4 h-4 mr-2" />
                      Antwoorden
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => {}}>
                    <Forward className="w-4 h-4 mr-2" />
                    Doorsturen
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleDelete}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Verwijderen
                  </Button>
                </div>
              </div>

              {/* Message Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Original Message */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <p className="whitespace-pre-wrap text-gray-800">
                    {messageThread.original.message}
                  </p>
                </div>

                {/* Replies */}
                {messageThread.replies.length > 0 && (
                  <div className="space-y-4 mb-6">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Reply className="w-4 h-4" />
                      Antwoorden ({messageThread.replies.length})
                    </h3>
                    {messageThread.replies.map((reply, idx) => (
                      <div key={idx} className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-semibold text-sm">{reply.sender_name}</p>
                          <span className="text-xs text-gray-500">
                            {format(new Date(reply.created_at), "d MMM yyyy HH:mm", { locale: nl })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {reply.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Form */}
                {selectedFolder !== "sent" && (
                  <div className="mt-6 border-t pt-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Antwoord schrijven</h3>
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Schrijf je antwoord..."
                      rows={6}
                      className="mb-3"
                    />
                    <Button 
                      onClick={handleReply}
                      disabled={!replyText.trim() || replyToMessageMutation.isPending}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {replyToMessageMutation.isPending ? "Versturen..." : "Verstuur Antwoord"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <CardContent className="p-12 text-center h-full flex items-center justify-center">
              <div>
                <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">Selecteer een bericht om te lezen</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* New Message Dialog */}
      <SendMessageDialog
        open={showNewMessageDialog}
        onOpenChange={setShowNewMessageDialog}
        user={user}
      />
    </div>
  );
}
