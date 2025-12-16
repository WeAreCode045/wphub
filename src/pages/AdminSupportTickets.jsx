import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Ticket,
  Search,
  Loader2,
  Send,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Filter,
  Mail,
  User
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function AdminSupportTickets() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: allTickets = [], isLoading } = useQuery({
    queryKey: ['all-support-tickets'],
    queryFn: async () => {
      return base44.entities.SupportTicket.list("-created_date");
    },
    initialData: [],
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, updates }) => {
      return base44.entities.SupportTicket.update(ticketId, {
        ...updates,
        last_updated: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-support-tickets'] });
    },
  });

  const addAdminResponseMutation = useMutation({
    mutationFn: async ({ ticketId, message }) => {
      const ticket = allTickets.find(t => t.id === ticketId);
      const responses = ticket.responses || [];
      
      responses.push({
        message,
        responder_email: user.email,
        responder_name: user.full_name,
        is_admin: true,
        created_at: new Date().toISOString()
      });

      return base44.entities.SupportTicket.update(ticketId, {
        responses,
        status: 'waiting_response',
        last_updated: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-support-tickets'] });
      setReplyText("");
    },
  });

  const getStatusColor = (status) => {
    const colors = {
      open: "bg-blue-100 text-blue-700",
      in_progress: "bg-yellow-100 text-yellow-700",
      waiting_response: "bg-orange-100 text-orange-700",
      resolved: "bg-green-100 text-green-700",
      closed: "bg-gray-100 text-gray-700"
    };
    return colors[status] || colors.open;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-gray-100 text-gray-700",
      medium: "bg-blue-100 text-blue-700",
      high: "bg-orange-100 text-orange-700",
      urgent: "bg-red-100 text-red-700"
    };
    return colors[priority] || colors.medium;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      sites: "Sites",
      plugins: "Plugins",
      teams: "Teams",
      projects: "Projecten",
      subscriptions: "Abonnementen",
      account: "Account",
      technical: "Technisch",
      other: "Overig"
    };
    return labels[category] || category;
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const filteredTickets = allTickets.filter(ticket => {
    const matchesSearch = 
      ticket.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticket_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.submitter_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const stats = {
    total: allTickets.length,
    open: allTickets.filter(t => t.status === 'open').length,
    inProgress: allTickets.filter(t => t.status === 'in_progress').length,
    waiting: allTickets.filter(t => t.status === 'waiting_response').length,
    resolved: allTickets.filter(t => t.status === 'resolved').length
  };

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Support Ticket Beheer</h1>
          <p className="text-gray-600">Beheer alle support tickets van gebruikers</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-5 gap-4 mb-6">
          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Totaal</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <Ticket className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Open</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">In Behandeling</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Wacht op Antwoord</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.waiting}</p>
                </div>
                <Mail className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Opgelost</p>
                  <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-none shadow-md mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Zoek tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Statussen</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Behandeling</SelectItem>
                  <SelectItem value="waiting_response">Wacht op Antwoord</SelectItem>
                  <SelectItem value="resolved">Opgelost</SelectItem>
                  <SelectItem value="closed">Gesloten</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Prioriteit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Prioriteiten</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">Hoog</SelectItem>
                  <SelectItem value="medium">Normaal</SelectItem>
                  <SelectItem value="low">Laag</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle>Support Tickets ({filteredTickets.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-12">
                <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Geen tickets gevonden</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className="border border-gray-200 cursor-pointer hover:border-purple-200 transition-all"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {ticket.ticket_number}
                            </Badge>
                            <Badge className={getStatusColor(ticket.status)}>
                              {ticket.status.replace('_', ' ')}
                            </Badge>
                            <Badge className={getPriorityColor(ticket.priority)}>
                              {ticket.priority}
                            </Badge>
                            <Badge variant="outline">{getCategoryLabel(ticket.category)}</Badge>
                          </div>
                          <h3 className="font-semibold text-gray-900 mb-1">{ticket.subject}</h3>
                          <p className="text-sm text-gray-600 line-clamp-1 mb-2">{ticket.description}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <User className="w-3 h-3" />
                            <span>{ticket.submitter_name}</span>
                            <span>•</span>
                            <span>{format(new Date(ticket.created_date), "d MMM yyyy HH:mm", { locale: nl })}</span>
                            {ticket.responses && ticket.responses.length > 0 && (
                              <>
                                <span>•</span>
                                <span>{ticket.responses.length} antwoord(en)</span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ticket Detail Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle className="flex-1">Ticket #{selectedTicket?.ticket_number}</DialogTitle>
                <Select
                  value={selectedTicket?.status}
                  onValueChange={(value) => {
                    updateTicketMutation.mutate({
                      ticketId: selectedTicket.id,
                      updates: { status: value }
                    });
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Behandeling</SelectItem>
                    <SelectItem value="waiting_response">Wacht op Antwoord</SelectItem>
                    <SelectItem value="resolved">Opgelost</SelectItem>
                    <SelectItem value="closed">Gesloten</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DialogHeader>
            {selectedTicket && (
              <div className="space-y-6 mt-4">
                {/* Ticket Info */}
                <Card className="border-purple-200 bg-purple-50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border-2 border-gray-200">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-semibold">
                            {getInitials(selectedTicket.submitter_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-gray-900">{selectedTicket.submitter_name}</p>
                          <p className="text-xs text-gray-600">{selectedTicket.submitter_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getPriorityColor(selectedTicket.priority)}>
                          {selectedTicket.priority}
                        </Badge>
                        <Select
                          value={selectedTicket.priority}
                          onValueChange={(value) => {
                            updateTicketMutation.mutate({
                              ticketId: selectedTicket.id,
                              updates: { priority: value }
                            });
                          }}
                        >
                          <SelectTrigger className="w-32 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Laag</SelectItem>
                            <SelectItem value="medium">Normaal</SelectItem>
                            <SelectItem value="high">Hoog</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{selectedTicket.subject}</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-3 pt-3 border-t border-purple-200">
                      <Badge variant="outline">{getCategoryLabel(selectedTicket.category)}</Badge>
                      <span className="ml-auto">
                        {format(new Date(selectedTicket.created_date), "d MMM yyyy HH:mm", { locale: nl })}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Responses */}
                {selectedTicket.responses && selectedTicket.responses.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900">Conversatie</h4>
                    {selectedTicket.responses.map((response, idx) => (
                      <Card key={idx} className={`border ${response.is_admin ? 'border-purple-200 bg-purple-50' : 'border-gray-200'}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="w-8 h-8 border-2 border-gray-200">
                              <AvatarFallback className={response.is_admin ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'}>
                                {getInitials(response.responder_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-sm">{response.responder_name}</p>
                                {response.is_admin && (
                                  <Badge className="bg-purple-100 text-purple-700 text-xs">Support Team</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{response.message}</p>
                              <p className="text-xs text-gray-500 mt-2">
                                {format(new Date(response.created_at), "d MMM yyyy 'om' HH:mm", { locale: nl })}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Admin Reply Form */}
                {selectedTicket.status !== 'closed' && (
                  <div className="space-y-3">
                    <Label htmlFor="admin-reply">Admin Antwoord</Label>
                    <Textarea
                      id="admin-reply"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Schrijf je antwoord aan de gebruiker..."
                      rows={4}
                    />
                    <Button
                      onClick={() => {
                        if (replyText.trim()) {
                          addAdminResponseMutation.mutate({
                            ticketId: selectedTicket.id,
                            message: replyText
                          });
                        }
                      }}
                      disabled={!replyText.trim() || addAdminResponseMutation.isPending}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                    >
                      {addAdminResponseMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Versturen...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Verstuur Admin Antwoord
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}