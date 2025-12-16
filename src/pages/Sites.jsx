
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Crown,
  ExternalLink,
  Globe,
  Grid3x3,
  List,
  Loader2,
  Mail,
  MoreVertical,
  Package,
  Plus,
  Search,
  Send,
  Trash2,
  XCircle,
  UserPlus,
  Clock,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import SendMessageDialog from "../components/messaging/SendMessageDialog";
import SendNotificationDialog from "../components/messaging/SendNotificationDialog";
import { checkSubscriptionLimit } from "../components/subscription/LimitChecker";
import FeatureGate from "../components/subscription/FeatureGate";
import { useUser } from "../Layout";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function Sites() {
  const user = useUser();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSite, setNewSite] = useState({ name: "", url: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);
  const [existingSite, setExistingSite] = useState(null);
  const [activeTab, setActiveTab] = useState("my-sites");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isAdmin = user?.role === "admin";

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ['sites', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const userSites = await base44.entities.Site.filter({
        owner_type: "user",
        owner_id: user.id
      }, "-updated_date");
      
      return userSites;
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: true,
    initialData: [],
  });

  const { data: transferSites = [] } = useQuery({
    queryKey: ['transfer-sites', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const allSites = await base44.entities.Site.list();
      
      // Filter for sites with pending transfers where user is involved
      return allSites.filter(site => {
        if (!site.transfer_request || site.transfer_request.status !== 'pending') return false;
        
        // User is current owner OR user is requester
        return (site.owner_type === 'user' && site.owner_id === user.id) ||
               (site.transfer_request.requested_by_user_id === user.id);
      });
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: true,
    initialData: [],
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const { data: allPlugins = [] } = useQuery({
    queryKey: ['plugins', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const userPlugins = await base44.entities.Plugin.filter({
        owner_type: "user",
        owner_id: user.id
      });
      
      return userPlugins;
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: true,
    initialData: [],
  });

  const checkSiteExistsMutation = useMutation({
    mutationFn: async (url) => {
      const normalizedUrl = url.replace(/\/$/, '');
      const allSites = await base44.entities.Site.list();
      const existing = allSites.find(s => s.url.replace(/\/$/, '') === normalizedUrl);
      return existing;
    },
  });

  const requestTransferMutation = useMutation({
    mutationFn: async (siteId) => {
      const response = await base44.functions.invoke('requestSiteTransfer', {
        site_id: siteId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-sites'] });
      setExistingSite(null);
      setNewSite({ name: "", url: "" });
      setShowCreateDialog(false);
      toast({
        title: "Overdrachtverzoek verzonden",
        description: "De site-eigenaar ontvangt je verzoek in zijn inbox",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij verzenden verzoek",
        description: error.response?.data?.error || error.message,
      });
    }
  });

  const createSiteMutation = useMutation({
    mutationFn: async (siteData) => {
      if (!user) throw new Error("User not loaded");
      
      // Check if site already exists
      const existing = await checkSiteExistsMutation.mutateAsync(siteData.url);
      
      if (existing) {
        // Check if user is already the owner
        if (existing.owner_type === 'user' && existing.owner_id === user.id) {
          throw new Error("Je bent al de eigenaar van deze site");
        }
        
        // Show transfer request option
        setExistingSite(existing);
        throw new Error("SITE_EXISTS");
      }
      
      const limitCheck = await checkSubscriptionLimit(user.id, 'sites');
      
      if (!limitCheck.allowed) {
        throw new Error(limitCheck.message);
      }

      const apiKey = Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15);

      const newSite = await base44.entities.Site.create({
        name: siteData.name,
        url: siteData.url.replace(/\/$/, ''),
        api_key: apiKey,
        owner_type: "user",
        owner_id: user.id,
        connection_status: "inactive",
        shared_with_teams: []
      });

      await base44.entities.ActivityLog.create({
        user_email: user.email,
        action: `Site toegevoegd: ${siteData.name}`,
        entity_type: "site",
        entity_id: newSite.id
      });

      return newSite;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setShowCreateDialog(false);
      setNewSite({ name: "", url: "" });
      setExistingSite(null);
      toast({
        title: "Site toegevoegd",
        description: "De site is succesvol toegevoegd",
      });
    },
    onError: (error) => {
      if (error.message === "SITE_EXISTS") {
        return; 
      }
      toast({
        variant: "destructive",
        title: "Fout bij toevoegen",
        description: error.message,
      });
    }
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (siteId) => {
      if (!user) throw new Error("User not loaded");
      
      const site = sites.find(s => s.id === siteId);
      
      if (site) {
        await base44.entities.ActivityLog.create({
          user_email: user.email,
          action: `Site verwijderd: ${site.name}`,
          entity_type: "site"
        });
      }
      
      return base44.entities.Site.delete(siteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      toast({
        title: "Site verwijderd",
        description: "De site is succesvol verwijderd",
      });
    },
  });

  const handleCreateSite = () => {
    if (newSite.name && newSite.url) {
      createSiteMutation.mutate(newSite);
    }
  };

  const handleRequestTransfer = () => {
    if (existingSite) {
      requestTransferMutation.mutate(existingSite.id);
    }
  };

  const handleOpenMessageDialog = (site) => {
    setSelectedSite(site);
    setShowMessageDialog(true);
  };

  const handleOpenNotificationDialog = (site) => {
    setSelectedSite(site);
    setShowNotificationDialog(true);
  };

  const getInstalledPluginsCount = (site) => {
    return allPlugins.filter(plugin => 
      plugin.installed_on?.some(install => install.site_id === site.id)
    ).length;
  };

  const getStatusColor = (status) => {
    const colors = {
      active: "bg-green-100 text-green-700 border-green-200",
      inactive: "bg-amber-100 text-amber-700 border-amber-200",
      error: "bg-red-100 text-red-700 border-red-200"
    };
    return colors[status] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case "active": return <CheckCircle className="w-4 h-4" />;
      case "inactive": return <XCircle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const filteredSites = sites.filter(site => {
    const matchesSearch = site.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          site.url?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || site.connection_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getInitials = (name) => {
    if (!name) return "S";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const stats = {
    total: sites.length,
    active: sites.filter(s => s.connection_status === "active").length,
    inactive: sites.filter(s => s.connection_status === "inactive").length,
    pendingTransfers: transferSites.length,
  };

  const SiteCard = ({ site }) => {
    const installedCount = getInstalledPluginsCount(site);
    
    return (
      <Card className="border-none shadow-md hover:shadow-lg transition-all">
        <CardHeader className="bg-gradient-to-br from-indigo-50 to-purple-50 border-b border-gray-100 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar className="w-12 h-12 border-2 border-gray-200">
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm">
                  {getInitials(site.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base truncate text-gray-900">{site.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`${getStatusColor(site.connection_status)} text-xs`}>
                    {getStatusIcon(site.connection_status)}
                    <span className="ml-1">
                      {site.connection_status === "active" ? "Actief" : "Inactief"}
                    </span>
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-700 text-xs">
                    <Crown className="w-3 h-3 mr-1" />
                    Eigenaar
                  </Badge>
                </div>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isAdmin && (
                  <>
                    <DropdownMenuItem onClick={() => handleOpenMessageDialog(site)}>
                      <Mail className="w-4 h-4 mr-2" />
                      Bericht Sturen (Admin)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenNotificationDialog(site)}>
                      <Bell className="w-4 h-4 mr-2" />
                      Notificatie Sturen (Admin)
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem 
                  onClick={() => {
                    if (confirm(`Weet je zeker dat je "${site.name}" wilt verwijderen?`)) {
                      deleteSiteMutation.mutate(site.id);
                    }
                  }}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Verwijderen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline"
          >
            {site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              <span>{installedCount} plugins</span>
            </div>
            {site.wp_version && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                <span>WP {site.wp_version}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <Button 
              asChild 
              size="sm" 
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
            >
              <Link to={createPageUrl(`SiteDetail?id=${site.id}`)}>
                Beheren
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(site.url, '_blank')}
              className="hover:bg-indigo-50 hover:text-indigo-700"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const SiteListItem = ({ site }) => {
    const installedCount = getInstalledPluginsCount(site);

    return (
      <Card className="border-none shadow-md hover:shadow-lg transition-all">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12 border-2 border-gray-200 flex-shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm">
                {getInitials(site.name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{site.name}</h3>
                <Badge className={`${getStatusColor(site.connection_status)} text-xs`}>
                  {getStatusIcon(site.connection_status)}
                  <span className="ml-1">
                    {site.connection_status === "active" ? "Actief" : "Inactief"}
                  </span>
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" />
                  <span>{installedCount} plugins</span>
                </div>
                {site.wp_version && (
                  <>
                    <span>•</span>
                    <span>WP {site.wp_version}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button 
                asChild 
                size="sm" 
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
              >
                <Link to={createPageUrl(`SiteDetail?id=${site.id}`)}>
                  Beheren
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => window.open(site.url, '_blank')}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Site
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuItem onClick={() => handleOpenMessageDialog(site)}>
                        <Mail className="w-4 h-4 mr-2" />
                        Bericht Sturen (Admin)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenNotificationDialog(site)}>
                        <Bell className="w-4 h-4 mr-2" />
                        Notificatie Sturen (Admin)
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem 
                    onClick={() => {
                      if (confirm(`Weet je zeker dat je "${site.name}" wilt verwijderen?`)) {
                        deleteSiteMutation.mutate(site.id);
                      }
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Verwijderen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const TransferCard = ({ site }) => {
    const isCurrentOwner = site.owner_type === 'user' && site.owner_id === user?.id;
    const isRequester = site.transfer_request?.requested_by_user_id === user?.id;
    const otherUser = isCurrentOwner 
      ? allUsers.find(u => u.id === site.transfer_request?.requested_by_user_id)
      : allUsers.find(u => u.id === site.owner_id);

    return (
      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md hover:shadow-lg transition-all">
        <CardHeader className="border-b border-indigo-100 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar className="w-12 h-12 border-2 border-indigo-200">
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm">
                  {getInitials(site.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base truncate text-gray-900">{site.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    In behandeling
                  </Badge>
                  {isCurrentOwner && (
                    <Badge className="bg-indigo-100 text-indigo-700 text-xs">
                      <Crown className="w-3 h-3 mr-1" />
                      Eigenaar
                    </Badge>
                  )}
                  {isRequester && (
                    <Badge className="bg-blue-100 text-blue-700 text-xs">
                      <Send className="w-3 h-3 mr-1" />
                      Aangevraagd
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline"
          >
            {site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="bg-white/70 rounded-lg p-3 border border-indigo-100">
            <div className="flex items-start gap-2 mb-2">
              <UserPlus className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-600">
                  {isCurrentOwner ? (
                    <>
                      <strong>Aanvraag van:</strong> {site.transfer_request?.requested_by_user_name}
                    </>
                  ) : (
                    <>
                      <strong>Huidige eigenaar:</strong> {otherUser?.full_name || 'Onbekend'}
                    </>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {site.transfer_request?.requested_by_user_email}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              <Clock className="w-3 h-3 inline mr-1" />
              Aangevraagd: {format(new Date(site.transfer_request?.request_date), "d MMM yyyy HH:mm", { locale: nl })}
            </p>
          </div>

          <div className="flex gap-2 pt-3 border-t border-indigo-100">
            <Button 
              asChild 
              size="sm" 
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
            >
              <Link to={createPageUrl(`SiteDetail?id=${site.id}`)}>
                {isCurrentOwner ? (
                  <>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Verzoek Bekijken
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Status Bekijken
                  </>
                )}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <FeatureGate userId={user?.id} featureType="sites">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Mijn Sites</h1>
          <p className="text-sm text-gray-600">Beheer je WordPress sites en overdrachtverzoeken</p>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Totaal Sites</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Actieve Sites</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Inactieve Sites</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.inactive}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Openstaande Overdrachten</p>
                  <p className="text-2xl font-bold text-indigo-600">{stats.pendingTransfers}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my-sites">
              <Globe className="w-4 h-4 mr-2" />
              Mijn Sites ({sites.length})
            </TabsTrigger>
            <TabsTrigger value="transfers">
              <UserPlus className="w-4 h-4 mr-2" />
              Overdrachten ({transferSites.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-sites" className="space-y-6">
            <Card className="border-none shadow-md">
              <CardContent className="p-4">
                <div className="flex gap-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Zoek sites..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[130px] h-9 text-sm">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Status</SelectItem>
                      <SelectItem value="active">Actief</SelectItem>
                      <SelectItem value="inactive">Inactief</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1 border border-gray-200 rounded-xl p-1 bg-gray-50">
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="icon"
                      onClick={() => setViewMode("grid")}
                      className={`h-8 w-8 rounded-lg ${
                        viewMode === "grid" 
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md' 
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <Grid3x3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="icon"
                      onClick={() => setViewMode("list")}
                      className={`h-8 w-8 rounded-lg ${
                        viewMode === "list" 
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md' 
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button 
                    onClick={() => setShowCreateDialog(true)}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nieuwe Site
                  </Button>
                </div>
              </CardContent>
            </Card>

            {filteredSites.length === 0 ? (
              <Card className="border-none shadow-md">
                <CardContent className="p-12 text-center">
                  <Globe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-900 mb-1">
                    {searchQuery || statusFilter !== "all" ? "Geen sites gevonden" : "Nog geen sites"}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {searchQuery || statusFilter !== "all"
                      ? "Probeer een andere zoekopdracht of pas de filters aan"
                      : "Voeg je eerste WordPress site toe"}
                  </p>
                  {!searchQuery && statusFilter === "all" && (
                    <Button 
                      onClick={() => setShowCreateDialog(true)}
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Nieuwe Site
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className={viewMode === "grid" ? "grid md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
                {filteredSites.map((site) => (
                  viewMode === "grid" ? (
                    <SiteCard key={site.id} site={site} />
                  ) : (
                    <SiteListItem key={site.id} site={site} />
                  )
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transfers" className="space-y-6">
            {transferSites.length === 0 ? (
              <Card className="border-none shadow-md">
                <CardContent className="p-12 text-center">
                  <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-900 mb-1">
                    Geen openstaande overdrachten
                  </h3>
                  <p className="text-sm text-gray-600">
                    Er zijn momenteel geen lopende site-overdrachtverzoeken
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {transferSites.map((site) => (
                  <TransferCard key={site.id} site={site} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setExistingSite(null);
            setNewSite({ name: "", url: "" });
            createSiteMutation.reset();
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nieuwe Site Toevoegen</DialogTitle>
            </DialogHeader>
            
            {existingSite ? (
              <div className="space-y-4 mt-4">
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-900 text-sm">Site Al Toegevoegd</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Deze site URL is al toegevoegd aan het platform door een andere gebruiker.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Site Naam:</span>
                    <span className="font-semibold text-gray-900">{existingSite.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Site URL:</span>
                    <span className="font-semibold text-gray-900">{existingSite.url}</span>
                  </div>
                </div>

                <p className="text-sm text-gray-600">
                  Je kunt een overdrachtverzoek sturen naar de huidige eigenaar van deze site. Als het verzoek wordt geaccepteerd, wordt de site aan jou overgedragen.
                </p>

                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateDialog(false);
                      setExistingSite(null);
                      setNewSite({ name: "", url: "" });
                      createSiteMutation.reset();
                    }}
                  >
                    Annuleren
                  </Button>
                  <Button
                    onClick={handleRequestTransfer}
                    disabled={requestTransferMutation.isPending}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                  >
                    {requestTransferMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verzenden...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Vraag Overdracht Aan
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="site-name">Site Naam *</Label>
                  <Input
                    id="site-name"
                    placeholder="Mijn WordPress Site"
                    value={newSite.name}
                    onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="site-url">Site URL *</Label>
                  <Input
                    id="site-url"
                    placeholder="https://example.com"
                    value={newSite.url}
                    onChange={(e) => setNewSite({ ...newSite, url: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <DialogFooter className="mt-4">
                  <Button
                    onClick={handleCreateSite}
                    disabled={createSiteMutation.isPending || !newSite.name || !newSite.url}
                    className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                  >
                    {createSiteMutation.isPending ? "Toevoegen..." : "Site Toevoegen"}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setShowCreateDialog(false);
                    createSiteMutation.reset();
                  }}>
                    Annuleren
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {selectedSite && isAdmin && (
          <>
            <SendMessageDialog
              open={showMessageDialog}
              onOpenChange={setShowMessageDialog}
              user={user}
              context={{
                type: "site",
                id: selectedSite.id,
                name: selectedSite.name
              }}
            />

            <SendNotificationDialog
              open={showNotificationDialog}
              onOpenChange={setShowNotificationDialog}
              user={user}
              context={{
                type: "site",
                id: selectedSite.id,
                name: selectedSite.name
              }}
            />
          </>
        )}
      </div>
    </FeatureGate>
  );
}
