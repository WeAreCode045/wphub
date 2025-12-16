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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  HelpCircle,
  Search,
  Plus,
  MessageCircle,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  Loader2,
  ChevronRight,
  Ticket,
  BookOpen,
  FileText,
  Paperclip
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const KNOWLEDGE_BASE = {
  sites: {
    title: "Sites",
    icon: "🌐",
    questions: [
      {
        q: "Hoe voeg ik een nieuwe WordPress site toe?",
        a: "Ga naar de Sites pagina en klik op 'Nieuwe Site'. Vul de site naam en URL in. Je ontvangt een API key die je moet gebruiken in de Connector plugin op je WordPress site."
      },
      {
        q: "Wat is de Connector plugin en hoe installeer ik deze?",
        a: "De Connector plugin is een speciale WordPress plugin die communicatie mogelijk maakt tussen je site en het platform. Download de plugin via de knop in de sidebar, installeer deze op je WordPress site en activeer deze met de API key."
      },
      {
        q: "Hoe test ik of mijn site correct is verbonden?",
        a: "Op de Site Detail pagina vind je een 'Test Verbinding' knop. Klik hierop om de connectie te controleren. Je ziet dan de WordPress versie en aantal geïnstalleerde plugins als de verbinding werkt."
      },
      {
        q: "Wat zijn Health Checks en hoe werken ze?",
        a: "Health Checks monitoren je site op uptime, performance, security en beschikbare updates. Klik op 'Health Check Uitvoeren' op de Site Detail pagina om een scan te starten. Je krijgt inzicht in SSL certificaten, kwetsbaarheden en beschikbare updates."
      },
      {
        q: "Hoe draag ik een site over naar een andere gebruiker?",
        a: "Als site eigenaar kun je via de Site Detail pagina op 'Eigendom Overdragen' klikken. Selecteer de nieuwe eigenaar (gebruiker of team) en bevestig de overdracht. De nieuwe eigenaar krijgt alle rechten over de site."
      },
      {
        q: "Wat zijn Debug instellingen?",
        a: "Debug instellingen (WP_DEBUG, WP_DEBUG_LOG, WP_DEBUG_DISPLAY) helpen bij het opsporen van fouten. Let op: schakel deze alleen in tijdens development, niet op productie sites."
      }
    ]
  },
  plugins: {
    title: "Plugins",
    icon: "📦",
    questions: [
      {
        q: "Hoe upload ik mijn eigen plugin?",
        a: "Ga naar Plugins en klik op 'Plugin Toevoegen'. Kies 'Upload ZIP', vul de plugin details in en selecteer het ZIP bestand. Na upload kun je verschillende versies beheren."
      },
      {
        q: "Hoe voeg ik een plugin uit de WordPress library toe?",
        a: "Klik op 'Plugin Toevoegen' en kies 'WordPress Library'. Zoek naar de gewenste plugin, bekijk de details en klik op 'Toevoegen aan Library'. De plugin wordt toegevoegd aan je library maar nog niet geïnstalleerd."
      },
      {
        q: "Hoe installeer ik een plugin op een site?",
        a: "Ga naar de Plugin Detail pagina. Bij 'Beschikbaar voor Sites' zie je je sites. Klik op 'Installeren' bij de gewenste site. De plugin wordt automatisch geïnstalleerd en geactiveerd."
      },
      {
        q: "Wat is het verschil tussen uploaden en toevoegen uit de library?",
        a: "Uploaden is voor je eigen custom plugins (ZIP bestanden). Toevoegen uit de library is voor publieke WordPress plugins. Beide worden toegevoegd aan je library en kunnen op sites worden geïnstalleerd."
      },
      {
        q: "Hoe update ik een plugin naar een nieuwe versie?",
        a: "Op de Plugin Detail pagina kun je nieuwe versies uploaden. Voor geïnstalleerde plugins zie je een 'Update' knop als er een nieuwere versie beschikbaar is."
      },
      {
        q: "Kan ik plugins delen met mijn team?",
        a: "Ja! Op de Plugin Detail pagina klik je op 'Delen met Teams'. Selecteer de teams waarmee je de plugin wilt delen. Teamleden kunnen de plugin dan gebruiken op hun sites."
      }
    ]
  },
  teams: {
    title: "Teams",
    icon: "👥",
    questions: [
      {
        q: "Hoe maak ik een nieuw team aan?",
        a: "Ga naar de Teams pagina en klik op 'Nieuw Team'. Vul de team naam en optionele beschrijving in. Je wordt automatisch de owner van het team."
      },
      {
        q: "Hoe nodig ik teamleden uit?",
        a: "Open je team en klik op 'Lid Uitnodigen'. Vul het email adres in en selecteer een rol (Owner, Admin, Manager of Member). De persoon ontvangt een uitnodiging in zijn notifications."
      },
      {
        q: "Wat zijn team rollen en hoe werk ik ermee?",
        a: "Team rollen bepalen wat leden kunnen doen. Owner heeft volledige rechten, Admin kan bijna alles, Manager kan meeste dingen beheren, en Member heeft basis rechten. Je kunt ook custom rollen maken met specifieke permissies."
      },
      {
        q: "Hoe deel ik sites en plugins met mijn team?",
        a: "Bij Sites en Plugins vind je een 'Delen met Teams' optie. Selecteer je team en de resource wordt gedeeld. Teamleden kunnen deze dan gebruiken volgens hun permissies."
      },
      {
        q: "Wat is een Team Inbox?",
        a: "Elke team heeft een eigen inbox voor communicatie. Stuur berichten naar de team inbox via de Team Detail pagina. Alle teamleden met inbox permissies kunnen deze berichten zien en beantwoorden."
      },
      {
        q: "Hoe maak ik custom rollen aan?",
        a: "Op de Team Detail pagina ga je naar 'Team Rollen'. Klik op 'Nieuwe Rol' en stel de gewenste permissies in voor sites, plugins, leden, notificaties en projecten."
      }
    ]
  },
  projects: {
    title: "Projecten",
    icon: "📋",
    questions: [
      {
        q: "Wat zijn projecten en hoe gebruik ik ze?",
        a: "Projecten helpen je werk te organiseren binnen teams. Koppel een project aan een team en site, wijs leden toe en volg voortgang via tijdlijnen en statussen."
      },
      {
        q: "Hoe maak ik een nieuw project aan?",
        a: "Ga naar Projecten en klik op 'Nieuw Project'. Selecteer het team en de primaire site, vul details in en wijs optioneel al teamleden toe."
      },
      {
        q: "Wat is een Project Inbox?",
        a: "Elk project heeft een eigen inbox voor project-specifieke communicatie. Berichten hier zijn alleen zichtbaar voor project leden."
      },
      {
        q: "Hoe gebruik ik project templates?",
        a: "Project templates bevatten vooraf gedefinieerde plugins en instellingen. Bij het aanmaken van een project kun je een template selecteren om snel te starten."
      },
      {
        q: "Hoe volg ik project voortgang?",
        a: "Op de Project Detail pagina vind je de Timeline tab. Hier kun je mijlpalen toevoegen met datums en status. Ook zie je toegewezen leden en gekoppelde plugins."
      }
    ]
  },
  subscriptions: {
    title: "Abonnementen",
    icon: "💳",
    questions: [
      {
        q: "Welke abonnementen zijn er beschikbaar?",
        a: "We hebben verschillende plannen voor individuen en teams. Elk plan heeft limieten voor aantal sites, plugins, teams en projecten. Bekijk de Pricing pagina voor details."
      },
      {
        q: "Hoe upgrade ik mijn abonnement?",
        a: "Ga naar 'Mijn Abonnement' en bekijk beschikbare plannen. Klik op 'Upgraden' bij het gewenste plan. De upgrade gaat direct in en je betaalt pro-rata."
      },
      {
        q: "Kan ik downgraden naar een lager plan?",
        a: "Ja, maar alleen als je huidige gebruik binnen de limieten van het lagere plan valt. Het systeem controleert dit automatisch bij een downgrade poging."
      },
      {
        q: "Wat gebeurt er als ik mijn limiet bereik?",
        a: "Je krijgt een melding wanneer je een limiet bereikt. Je kunt dan niet meer toevoegen tot je upgrade of items verwijdert. Bestaande resources blijven gewoon werken."
      },
      {
        q: "Hoe werkt de trial periode?",
        a: "Nieuwe accounts krijgen vaak een trial periode. Tijdens de trial heb je toegang tot alle features. Na de trial moet je een abonnement kiezen om door te gaan."
      },
      {
        q: "Kan ik kortingscodes gebruiken?",
        a: "Ja! Bij het kiezen van een abonnement kun je een kortingscode invoeren. Geldige codes geven korting op je eerste betaling of voor een bepaalde periode."
      }
    ]
  }
};

