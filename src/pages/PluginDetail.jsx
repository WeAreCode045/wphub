
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Crown,
  Download,
  Edit,
  ExternalLink,
  EyeOff,
  Globe,
  Loader2,
  Mail,
  Package,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Share2,
  Square,
  Star,
  Trash2,
  Upload,
  UserPlus,
  Users,
  XCircle,
  Settings,
  ShieldCheck // Added ShieldCheck icon
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SendMessageDialog from "../components/messaging/SendMessageDialog";
import SendNotificationDialog from "../components/messaging/SendNotificationDialog";

// Inline toast functionality for now
const useToast = () => {
  return {
    toast: ({ title, description, variant }) => {
      const message = `${title}${description ? '\n' + description : ''}`;
      if (variant === "error" || variant === "destructive") {
        alert('❌ ' + message);
      } else {
        alert('✅ ' + message);
      }
    }
  };
};

// Helper function to decode HTML entities
const decodeHtmlEntities = (text) => {
  if (!text) return text;
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
};

export default function PluginDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const pluginId = urlParams.get("id");
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showBulkToggleDialog, setShowBulkToggleDialog] = useState(false);
  const [showBulkUpdateDialog, setShowBulkUpdateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedSites, setSelectedSites] = useState([]);
  const [selectedUpdateSites, setSelectedUpdateSites] = useState([]);
  const [selectedDownloadSite, setSelectedDownloadSite] = useState("");
  const [bulkToggleEnabled, setBulkToggleEnabled] = useState(true);
  const [editForm, setEditForm] = useState({ name: "", description: "", author: "" });
  const [transferToUserId, setTransferToUserId] = useState("");
  const [transferToTeamId, setTransferToTeamId] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: plugin } = useQuery({
    queryKey: ['plugin', pluginId],
    queryFn: () => base44.entities.Plugin.get(pluginId),
  });

  useEffect(() => {
    if (plugin && showEditDialog) {
      setEditForm({
        name: plugin.name,
        description: plugin.description || "",
        author: plugin.author || ""
      });
    }
  }, [plugin, showEditDialog]);

  useEffect(() => {
    if (plugin && showShareDialog) {
      setSelectedTeamIds(plugin.shared_with_teams || []);
    }
  }, [plugin, showShareDialog]);

  const { data: allSites = [] } = useQuery({
    queryKey: ['sites'],
    queryFn: () => base44.entities.Site.list(),
    initialData: [],
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const { data: userTeams = [] } = useQuery({
    queryKey: ['user-teams', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const allTeams = await base44.entities.Team.list();
      return allTeams.filter(team =>
        team.owner_id === user.id ||
        team.members?.some(m => m.user_id === user.id)
      );
    },
    enabled: !!user,
    initialData: [],
  });

  const uploadVersionMutation = useMutation({
    mutationFn: async ({ version, file }) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file, bucket: 'Plugins' });

      const versions = plugin.versions || [];
      versions.push({
        version,
        download_url: file_url,
        created_at: new Date().toISOString()
      });

      await base44.entities.Plugin.update(pluginId, {
        versions,
        latest_version: version
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
      setShowUploadDialog(false);
      setNewVersion("");
      setSelectedFile(null);
      toast({
        variant: "success",
        title: "Versie geüpload",
        description: "De nieuwe versie is succesvol toegevoegd",
      });
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: async (versionToDelete) => {
      const versions = plugin.versions.filter(v => v.version !== versionToDelete);
      const latestVersion = versions.length > 0
        ? versions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].version
        : null;

      await base44.entities.Plugin.update(pluginId, {
        versions,
        latest_version: latestVersion
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
      toast({
        variant: "success",
        title: "Versie verwijderd",
        description: "De versie is succesvol verwijderd",
      });
    },
  });

  const togglePluginForSiteMutation = useMutation({
    mutationFn: async ({ siteId, enabled }) => {
      const response = await base44.functions.invoke('enablePluginForSite', {
        site_id: siteId,
        plugin_id: pluginId,
        enabled
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });

  const bulkToggleAvailabilityMutation = useMutation({
    mutationFn: async ({ siteIds, enabled }) => {
      const promises = siteIds.map(siteId =>
        base44.functions.invoke('enablePluginForSite', {
          site_id: siteId,
          plugin_id: pluginId,
          enabled
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setSelectedSites([]);
      setShowBulkToggleDialog(false);
      toast({
        variant: "success",
        title: "Beschikbaarheid bijgewerkt",
        description: "De beschikbaarheid van de plugin is succesvol bijgewerkt voor de geselecteerde sites",
      });
    },
  });

  const flagAsRiskMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Plugin.update(pluginId, {
        is_disabled: !plugin.is_disabled,
        disabled_reason: !plugin.is_disabled ? 'Gemarkeerd als risico door beheerder' : null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
      toast({
        variant: "success",
        title: plugin.is_disabled ? "Risico verwijderd" : "Gemarkeerd als risico",
        description: plugin.is_disabled ? "De risicovlag is succesvol verwijderd." : "De plugin is gemarkeerd als risico.",
      });
    },
  });

  const deletePluginMutation = useMutation({
    mutationFn: () => base44.entities.Plugin.delete(pluginId),
    onSuccess: () => {
      toast({
        variant: "success",
        title: "Plugin verwijderd",
        description: "De plugin is succesvol verwijderd",
      });
      setTimeout(() => {
        window.location.href = createPageUrl("Plugins");
      }, 500);
    },
  });

  const installPluginMutation = useMutation({
    mutationFn: async (siteId) => {
      const response = await base44.functions.invoke('installPlugin', {
        site_id: siteId,
        plugin_id: pluginId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
      toast({
        variant: "success",
        title: "Plugin geïnstalleerd",
        description: "De plugin is succesvol geïnstalleerd",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Installatie mislukt",
        description: error.message,
      });
    }
  });

  const activatePluginMutation = useMutation({
    mutationFn: async (siteId) => {
      const response = await base44.functions.invoke('activatePlugin', {
        site_id: siteId,
        plugin_id: pluginId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      toast({
        variant: "success",
        title: "Plugin geactiveerd",
        description: "De plugin is succesvol geactiveerd",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Activatie mislukt",
        description: error.message,
      });
    }
  });

  const deactivatePluginMutation = useMutation({
    mutationFn: async (siteId) => {
      const response = await base44.functions.invoke('deactivatePlugin', {
        site_id: siteId,
        plugin_id: pluginId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      toast({
        variant: "success",
        title: "Plugin gedeactiveerd",
        description: "De plugin is succesvol gedeactiveerd",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Deactivatie mislukt",
        description: error.message,
      });
    }
  });

  const uninstallPluginMutation = useMutation({
    mutationFn: async ({ siteId }) => {
      const response = await base44.functions.invoke('uninstallPlugin', {
        site_id: siteId,
        plugin_slug: plugin.slug,
        plugin_id: plugin.id
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
      queryClient.invalidateQueries({ queryKey: ['sites'] }); // Invalidate general site data
      alert('✅ Plugin gedeïnstalleerd');
    },
    onError: (error) => {
      alert('❌ Fout: ' + error.message);
    }
  });

  const editPluginMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Plugin.update(pluginId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
      setShowEditDialog(false);
      toast({
        variant: "success",
        title: "Plugin bewerkt",
        description: "De wijzigingen zijn opgeslagen",
      });
    },
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: async ({ toUserId, toTeamId }) => {
      const updateData = {};
      if (toUserId) {
        updateData.owner_type = "user";
        updateData.owner_id = toUserId;
      } else if (toTeamId) {
        updateData.owner_type = "team";
        updateData.owner_id = toTeamId;
      }
      return base44.entities.Plugin.update(pluginId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
      setShowTransferDialog(false);
      toast({
        variant: "success",
        title: "Eigendom overgedragen",
        description: "Het eigendom is succesvol overgedragen",
      });
    },
  });

  const shareWithTeamsMutation = useMutation({
    mutationFn: async (teamIds) => {
      return base44.entities.Plugin.update(pluginId, {
        shared_with_teams: teamIds
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
      setShowShareDialog(false);
      toast({
        variant: "success",
        title: "Delen bijgewerkt",
        description: "De plugin wordt nu gedeeld met de geselecteerde teams",
      });
    },
  });

  const downloadFromWordPressMutation = useMutation({
    mutationFn: async (siteId) => {
      const response = await base44.functions.invoke('downloadPluginFromWordPress', {
        site_id: siteId,
        plugin_slug: plugin.slug
      });
      return response.data;
    },
    onSuccess: async (data) => {
      if (data.success) {
        // Add version to plugin
        const versions = plugin.versions || [];
        versions.push({
          version: data.plugin_data.version,
          download_url: data.file_url,
          created_at: new Date().toISOString()
        });

        await base44.entities.Plugin.update(pluginId, {
          versions,
          latest_version: data.plugin_data.version
        });

        queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
        setShowDownloadDialog(false);
        setSelectedDownloadSite("");
        toast({
          variant: "success",
          title: "Plugin gedownload",
          description: data.message,
        });
      } else {
        toast({
          variant: "error",
          title: "Download mislukt",
          description: data.message,
        });
      }
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Fout bij downloaden",
        description: error.message,
      });
    }
  });

  const handleUploadVersion = async () => {
    if (newVersion && selectedFile) {
      uploadVersionMutation.mutate({ version: newVersion, file: selectedFile });
    }
  };

  const handleBulkToggle = () => {
    if (selectedSites.length > 0) {
      bulkToggleAvailabilityMutation.mutate({ siteIds: selectedSites, enabled: bulkToggleEnabled });
    }
  };

  const handleEditSave = () => {
    if (editForm.name) {
      editPluginMutation.mutate(editForm);
    }
  };

  const handleTransfer = () => {
    if (transferToUserId || transferToTeamId) {
      transferOwnershipMutation.mutate({
        toUserId: transferToUserId,
        toTeamId: transferToTeamId
      });
    }
  };

  const handleShareSave = () => {
    shareWithTeamsMutation.mutate(selectedTeamIds);
  };

  const handleDownloadFromWordPress = () => {
    if (selectedDownloadSite) {
      downloadFromWordPressMutation.mutate(selectedDownloadSite);
    }
  };

  const toggleSiteSelection = (siteId) => {
    setSelectedSites(prev =>
      prev.includes(siteId)
        ? prev.filter(id => id !== siteId)
        : [...prev, siteId]
    );
  };

  const toggleUpdateSiteSelection = (siteId) => {
    setSelectedUpdateSites(prev =>
      prev.includes(siteId)
        ? prev.filter(id => id !== siteId)
        : [...prev, siteId]
    );
  };

  const toggleTeamSelection = (teamId) => {
    setSelectedTeamIds(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const selectAllSites = (sites) => {
    const siteIds = sites.map(s => s.id);
    setSelectedSites(siteIds);
  };

  const deselectAllSites = () => {
    setSelectedSites([]);
  };

  const getUserById = (userId) => allUsers.find(u => u.id === userId);

  const isAdmin = user?.role === "admin";

  if (!plugin) {
    return <div className="p-8">Plugin wordt geladen...</div>;
  }

  const versions = plugin.versions || [];
  const sortedVersions = [...versions].sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at)
  );

  const mySites = allSites.filter(site => {
    if (!user) return false;
    if (site.owner_type === "user" && site.owner_id === user.id) return true;
    if (site.owner_type === "team") {
      const team = userTeams.find(t => t.id === site.owner_id);
      if (team?.owner_id === user.id) return true;
      if (team?.members?.some(m => m.user_id === user.id)) return true;
    }
    return false;
  });

  const getPluginStatusForSite = (siteId) => {
    const site = allSites.find(s => s.id === siteId);
    if (!site) return null;

    const sitePlugins = site.plugins || [];
    return sitePlugins.find(p => p.plugin_id === pluginId);
  };

  const canManagePlugin = () => {
    if (!user || !plugin) return false;
    
    // Owner always has full rights
    if (plugin.owner_type === "user" && plugin.owner_id === user.id) return true;
    if (plugin.owner_type === "team") {
      const team = userTeams.find(t => t.id === plugin.owner_id);
      if (team?.owner_id === user.id) return true; // Team owner always has full rights
      
      const member = team?.members?.find(m => m.user_id === user.id);
      if (member?.permissions?.manage_plugins) return true;
    }
    return false;
  };

  const canManage = canManagePlugin();
  const ownerUser = getUserById(plugin.owner_id);
  const isTeamOwned = plugin.owner_type === "team";
  const ownerTeam = isTeamOwned ? userTeams.find(t => t.id === plugin.owner_id) : null;

  // Filter sites where plugin is installed AND user has access to
  const sitesPluginInstalledOnAnySite = allSites.filter(site => {
    // Check if plugin is installed on this site
    if (!plugin.installed_on?.some(install => install.site_id === site.id)) return false;
    
    // Check if user has access to this site
    if (!user) return false;
    
    // User owns the site
    if (site.owner_type === "user" && site.owner_id === user.id) return true;
    
    // Site belongs to a team where user is a member AND plugin is shared with that team
    if (site.owner_type === "team") {
      const team = userTeams.find(t => t.id === site.owner_id);
      if (!team) return false;
      
      // User is owner or member of the team
      const isMember = team.owner_id === user.id || 
                       team.members?.some(m => m.user_id === user.id && m.status === "active");
      
      if (!isMember) return false;
      
      // Plugin must be shared with this team
      if (!plugin.shared_with_teams?.includes(team.id)) return false;
      
      return true;
    }
    
    return false;
  });

  // The installedCount now reflects the number of sites the current user has access to AND the plugin is installed on.
  const installedCount = sitesPluginInstalledOnAnySite.length;

  // This variable is needed for the Download from WordPress dialog.
  const sitesWithPluginInstalled = mySites.filter(site => {
    const pluginData = getPluginStatusForSite(site.id);
    return pluginData && pluginData.is_installed === 1;
  });

  // This variable is needed for the Bulk Update Dialog.
  const sitesWithPluginForBulkUpdate = mySites.filter(site => {
    const pluginData = getPluginStatusForSite(site.id);
    return pluginData && pluginData.is_installed === 1;
  });

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Terug
            </Button>
          </div>
          
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                <Package className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 mb-1">{decodeHtmlEntities(plugin?.name)}</h1>
                <p className="text-sm text-gray-600">{decodeHtmlEntities(plugin?.description)}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Removed original Message and Admin-Notification buttons from here as per new outline */}

              {canManage && (
                <Button
                  onClick={() => setShowUploadDialog(true)}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Nieuwe Versie Uploaden
                </Button>
              )}
              
              {plugin.owner_type === "user" && plugin.owner_id === user?.id && (
                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                  <Crown className="w-3 h-3 mr-1" />
                  Eigenaar
                </Badge>
              )}
              {plugin.is_disabled && (
                <Badge className="bg-red-100 text-red-700 border-red-200">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Risico
                </Badge>
              )}
            </div>
          </div>

          {/* Admin Actions - Only visible for admins */}
          {isAdmin && (
            <div className="flex items-center gap-2 mt-4 ml-4 pl-4 border-l-2 border-purple-300">
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Admin Actions
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowMessageDialog(true)}
                className="border-purple-200 text-purple-700 hover:bg-purple-50"
              >
                <Mail className="w-4 h-4 mr-2" />
                Bericht
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowNotificationDialog(true)}
                className="border-purple-200 text-purple-700 hover:bg-purple-50"
              >
                <Bell className="w-4 h-4 mr-2" />
                Notificatie
              </Button>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Plugin Info Card */}
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-indigo-600" />
                Plugin Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Slug</span>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">{plugin.slug}</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Eigenaar</span>
                <div className="flex items-center gap-1">
                  {isTeamOwned ? (
                    <>
                      <span className="text-xs font-medium">{ownerTeam?.name || 'Team'}</span>
                      <Badge variant="secondary" className="text-xs py-0">Team</Badge>
                    </>
                  ) : (
                    <span className="text-xs font-medium">{ownerUser?.full_name || 'Onbekend'}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Laatst Geüpdatet</span>
                <span className="text-xs font-medium">
                  {plugin.updated_date ? format(new Date(plugin.updated_date), 'd MMM yyyy', { locale: nl }) : 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Statistics Card */}
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                Statistieken
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 bg-indigo-50 rounded-lg">
                  <p className="text-xs text-indigo-600 mb-1">Versie</p>
                  <p className="text-lg font-bold text-indigo-700">
                    {plugin.latest_version ? `v${plugin.latest_version}` : "N/A"}
                  </p>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1">Versies</p>
                  <p className="text-lg font-bold text-blue-700">{versions.length}</p>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 mb-1">Installs</p>
                  <p className="text-lg font-bold text-green-700">{installedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons Card */}
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100 pb-3">
              <CardTitle className="text-sm">Acties</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <TooltipProvider>
                <div className="flex gap-2 justify-center flex-wrap">
                  {canManage && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => setShowEditDialog(true)}
                            variant="outline"
                            size="icon"
                            className="h-12 w-12"
                          >
                            <Edit className="w-5 h-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Bewerken</TooltipContent>
                      </Tooltip>
                    </>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setShowBulkToggleDialog(true)}
                        variant="outline"
                        size="icon"
                        className="h-12 w-12"
                      >
                        {bulkToggleEnabled ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Bulk Toggle Beschikbaarheid</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setShowBulkUpdateDialog(true)}
                        variant="outline"
                        size="icon"
                        className="h-12 w-12"
                        disabled={sitesWithPluginForBulkUpdate.length === 0}
                      >
                        <RefreshCw className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Bulk Update Sites</TooltipContent>
                  </Tooltip>

                  {canManage && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => setShowShareDialog(true)}
                            variant="outline"
                            size="icon"
                            className="h-12 w-12"
                          >
                            <Share2 className="w-5 h-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delen met Teams</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => setShowTransferDialog(true)}
                            variant="outline"
                            size="icon"
                            className="h-12 w-12"
                          >
                            <UserPlus className="w-5 h-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Eigendom Overdragen</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => flagAsRiskMutation.mutate()}
                            disabled={flagAsRiskMutation.isPending}
                            variant="outline"
                            size="icon"
                            className={`h-12 w-12 ${plugin.is_disabled ? 'bg-red-50 border-red-200' : ''}`}
                          >
                            {flagAsRiskMutation.isPending ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <AlertTriangle className={`w-5 h-5 ${plugin.is_disabled ? 'text-red-600' : ''}`} />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {plugin.is_disabled ? 'Verwijder Risico Flag' : 'Markeer als Risico'}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => {
                              if (confirm('Weet je zeker dat je deze plugin wilt verwijderen?')) {
                                deletePluginMutation.mutate();
                              }
                            }}
                            disabled={deletePluginMutation.isPending}
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          >
                            {deletePluginMutation.isPending ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Trash2 className="w-5 h-5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Plugin Verwijderen</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              </TooltipProvider>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {canManage && (
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-indigo-600" />
                    Plugin Versies
                  </CardTitle>
                  <div className="flex gap-2">
                    {plugin.is_external && sitesWithPluginInstalled.length > 0 && (
                      <Button
                        onClick={() => setShowDownloadDialog(true)}
                        size="sm"
                        variant="outline"
                        className="bg-green-50 border-green-200 hover:bg-green-100"
                      >
                        <Download className="w-4 h-4 mr-2 text-green-600" />
                        Download van WP
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {sortedVersions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nog geen versies beschikbaar</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedVersions.map((version, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-indigo-200 transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">v{version.version}</h3>
                            {version.version === plugin.latest_version && (
                              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                                Nieuwste
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(version.created_at).toLocaleDateString('nl-NL', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            asChild
                          >
                            <a href={version.download_url} download>
                              <Download className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Weet je zeker dat je versie ${version.version} wilt verwijderen?`)) {
                                deleteVersionMutation.mutate(version.version);
                              }
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sites Section - Show only sites where plugin is installed AND user has access */}
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-600" />
                Geïnstalleerd op Sites ({sitesPluginInstalledOnAnySite.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {sitesPluginInstalledOnAnySite.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Deze plugin is nog niet geïnstalleerd op je sites</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {sitesPluginInstalledOnAnySite.map(site => {
                    const installation = plugin.installed_on?.find(i => i.site_id === site.id);
                    const installedVersion = installation?.version || "Unknown";
                    
                    // Check if user is owner of this site
                    const isOwner = site.owner_type === "user" && site.owner_id === user?.id;

                    return (
                      <Card key={site.id} className="border border-gray-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 truncate">{site.name}</h3>
                              <a
                                href={site.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline truncate"
                              >
                                {site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              </a>
                            </div>
                            <Badge className="bg-green-100 text-green-700 ml-2">
                              v{installedVersion}
                            </Badge>
                          </div>

                          <div className="flex gap-2">
                            {isOwner && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => uninstallPluginMutation.mutate({ siteId: site.id })}
                                disabled={uninstallPluginMutation.isPending}
                                className="flex-1 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Deïnstalleren
                              </Button>
                            )}
                            <Button size="sm" variant="outline" asChild className="flex-1">
                              <Link to={createPageUrl(`SiteDetail?id=${site.id}`)}>
                                <Settings className="w-4 h-4 mr-2" />
                                Site Bekijken
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nieuwe Versie Uploaden</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="version">Versie Nummer *</Label>
                <Input
                  id="version"
                  placeholder="1.0.0"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="file">Plugin ZIP Bestand *</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".zip"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleUploadVersion}
                  disabled={!newVersion || !selectedFile || uploadVersionMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {uploadVersionMutation.isPending ? "Uploaden..." : "Upload Versie"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadDialog(false);
                    setNewVersion("");
                    setSelectedFile(null);
                  }}
                >
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Toggle Dialog */}
        <Dialog open={showBulkToggleDialog} onOpenChange={setShowBulkToggleDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Bulk Toggle Beschikbaarheid</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Switch
                  checked={bulkToggleEnabled}
                  onCheckedChange={setBulkToggleEnabled}
                />
                <span className="text-sm font-medium">
                  {bulkToggleEnabled ? 'Beschikbaar maken' : 'Verbergen'} voor geselecteerde sites
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectAllSites(mySites)}
                >
                  Alles Selecteren
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={deselectAllSites}
                >
                  Alles Deselecteren
                </Button>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {mySites.map((site) => (
                  <div
                    key={site.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-indigo-200 transition-all"
                  >
                    <Checkbox
                      checked={selectedSites.includes(site.id)}
                      onCheckedChange={() => toggleSiteSelection(site.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{site.name}</p>
                      <p className="text-sm text-gray-500">{site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={handleBulkToggle}
                  disabled={selectedSites.length === 0 || bulkToggleAvailabilityMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {bulkToggleAvailabilityMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Bezig...
                    </>
                  ) : (
                    <>Toepassen op {selectedSites.length} site(s)</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowBulkToggleDialog(false)}>
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Update Dialog */}
        <Dialog open={showBulkUpdateDialog} onOpenChange={setShowBulkUpdateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Bulk Update Plugin</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <p className="text-sm text-gray-600">
                Selecteer de sites waar je de plugin wilt updaten naar de nieuwste versie.
              </p>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {sitesWithPluginForBulkUpdate.map((site) => {
                  const pluginData = getPluginStatusForSite(site.id);
                  const currentVersion = pluginData?.version || 'N/A';
                  const needsUpdate = currentVersion !== plugin.latest_version;

                  return (
                    <div
                      key={site.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        needsUpdate ? 'border-amber-200 bg-amber-50' : 'border-gray-200'
                      }`}
                    >
                      <Checkbox
                        checked={selectedUpdateSites.includes(site.id)}
                        onCheckedChange={() => toggleUpdateSiteSelection(site.id)}
                        disabled={!needsUpdate}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{site.name}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            Current: v{currentVersion}
                          </Badge>
                          {needsUpdate && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">
                              → v{plugin.latest_version}
                            </Badge>
                          )}
                          {!needsUpdate && (
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              Up-to-date
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => {
                    toast({
                      variant: "info",
                      title: "Update binnenkort beschikbaar",
                      description: "De bulk update functionaliteit wordt binnenkort toegevoegd.",
                    });
                    setShowBulkUpdateDialog(false);
                  }}
                  disabled={selectedUpdateSites.length === 0}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  Update {selectedUpdateSites.length} site(s)
                </Button>
                <Button variant="outline" onClick={() => setShowBulkUpdateDialog(false)}>
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Plugin Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Plugin Bewerken</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="edit-name">Plugin Naam</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Beschrijving</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="edit-author">Auteur</Label>
                <Input
                  id="edit-author"
                  value={editForm.author}
                  onChange={(e) => setEditForm({...editForm, author: e.target.value})}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleEditSave} 
                  disabled={editPluginMutation.isPending} 
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {editPluginMutation.isPending ? "Opslaan..." : "Opslaan"}
                </Button>
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Transfer Ownership Dialog */}
        <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eigendom Overdragen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <p className="text-sm text-gray-600">
                Draag het eigendom van deze plugin over naar een ander gebruiker of team.
              </p>
              <div>
                <Label htmlFor="transfer-user">Overdragen aan Gebruiker</Label>
                <Select
                  value={transferToUserId}
                  onValueChange={(value) => {
                    setTransferToUserId(value);
                    setTransferToTeamId(""); // Clear team selection when user is selected
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer gebruiker" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.filter(u => u.id !== user?.id).map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-center text-sm text-gray-500">of</div>
              <div>
                <Label htmlFor="transfer-team">Overdragen aan Team</Label>
                <Select
                  value={transferToTeamId}
                  onValueChange={(value) => {
                    setTransferToTeamId(value);
                    setTransferToUserId(""); // Clear user selection when team is selected
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer team" />
                  </SelectTrigger>
                  <SelectContent>
                    {userTeams.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleTransfer}
                  disabled={(!transferToUserId && !transferToTeamId) || transferOwnershipMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {transferOwnershipMutation.isPending ? "Overdragen..." : "Overdragen"}
                </Button>
                <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Share with Teams Dialog */}
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delen met Teams</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <p className="text-sm text-gray-600">
                Selecteer de teams waarmee je deze plugin wilt delen.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {userTeams.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Geen teams beschikbaar.</p>
                ) : (
                  userTeams.map(team => (
                    <div key={team.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <input
                        type="checkbox"
                        checked={selectedTeamIds.includes(team.id)}
                        onChange={() => toggleTeamSelection(team.id)}
                        className="w-4 h-4"
                      />
                      <div>
                        <p className="font-medium">{team.name}</p>
                        <p className="text-xs text-gray-500">{team.description}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleShareSave} 
                  disabled={shareWithTeamsMutation.isPending} 
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {shareWithTeamsMutation.isPending ? "Opslaan..." : "Opslaan"}
                </Button>
                <Button variant="outline" onClick={() => setShowShareDialog(false)}>
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Download from WordPress Dialog */}
        <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Download Plugin van WordPress</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Download plugin bestanden van een WordPress site</strong>
                </p>
                <p className="text-xs text-blue-700">
                  Deze functie downloadt de volledige plugin folder van de geselecteerde site en voegt het toe als een nieuwe versie.
                  De versie informatie wordt automatisch uit de plugin bestanden gelezen.
                </p>
              </div>

              <div>
                <Label htmlFor="download-site">Selecteer Site</Label>
                <Select value={selectedDownloadSite} onValueChange={setSelectedDownloadSite}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer een site waar de plugin is geïnstalleerd" />
                  </SelectTrigger>
                  <SelectContent>
                    {sitesWithPluginInstalled.map(site => {
                      const pluginData = getPluginStatusForSite(site.id);
                      return (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name} - v{pluginData?.version || 'N/A'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {sitesWithPluginInstalled.length === 0 && (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800">
                    Deze plugin is niet geïnstalleerd op een van je sites.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={handleDownloadFromWordPress}
                  disabled={!selectedDownloadSite || downloadFromWordPressMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {downloadFromWordPressMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Downloaden...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download & Importeer
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowDownloadDialog(false)}>
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Message Dialog */}
        <SendMessageDialog
          open={showMessageDialog}
          onOpenChange={setShowMessageDialog}
          user={user}
          toUserId={plugin.owner_type === "user" ? plugin.owner_id : null}
          toUserName={plugin.owner_type === "user" ? ownerUser?.full_name : null}
          context={{
            type: "plugin",
            id: plugin.id,
            name: plugin.name
          }}
          isAdminAction={isAdmin}
        />

        {/* Notification Dialog */}
        {isAdmin && (
          <SendNotificationDialog
            open={showNotificationDialog}
            onOpenChange={setShowNotificationDialog}
            user={user}
            context={{
              type: "plugin",
              id: plugin.id,
              name: plugin.name
            }}
          />
        )}
      </div>
    </div>
  );
}
