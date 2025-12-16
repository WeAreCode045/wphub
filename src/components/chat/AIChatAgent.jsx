import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Sparkles,
  User,
  Bot,
  Trash2,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function AIChatAgent({ user, currentPageName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getPageContext = () => {
    const context = {
      currentPage: currentPageName,
      userRole: user?.role,
      userName: user?.full_name,
      userEmail: user?.email
    };

    // Add specific context based on page
    if (currentPageName === "Dashboard") {
      context.pageInfo = "Dashboard overzicht met statistieken en recent activiteiten";
    } else if (currentPageName === "Sites") {
      context.pageInfo = "Sites beheer pagina - WordPress sites toevoegen, beheren en connectie testen";
    } else if (currentPageName === "Plugins") {
      context.pageInfo = "Plugins beheer pagina - Custom plugins uploaden, WordPress plugins toevoegen en beheren";
    } else if (currentPageName === "Teams") {
      context.pageInfo = "Teams pagina - Teams aanmaken, leden uitnodigen en team instellingen beheren";
    } else if (currentPageName === "Projects") {
      context.pageInfo = "Projects pagina - Projecten aanmaken en beheren binnen teams";
    } else if (currentPageName === "Berichten" || currentPageName === "UserMessages") {
      context.pageInfo = "Berichten inbox - Persoonlijke inbox, verzonden berichten en team inboxes";
    } else if (currentPageName === "Mijn Abonnement" || currentPageName === "MySubscription") {
      context.pageInfo = "Abonnement beheer - Huidige plan, gebruik en upgrade opties";
    } else if (currentPageName === "Account Instellingen" || currentPageName === "AccountSettings") {
      context.pageInfo = "Account instellingen - Profiel, 2FA en account beheer";
    }

    return context;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const context = getPageContext();
      
      const systemPrompt = `Je bent een behulpzame AI assistent voor het WP Cloud Hub platform - een WordPress plugin management systeem.
      
HUIDIGE CONTEXT:
- Pagina: ${context.currentPage}
${context.pageInfo ? `- Info: ${context.pageInfo}` : ''}
- Gebruiker: ${context.userName} (${context.userRole === 'admin' ? 'Administrator' : 'Gebruiker'})

PLATFORM FUNCTIES:
1. SITES BEHEER:
   - WordPress sites toevoegen met URL en API key
   - Connector plugin installeren voor communicatie
   - Sites verbinden en connectie testen
   - Health checks uitvoeren (uptime, performance, security)
   - Debug instellingen beheren
   - Site eigendom overdragen

2. PLUGINS BEHEER:
   - Eigen plugins uploaden (ZIP bestanden)
   - WordPress plugins zoeken en toevoegen
   - Versies beheren en updaten
   - Bulk installatie en activatie op sites
   - Plugin eigendom overdragen
   - Delen met teams

3. TEAMS & SAMENWERKING:
   - Teams aanmaken met leden
   - Custom rollen en permissies instellen
   - Team inbox voor communicatie
   - Sites en plugins delen met teams
   - Projecten beheren binnen teams

4. PROJECTEN:
   - Projecten koppelen aan sites en teams
   - Timeline en mijlpalen bijhouden
   - Teamleden toewijzen
   - Project inbox voor communicatie
   - Templates gebruiken

5. BERICHTEN SYSTEEM:
   - Persoonlijke inbox en outbox
   - Team inboxes (per team)
   - Project inboxes
   - Admin berichten
   - Thread-based conversaties

6. ABONNEMENTEN:
   - Verschillende plan groepen (Personal, Team)
   - Feature limits (sites, plugins, teams, projects)
   - Maandelijks/jaarlijks betalen
   - Upgrade/downgrade opties

BELANGRIJKE TIPS:
- Connector plugin is nodig voor site communicatie
- API keys zijn uniek per site
- Team owners hebben volledige rechten
- Custom rollen kunnen fine-grained permissies hebben
- Plugins kunnen gedeeld worden met teams
- Health checks monitoren uptime en security

Geef korte, duidelijke antwoorden in het Nederlands. Als de gebruiker op een specifieke pagina is, focus dan op die functionaliteit.`;

      const conversationHistory = messages.slice(-5).map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `${systemPrompt}

CONVERSATIE GESCHIEDENIS:
${conversationHistory.map(m => `${m.role === 'user' ? 'Gebruiker' : 'Assistent'}: ${m.content}`).join('\n')}

NIEUWE VRAAG:
Gebruiker: ${inputMessage}

Assistent:`,
        add_context_from_internet: false
      });

      const aiMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: "Sorry, er ging iets mis bij het verwerken van je vraag. Probeer het opnieuw.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm("Weet je zeker dat je de chat geschiedenis wilt wissen?")) {
      setMessages([]);
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white z-50"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[420px] h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">AI Assistent</h3>
                <p className="text-xs text-white/80">Altijd beschikbaar om te helpen</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearChat}
                  className="text-white hover:bg-white/20 h-8 w-8"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Current Page Badge */}
          {currentPageName && (
            <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100">
              <Badge className="bg-indigo-100 text-indigo-700 text-xs">
                📍 Je bent nu op: {currentPageName}
              </Badge>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
                  <Bot className="w-8 h-8 text-indigo-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Hoe kan ik je helpen?</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Stel me vragen over het platform, functies of hoe je iets moet doen.
                </p>
                <div className="grid gap-2 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setInputMessage("Hoe kan ik een nieuwe site toevoegen?");
                      setTimeout(() => handleSendMessage(), 100);
                    }}
                    className="text-xs"
                  >
                    Hoe voeg ik een site toe?
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setInputMessage("Hoe werk ik met teams?");
                      setTimeout(() => handleSendMessage(), 100);
                    }}
                    className="text-xs"
                  >
                    Hoe werk ik met teams?
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setInputMessage("Hoe installeer ik plugins op sites?");
                      setTimeout(() => handleSendMessage(), 100);
                    }}
                    className="text-xs"
                  >
                    Hoe installeer ik plugins?
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="w-8 h-8 border-2 border-gray-200 flex-shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 ${
                        message.role === "user"
                          ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          message.role === "user" ? "text-white/70" : "text-gray-500"
                        }`}
                      >
                        {format(message.timestamp, "HH:mm", { locale: nl })}
                      </p>
                    </div>
                    {message.role === "user" && (
                      <Avatar className="w-8 h-8 border-2 border-gray-200 flex-shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white text-xs font-semibold">
                          {getInitials(user?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <Avatar className="w-8 h-8 border-2 border-gray-200">
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-gray-100 rounded-2xl p-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        <span className="text-sm text-gray-600">Aan het nadenken...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2"
            >
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Stel je vraag..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}