export default function Support() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewTicketDialog, setShowNewTicketDialog] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    category: "other",
    priority: "medium"
  });
  const [replyText, setReplyText] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['support-tickets', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.SupportTicket.filter(
        { submitter_id: user.id },
        "-created_date"
      );
    },
    enabled: !!user,
    initialData: [],
  });

  const createTicketMutation = useMutation({
    mutationFn: async (ticketData) => {
      const ticketNumber = `TICK-${Date.now().toString().slice(-6)}`;
      
      return base44.entities.SupportTicket.create({
        ...ticketData,
        ticket_number: ticketNumber,
        submitter_id: user.id,
        submitter_email: user.email,
        submitter_name: user.full_name,
        last_updated: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      setShowNewTicketDialog(false);
      setNewTicket({
        subject: "",
        description: "",
        category: "other",
        priority: "medium"
      });
      alert('✅ Ticket succesvol aangemaakt');
    },
  });

  const addResponseMutation = useMutation({
    mutationFn: async ({ ticketId, message }) => {
      const ticket = tickets.find(t => t.id === ticketId);
      const responses = ticket.responses || [];
      
      responses.push({
        message,
        responder_email: user.email,
        responder_name: user.full_name,
        is_admin: false,
        created_at: new Date().toISOString()
      });

      return base44.entities.SupportTicket.update(ticketId, {
        responses,
        last_updated: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
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

  // Filter knowledge base based on search
  const filteredKB = Object.entries(KNOWLEDGE_BASE).reduce((acc, [key, category]) => {
    if (!searchQuery) {
      acc[key] = category;
      return acc;
    }

    const matchingQuestions = category.questions.filter(
      qa =>
        qa.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        qa.a.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (matchingQuestions.length > 0 || category.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      acc[key] = { ...category, questions: matchingQuestions.length > 0 ? matchingQuestions : category.questions };
    }

    return acc;
  }, {});

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Support & Kennisbank</h1>
          <p className="text-gray-600">Vind antwoorden op je vragen of dien een support ticket in</p>
        </div>

        <Tabs defaultValue="knowledge" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="knowledge">
              <BookOpen className="w-4 h-4 mr-2" />
              Kennisbank
            </TabsTrigger>
            <TabsTrigger value="tickets">
              <Ticket className="w-4 h-4 mr-2" />
              Mijn Tickets ({tickets.length})
            </TabsTrigger>
          </TabsList>

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge" className="space-y-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Veelgestelde Vragen</CardTitle>
                  <Button
                    onClick={() => setShowNewTicketDialog(true)}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nieuw Ticket
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative mb-6">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    placeholder="Zoek in de kennisbank..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {Object.entries(filteredKB).map(([key, category]) => (
                    <Card key={key} className="border border-gray-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <span className="text-2xl">{category.icon}</span>
                          {category.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                          {category.questions.map((qa, idx) => (
                            <AccordionItem key={idx} value={`${key}-${idx}`}>
                              <AccordionTrigger className="text-left text-sm font-medium">
                                {qa.q}
                              </AccordionTrigger>
                              <AccordionContent className="text-sm text-gray-600">
                                {qa.a}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {Object.keys(filteredKB).length === 0 && (
                  <div className="text-center py-12">
                    <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Geen resultaten gevonden voor "{searchQuery}"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tickets Tab */}
          <TabsContent value="tickets" className="space-y-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Mijn Support Tickets</CardTitle>
                  <Button
                    onClick={() => setShowNewTicketDialog(true)}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nieuw Ticket
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="text-center py-12">
                    <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 mb-4">Je hebt nog geen support tickets</p>
                    <Button
                      onClick={() => setShowNewTicketDialog(true)}
                      variant="outline"
                    >
                      Maak je eerste ticket aan
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {tickets.map((ticket) => (
                      <Card
                        key={ticket.id}
                        className="border border-gray-200 cursor-pointer hover:border-indigo-200 transition-all"
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {ticket.ticket_number}
                                </Badge>
                                <Badge className={getStatusColor(ticket.status)}>
                                  {ticket.status.replace('_', ' ')}
                                </Badge>
                                <Badge className={getPriorityColor(ticket.priority)}>
                                  {ticket.priority}
                                </Badge>
                              </div>
                              <h3 className="font-semibold text-gray-900 mb-1">{ticket.subject}</h3>
                              <p className="text-sm text-gray-600 line-clamp-2">{ticket.description}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{getCategoryLabel(ticket.category)}</span>
                            <span>{format(new Date(ticket.created_date), "d MMM yyyy", { locale: nl })}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* New Ticket Dialog */}
        <Dialog open={showNewTicketDialog} onOpenChange={setShowNewTicketDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nieuw Support Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="subject">Onderwerp *</Label>
                <Input
                  id="subject"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  placeholder="Korte beschrijving van je vraag of probleem"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Categorie *</Label>
                  <Select
                    value={newTicket.category}
                    onValueChange={(value) => setNewTicket({ ...newTicket, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sites">Sites</SelectItem>
                      <SelectItem value="plugins">Plugins</SelectItem>
                      <SelectItem value="teams">Teams</SelectItem>
                      <SelectItem value="projects">Projecten</SelectItem>
                      <SelectItem value="subscriptions">Abonnementen</SelectItem>
                      <SelectItem value="account">Account</SelectItem>
                      <SelectItem value="technical">Technisch</SelectItem>
                      <SelectItem value="other">Overig</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Prioriteit *</Label>
                  <Select
                    value={newTicket.priority}
                    onValueChange={(value) => setNewTicket({ ...newTicket, priority: value })}
                  >
                    <SelectTrigger>
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

              <div>
                <Label htmlFor="description">Beschrijving *</Label>
                <Textarea
                  id="description"
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  placeholder="Geef een uitgebreide beschrijving van je vraag of probleem..."
                  rows={8}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowNewTicketDialog(false)}
                >
                  Annuleren
                </Button>
                <Button
                  onClick={() => createTicketMutation.mutate(newTicket)}
                  disabled={!newTicket.subject || !newTicket.description || createTicketMutation.isPending}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {createTicketMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Aanmaken...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Ticket Aanmaken
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Ticket Detail Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle className="flex-1">Ticket #{selectedTicket?.ticket_number}</DialogTitle>
                <Badge className={getStatusColor(selectedTicket?.status)}>
                  {selectedTicket?.status?.replace('_', ' ')}
                </Badge>
              </div>
            </DialogHeader>
            {selectedTicket && (
              <div className="space-y-6 mt-4">
                {/* Ticket Info */}
                <Card className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-2">{selectedTicket.subject}</h3>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-3 pt-3 border-t">
                      <Badge className={getPriorityColor(selectedTicket.priority)}>
                        {selectedTicket.priority}
                      </Badge>
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
                    <h4 className="font-semibold text-gray-900">Antwoorden</h4>
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

                {/* Reply Form */}
                {selectedTicket.status !== 'closed' && (
                  <div className="space-y-3">
                    <Label htmlFor="reply">Antwoord toevoegen</Label>
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
                          addResponseMutation.mutate({
                            ticketId: selectedTicket.id,
                            message: replyText
                          });
                        }
                      }}
                      disabled={!replyText.trim() || addResponseMutation.isPending}
                      className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                    >
                      {addResponseMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Versturen...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Antwoord Versturen
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