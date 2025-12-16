import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Globe,
  ArrowLeft,
  Package,
  Palette,
  Loader2,
  ExternalLink,
  Crown,
  Users,
  Trash2,
  Wifi,
  BarChart3,
  Plus,
  Edit,
  Share2,
  UserPlus,
  CheckCircle,
  Search,
  Star,
  Download as DownloadIcon,
  RefreshCw,
  ArrowUp,
  AlertTriangle,
  Mail,
  Bell,
  Activity,
  Shield,
  Zap,
  Clock,
  TrendingUp,
  AlertCircle,
  XCircle,
  Bug,
  ArrowRight,
  CalendarIcon,
  Check,
  X,
  ShieldCheck
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import SendMessageDialog from "../components/messaging/SendMessageDialog";
import SendNotificationDialog from "../components/messaging/SendNotificationDialog";

export default function SiteDetail() {
  const [user, setUser] = useState(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showUpdatePlatformDialog, setShowUpdatePlatformDialog] = useState(false);
  // Removed showTransferAcceptDialog state as it's now an inline section
  const [selectedPluginForPlatformUpdate, setSelectedPluginForPlatformUpdate] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", url: "" });
  const [transferToUserId, setTransferToUserId] = useState("");
  const [transferToTeamId, setTransferToTeamId] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [wpSearchQuery, setWpSearchQuery] = useState("");
  const [wpSearchResults, setWpSearchResults] = useState([]);
  const [isSearchingWp, setIsSearchingWp] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [showInstallThemeDialog, setShowInstallThemeDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [wpThemeSearchQuery, setWpThemeSearchQuery] = useState("");
  const [wpThemeSearchResults, setWpThemeSearchResults] = useState([]);
  const [isSearchingWpThemes, setIsSearchingWpThemes] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(null);
  const [selectedPluginsForTransfer, setSelectedPluginsForTransfer] = useState([]);
  const [nonTransferAction, setNonTransferAction] = useState("disconnect");
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const siteId = urlParams.get("id");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: site } = useQuery({
    queryKey: ['site', siteId],
    queryFn: () => base44.entities.Site.get(siteId),
    enabled: !!siteId,
  });

  const { data: wpPlugins = [], isLoading: isLoadingWpPlugins, refetch: refetchWpPlugins } = useQuery({
    queryKey: ['wp-plugins', siteId],
    queryFn: async () => {
      const response = await base44.functions.invoke('listSitePlugins', { site_id: siteId });
      return response.data.plugins || [];
    },
    enabled: !!siteId,
    refetchInterval: 30000,
    initialData: [],
  });

  const { data: wpThemes = [], isLoading: isLoadingWpThemes, refetch: refetchWpThemes } = useQuery({
    queryKey: ['wp-themes', siteId],
    queryFn: async () => {
      const response = await base44.functions.invoke('listSiteThemes', { site_id: siteId });
      return response.data.themes || [];
    },
    enabled: !!siteId,
    refetchInterval: 30000,
    initialData: [],
  });

  const { data: connectorVersionInfo } = useQuery({
    queryKey: ['connector-version', siteId],
    queryFn: async () => {
      const response = await base44.functions.invoke('getConnectorVersion', { site_id: siteId });
      return response.data;
    },
    enabled: !!siteId,
    refetchInterval: 60000,
  });

  const { data: myPlugins = [] } = useQuery({
    queryKey: ['my-plugins', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const allPlugins = await base44.entities.Plugin.list();
      return allPlugins.filter(p => p.owner_type === "user" && p.owner_id === user.id);
    },
    enabled: !!user,
    initialData: [],
  });

  const { data: myThemes = [] } = useQuery({
    queryKey: ['my-themes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const allThemes = await base44.entities.Theme.list();
      return allThemes.filter(t => t.owner_type === "user" && t.owner_id === user.id);
    },
    enabled: !!user,
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

  useEffect(() => {
    if (site && showEditDialog) {
      setEditForm({ name: site.name, url: site.url });
    }
  }, [site, showEditDialog]);

  useEffect(() => {
    if (site && showShareDialog) {
      setSelectedTeamIds(site.shared_with_teams || []);
    }
  }, [site, showShareDialog]);

  // Initialize transfer-related states when a pending transfer request is detected
  useEffect(() => {
    if (site?.transfer_request?.status === 'pending') {
      const allPlugins = myPlugins.filter(p =>
        p.installed_on?.some(install => install.site_id === siteId)
      );
      // Pre-select plugins that can be fully transferred (only on this site)
      const transferable = allPlugins
        .filter(p => p.installed_on?.length === 1)
        .map(p => p.id);

      setSelectedPluginsForTransfer(transferable);
      setNonTransferAction("disconnect"); // Default value
      setScheduledDate(null); // Reset scheduled date
    }
  }, [site, myPlugins, siteId]); // Re-run if site or myPlugins data changes

  const compareVersions = (v1, v2) => {
    if (!v1 || !v2) return 0;
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  };

  const acceptSiteTransferMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('acceptSiteTransfer', {
        site_id: siteId,
        scheduled_transfer_date: scheduledDate ? scheduledDate.toISOString() : null,
        transfer_plugins: selectedPluginsForTransfer,
        non_transfer_action: nonTransferAction
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', siteId] });
      queryClient.invalidateQueries({ queryKey: ['my-plugins'] });
      // Removed setShowTransferAcceptDialog(false)
      setScheduledDate(null);
      setSelectedPluginsForTransfer([]);
      alert('✅ Site overdracht geaccepteerd');
    },
    onError: (error) => {
      alert('❌ Fout bij accepteren: ' + error.message);
    }
  });

  const declineSiteTransferMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('declineSiteTransfer', {
        site_id: siteId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', siteId] });
      alert('✅ Overdrachtverzoek afgewezen');
    },
    onError: (error) => {
      alert('❌ Fout bij afwijzen: ' + error.message);
    }
  });

  const performHealthCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('performHealthCheck', {
        site_id: siteId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', siteId] });
      alert('✅ Health check voltooid');
    },
    onError: (error) => {
      alert('❌ Health check mislukt: ' + error.message);
    }
  });

  const updateDebugSettingsMutation = useMutation({
    mutationFn: async (settings) => {
      const response = await base44.functions.invoke('updateDebugSettings', {
        site_id: siteId,
        ...settings
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', siteId] });
      alert('✅ Debug instellingen bijgewerkt');
    },
    onError: (error) => {
      alert('❌ Fout bij updaten: ' + error.message);
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('testSiteConnection', {
        site_id: siteId
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['site', siteId] });
      queryClient.invalidateQueries({ queryKey: ['wp-plugins', siteId] });
      if (data.success) {
        alert(`✅ ${data.message}\n\nWP Versie: ${data.wp_version || 'N/A'}\nPlugins: ${data.plugins_count || 0}`);
        setTimeout(() => refetchWpPlugins(), 1000);
      } else {
        alert(`❌ Verbinding mislukt\n\n${data.error}`);
      }
    },
  });

  const updateConnectorMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('updateConnectorPlugin', {
        site_id: siteId
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['connector-version'] });
      queryClient.invalidateQueries({ queryKey: ['wp-plugins'] });
      if (data.success) {
        alert(`✅ ${data.message}\n\nNieuwe versie: ${data.new_version}`);
      } else {
        alert(`❌ Update mislukt\n\n${data.error}`);
      }
    },
    onError: (error) => {
      alert('❌ Fout bij updaten: ' + error.message);
    }
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();

      const allPlugins = await base44.entities.Plugin.list();
      for (const plugin of allPlugins) {
        const installedOn = plugin.installed_on || [];
        const updatedInstalledOn = installedOn.filter(entry => entry.site_id !== siteId);

        if (installedOn.length !== updatedInstalledOn.length) {
          await base44.entities.Plugin.update(plugin.id, {
            installed_on: updatedInstalledOn
          });
        }
      }

      await base44.entities.ActivityLog.create({
        user_email: user.email,
        action: `Site verwijderd: ${site.name}`,
        entity_type: "site",
        details: site.url
      });

      return base44.entities.Site.delete(siteId);
    },
    onSuccess: () => {
      window.location.href = createPageUrl("Sites");
    },
  });

  const installPluginMutation = useMutation({
    mutationFn: async ({ plugin_id, download_url }) => {
      const response = await base44.functions.invoke('installPlugin', {
        site_id: siteId,
        plugin_id,
        download_url
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wp-plugins'] });
      queryClient.invalidateQueries({ queryKey: ['my-plugins'] });
      setShowInstallDialog(false);
      refetchWpPlugins();
      alert('✅ Plugin succesvol geïnstalleerd');
    },
    onError: (error) => {
      alert('❌ Fout bij installeren: ' + error.message);
    }
  });

  const updatePluginMutation = useMutation({
    mutationFn: async ({ plugin_slug, plugin_id, download_url }) => {
      const response = await base44.functions.invoke('updatePlugin', {
        site_id: siteId,
        plugin_slug,
        plugin_id,
        download_url
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wp-plugins'] });
      queryClient.invalidateQueries({ queryKey: ['my-plugins'] });
      refetchWpPlugins();
      alert(`✅ Plugin succesvol geüpdatet naar versie ${data.version}`);
    },
    onError: (error) => {
      alert('❌ Fout bij updaten: ' + error.message);
    }
  });

  const togglePluginStateMutation = useMutation({
    mutationFn: async (pluginSlug) => {
      const response = await base44.functions.invoke('togglePluginState', {
        site_id: siteId,
        plugin_slug: pluginSlug
      });
      return response.data;
    },
    onSuccess: () => {
      refetchWpPlugins();
    },
    onError: (error) => {
      alert('❌ Fout bij toggle: ' + error.message);
    }
  });

  const uninstallPluginMutation = useMutation({
    mutationFn: async ({ pluginSlug, pluginId }) => {
      const response = await base44.functions.invoke('uninstallPlugin', {
        site_id: siteId,
        plugin_slug: pluginSlug,
        plugin_id: pluginId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wp-plugins'] });
      queryClient.invalidateQueries({ queryKey: ['my-plugins'] });
      refetchWpPlugins();
      alert('✅ Plugin succesvol gedeïnstalleerd');
    },
    onError: (error) => {
      alert('❌ Fout bij deïnstalleren: ' + error.message);
    }
  });

  const updatePlatformPluginMutation = useMutation({
    mutationFn: async ({ wpPlugin, platformPlugin }) => {
      const response = await base44.functions.invoke('downloadPluginFromWordPress', {
        site_id: siteId,
        plugin_slug: wpPlugin.slug
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to download plugin');
      }

      const { file_url, plugin_data } = response.data;

      const updatedVersions = [...(platformPlugin.versions || []), {
        version: plugin_data.version,
        download_url: file_url,
        created_at: new Date().toISOString()
      }];

      await base44.entities.Plugin.update(platformPlugin.id, {
        versions: updatedVersions,
        latest_version: plugin_data.version
      });

      return { version: plugin_data.version };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-plugins'] });
      setShowUpdatePlatformDialog(false);
      setSelectedPluginForPlatformUpdate(null);
      alert(`✅ Platform bijgewerkt naar versie ${data.version}`);
    },
    onError: (error) => {
      alert('❌ Fout bij updaten platform: ' + error.message);
    }
  });

  const editSiteMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Site.update(siteId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', siteId] });
      setShowEditDialog(false);
      alert('✅ Site succesvol bewerkt');
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
      return base44.entities.Site.update(siteId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', siteId] });
      setShowTransferDialog(false);
      setTransferToUserId("");
      setTransferToTeamId("");
      alert('✅ Eigendom succesvol overgedragen');
    },
  });

  const shareWithTeamsMutation = useMutation({
    mutationFn: async (teamIds) => {
      return base44.entities.Site.update(siteId, {
        shared_with_teams: teamIds
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', siteId] });
      setShowShareDialog(false);
      alert('✅ Delen met teams succesvol bijgewerkt');
    },
  });

  const handleSearchWpPlugins = async () => {
    if (!wpSearchQuery.trim()) return;

    setIsSearchingWp(true);
    try {
      const response = await base44.functions.invoke('searchWordPressPlugins', {
        search: wpSearchQuery,
        page: 1,
        per_page: 20
      });

      if (response.data.success) {
        setWpSearchResults(response.data.plugins);
      }
    } catch (error) {
      alert('❌ Fout bij zoeken: ' + error.message);
    }
    setIsSearchingWp(false);
  };

  const handleSearchWpThemes = async () => {
    if (!wpThemeSearchQuery.trim()) return;

    setIsSearchingWpThemes(true);
    try {
      const response = await base44.functions.invoke('searchWordPressThemes', {
        search: wpThemeSearchQuery,
        page: 1,
        per_page: 20
      });

      if (response.data.success) {
        setWpThemeSearchResults(response.data.themes);
      }
    } catch (error) {
      alert('❌ Fout bij zoeken: ' + error.message);
    }
    setIsSearchingWpThemes(false);
  };

  const handleInstallFromLibrary = (plugin) => {
    const latestVersion = plugin.versions?.[plugin.versions.length - 1];
    if (!latestVersion) {
      alert('❌ Geen versie beschikbaar voor deze plugin');
      return;
    }

    installPluginMutation.mutate({
      plugin_id: plugin.id,
      download_url: latestVersion.download_url
    });
  };

  const handleInstallFromWp = (wpPlugin) => {
    installPluginMutation.mutate({
      plugin_id: null,
      download_url: wpPlugin.download_url
    });
  };

  // Theme handlers
  const installThemeMutation = useMutation({
    mutationFn: async ({ theme_id, download_url }) => {
      const response = await base44.functions.invoke('installTheme', {
        site_id: siteId,
        theme_id,
        download_url
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wp-themes'] });
      queryClient.invalidateQueries({ queryKey: ['my-themes'] });
      setShowInstallThemeDialog(false);
      refetchWpThemes();
      alert('✅ Theme succesvol geïnstalleerd');
    },
    onError: (error) => {
      alert('❌ Fout bij installeren: ' + error.message);
    }
  });

  const activateThemeMutation = useMutation({
    mutationFn: async (themeSlug) => {
      const response = await base44.functions.invoke('activateTheme', {
        site_id: siteId,
        theme_slug: themeSlug
      });
      return response.data;
    },
    onSuccess: () => {
      refetchWpThemes();
      alert('✅ Theme succesvol geactiveerd');
    },
    onError: (error) => {
      alert('❌ Fout bij activeren: ' + error.message);
    }
  });

  const uninstallThemeMutation = useMutation({
    mutationFn: async ({ themeSlug, themeId }) => {
      const response = await base44.functions.invoke('uninstallTheme', {
        site_id: siteId,
        theme_slug: themeSlug,
        theme_id: themeId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wp-themes'] });
      queryClient.invalidateQueries({ queryKey: ['my-themes'] });
      refetchWpThemes();
      alert('✅ Theme succesvol verwijderd');
    },
    onError: (error) => {
      alert('❌ Fout bij verwijderen: ' + error.message);
    }
  });

  const handleInstallThemeFromLibrary = (theme) => {
    const latestVersion = theme.versions?.[theme.versions.length - 1];
    if (!latestVersion) {
      alert('❌ Geen versie beschikbaar voor dit theme');
      return;
    }

    installThemeMutation.mutate({
      theme_id: theme.id,
      download_url: latestVersion.download_url
    });
  };

  const handleInstallThemeFromWp = (wpTheme) => {
    installThemeMutation.mutate({
      theme_id: null,
      download_url: wpTheme.download_url
    });
  };

  const handleActivateTheme = (wpTheme) => {
    activateThemeMutation.mutate(wpTheme.slug);
  };

  const handleUninstallTheme = (wpTheme) => {
    if (wpTheme.status === 'active') {
      alert('❌ Je kunt het actieve theme niet verwijderen. Activeer eerst een ander theme.');
      return;
    }
    
    const platformTheme = myThemes.find(t => t.slug === wpTheme.slug);
    
    if (confirm(`Weet je zeker dat je ${wpTheme.name} wilt verwijderen?`)) {
      uninstallThemeMutation.mutate({
        themeSlug: wpTheme.slug,
        themeId: platformTheme?.id
      });
    }
  };

  const handleToggleActivation = async (wpPlugin) => {
    await togglePluginStateMutation.mutateAsync(wpPlugin.slug);
  };

  const handleUpdateToLatest = (wpPlugin, platformPlugin) => {
    const latestVersion = platformPlugin.versions?.[platformPlugin.versions.length - 1];
    if (!latestVersion) {
      alert('❌ Geen versie beschikbaar');
      return;
    }

    updatePluginMutation.mutate({
      plugin_slug: wpPlugin.slug,
      plugin_id: platformPlugin.id,
      download_url: latestVersion.download_url
    });
  };

  const handleOpenUpdatePlatformDialog = (wpPlugin, platformPlugin) => {
    setSelectedPluginForPlatformUpdate({ wpPlugin, platformPlugin });
    setShowUpdatePlatformDialog(true);
  };

  const handleUpdatePlatformPlugin = () => {
    if (selectedPluginForPlatformUpdate) {
      updatePlatformPluginMutation.mutate(selectedPluginForPlatformUpdate);
    }
  };

  const handleUninstallPlugin = (wpPlugin) => {
    const platformPlugin = myPlugins.find(p => p.slug === wpPlugin.slug);

    if (confirm(`Weet je zeker dat je ${wpPlugin.name} wilt deïnstalleren?`)) {
      uninstallPluginMutation.mutate({
        pluginSlug: wpPlugin.slug,
        pluginId: platformPlugin?.id
      });
    }
  };

  const handleEditSave = () => {
    if (editForm.name && editForm.url) {
      editSiteMutation.mutate(editForm);
    } else {
      alert("Naam en URL mogen niet leeg zijn.");
    }
  };

  const handleTransfer = () => {
    if (!transferToUserId && !transferToTeamId) {
      alert("Selecteer een gebruiker of team.");
      return;
    }
    if (confirm("Weet je zeker dat je het eigendom wilt overdragen?")) {
      transferOwnershipMutation.mutate({
        toUserId: transferToUserId,
        toTeamId: transferToTeamId
      });
    }
  };

  const handleShareSave = () => {
    shareWithTeamsMutation.mutate(selectedTeamIds);
  };

  const handleDeleteSite = () => {
    if (confirm(`Weet je zeker dat je site "${site.name}" wilt verwijderen?`)) {
      deleteSiteMutation.mutate();
    }
  };

  const toggleTeamSelection = (teamId) => {
    setSelectedTeamIds(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const togglePluginSelection = (pluginId) => {
    setSelectedPluginsForTransfer(prev =>
      prev.includes(pluginId)
        ? prev.filter(id => id !== pluginId)
        : [...prev, pluginId]
    );
  };

  // Removed handleOpenTransferAcceptDialog as its logic is now within a useEffect and the section is inline.

  const canManageSite = () => {
    if (!user || !site) return false;

    if (site.owner_type === "user" && site.owner_id === user.id) return true;
    if (site.owner_type === "team") {
      const team = userTeams.find(t => t.id === site.owner_id);
      if (team?.owner_id === user.id) return true;

      const member = team?.members?.find(m => m.user_id === user.id);
      if (member?.permissions?.manage_sites) return true;
    }
    return false;
  };

  const getHealthStatusColor = (status) => {
    const colors = {
      healthy: "bg-green-100 text-green-700 border-green-200",
      warning: "bg-amber-100 text-amber-700 border-amber-200",
      critical: "bg-red-100 text-red-700 border-red-200",
      unknown: "bg-gray-100 text-gray-700 border-gray-200"
    };
    return colors[status] || colors.unknown;
  };

  const getHealthStatusIcon = (status) => {
    const icons = {
      healthy: <CheckCircle className="w-5 h-5 text-green-600" />,
      warning: <AlertTriangle className="w-5 h-5 text-amber-600" />,
      critical: <XCircle className="w-5 h-5 text-red-600" />,
      unknown: <AlertCircle className="w-5 h-5 text-gray-600" />
    };
    return icons[status] || icons.unknown;
  };

  const getPerformanceColor = (score) => {
    const colors = {
      excellent: "text-green-600",
      good: "text-blue-600",
      fair: "text-amber-600",
      poor: "text-red-600"
    };
    return colors[score] || "text-gray-600";
  };


  if (!site) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const canManage = canManageSite();
  const ownerUser = allUsers.find(u => u.id === site.owner_id);
  const isTeamOwned = site.owner_type === "team";
  const ownerTeam = isTeamOwned ? userTeams.find(t => t.id === site.owner_id) : null;
  const isAdmin = user?.role === "admin";
  const healthCheck = site.health_check || { status: 'unknown' };
  const hasPendingTransfer = site.transfer_request && site.transfer_request.status === 'pending';
  // requesterUser is no longer used for the banner action buttons, but it's still useful for display in the info banner and new section
  const requesterUser = hasPendingTransfer ? allUsers.find(u => u.id === site.transfer_request.requested_by_user_id) : null;


  const availableLibraryPlugins = myPlugins.filter(plugin => {
    return !wpPlugins.some(wp => wp.slug === plugin.slug);
  });

  const availableLibraryThemes = myThemes.filter(theme => {
    return !wpThemes.some(wp => wp.slug === theme.slug);
  });

  const activePluginsCount = wpPlugins.filter(p => p.status === 'active').length;
  const activeTheme = wpThemes.find(t => t.status === 'active');

  const hasConnectorUpdate = connectorVersionInfo?.success && connectorVersionInfo?.update_available;

  // Get all plugins installed on this site
  const sitePlugins = myPlugins.filter(p =>
    p.installed_on?.some(install => install.site_id === siteId)
  );

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" asChild>
            <Link to={createPageUrl("Sites")}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{site.name}</h1>
            <a
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-indigo-600 mt-1 inline-flex items-center gap-1 hover:underline text-sm"
            >
              {site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          
          {isTeamOwned ? (
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
              <Users className="w-3 h-3 mr-1" />
              {ownerTeam?.name || "Team"}
            </Badge>
          ) : site.owner_id === user?.id ? (
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
              <Crown className="w-3 h-3 mr-1" />
              Eigenaar
            </Badge>
          ) : null}

          {/* Admin Actions Container */}
          {isAdmin && (
            <div className="flex items-center gap-2 ml-4 pl-4 border-l-2 border-purple-300">
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

        {/* Transfer Request Banner - Info Only, No Action Buttons */}
        {/* Removed - the inline section below now handles the info and actions */}

        {hasConnectorUpdate && canManage && (
          <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 mb-6 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Connector Update Beschikbaar</p>
                    <p className="text-sm text-gray-600">
                      Huidige versie: v{connectorVersionInfo.current_version} → Nieuwe versie: v{connectorVersionInfo.latest_version}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (confirm('Weet je zeker dat je de connector wilt updaten? De site zal kort onbereikbaar zijn tijdens de update.')) {
                      updateConnectorMutation.mutate();
                    }
                  }}
                  disabled={updateConnectorMutation.isPending}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {updateConnectorMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updaten...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Update Connector
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">
              <Globe className="w-4 h-4 mr-2" />
              Overzicht
            </TabsTrigger>
            <TabsTrigger value="plugins">
              <Package className="w-4 h-4 mr-2" />
              Plugins
            </TabsTrigger>
            <TabsTrigger value="themes">
              <Palette className="w-4 h-4 mr-2" />
              Themes
            </TabsTrigger>
            <TabsTrigger value="health">
              <Activity className="w-4 h-4 mr-2" />
              Health Check
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6 mb-8">
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-gray-100 pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    Site Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">WP Versie</span>
                    <span className="text-sm font-semibold">{site.wp_version || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Status</span>
                    <Badge className={site.connection_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                      {site.connection_status === 'active' ? 'Actief' : 'Inactief'}
                    </Badge>
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
                  {canManage && site.api_key && (
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">API Key</p>
                      <div className="bg-gray-50 p-2 rounded border border-gray-200">
                        <code className="text-xs font-mono break-all">{site.api_key}</code>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Gebruik deze key in de connector plugin</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-gray-100 pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    Statistieken
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-indigo-50 rounded-lg">
                      <p className="text-xs text-indigo-600 mb-1">Totaal</p>
                      <p className="text-2xl font-bold text-indigo-700">{wpPlugins.length}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-green-600 mb-1">Actief</p>
                      <p className="text-2xl font-bold text-green-700">{activePluginsCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-gray-100 pb-3">
                  <CardTitle className="text-sm">Acties</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <TooltipProvider>
                    <div className="flex gap-2 justify-center flex-wrap">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => refetchWpPlugins()}
                            disabled={isLoadingWpPlugins}
                            size="icon"
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white h-12 w-12"
                          >
                            {isLoadingWpPlugins ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-5 h-5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ververs Plugin Lijst</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => testConnectionMutation.mutate()}
                            disabled={testConnectionMutation.isPending}
                            size="icon"
                            variant="outline"
                            className="h-12 w-12"
                          >
                            {testConnectionMutation.isPending ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Wifi className="w-5 h-5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Test Verbinding</TooltipContent>
                      </Tooltip>

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
                                onClick={handleDeleteSite}
                                disabled={deleteSiteMutation.isPending}
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              >
                                {deleteSiteMutation.isPending ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-5 h-5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Site Verwijderen</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </TooltipProvider>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="plugins" className="space-y-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-indigo-600" />
                    Geïnstalleerde Plugins ({wpPlugins.length})
                  </CardTitle>
                  {canManage && (
                    <Button
                      onClick={() => setShowInstallDialog(true)}
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Plugin Installeren
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isLoadingWpPlugins ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  </div>
                ) : wpPlugins.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium mb-2">Nog geen plugins geïnstalleerd</p>
                    <p className="text-sm">Klik op "Plugin Installeren" om te beginnen</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wpPlugins.map((wpPlugin) => {
                      const platformPlugin = myPlugins.find(p => p.slug === wpPlugin.slug);
                      const platformLatestVersion = platformPlugin?.latest_version;
                      const versionComparison = platformLatestVersion ? compareVersions(wpPlugin.version, platformLatestVersion) : 0;
                      const needsUpdate = versionComparison === -1;
                      const newerOnSite = versionComparison === 1;

                      return (
                        <div
                          key={wpPlugin.slug}
                          className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-indigo-200 transition-all"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 bg-gradient-to-br rounded-lg flex items-center justify-center ${
                                wpPlugin.status === 'active'
                                  ? 'from-green-100 to-green-200'
                                  : 'from-gray-100 to-gray-200'
                              }`}>
                                <Package className={`w-5 h-5 ${
                                  wpPlugin.status === 'active' ? 'text-green-600' : 'text-gray-600'
                                }`} />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{wpPlugin.name}</p>
                                <div className="flex gap-2 mt-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs">
                                    v{wpPlugin.version}
                                  </Badge>
                                  {wpPlugin.status === 'active' && (
                                    <Badge className="bg-green-100 text-green-700 text-xs">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Actief
                                    </Badge>
                                  )}
                                  {needsUpdate && (
                                    <Badge className="bg-amber-100 text-amber-700 text-xs">
                                      <ArrowUp className="w-3 h-3 mr-1" />
                                      Update: v{platformLatestVersion}
                                    </Badge>
                                  )}
                                  {newerOnSite && (
                                    <Badge className="bg-blue-100 text-blue-700 text-xs">
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      Nieuwer op site
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {canManage && (
                            <div className="flex items-center gap-2 ml-4">
                              {needsUpdate && platformPlugin && (
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateToLatest(wpPlugin, platformPlugin)}
                                  disabled={updatePluginMutation.isPending}
                                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                                >
                                  {updatePluginMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  ) : (
                                    <ArrowUp className="w-4 h-4 mr-1" />
                                  )}
                                  Update
                                </Button>
                              )}
                              {newerOnSite && platformPlugin && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenUpdatePlatformDialog(wpPlugin, platformPlugin)}
                                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                                >
                                  <DownloadIcon className="w-4 h-4 mr-1" />
                                  Update Platform
                                </Button>
                              )}
                              <div className="flex items-center gap-2 border-l pl-2">
                                <span className="text-sm text-gray-600">
                                  {wpPlugin.status === 'active' ? 'Actief' : 'Inactief'}
                                </span>
                                <Switch
                                  checked={wpPlugin.status === 'active'}
                                  onCheckedChange={() => handleToggleActivation(wpPlugin)}
                                  disabled={togglePluginStateMutation.isPending}
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUninstallPlugin(wpPlugin)}
                                disabled={uninstallPluginMutation.isPending}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                {uninstallPluginMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4 mr-2" />
                                )}
                                Deïnstalleren
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="themes" className="space-y-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-purple-600" />
                    Geïnstalleerde Themes ({wpThemes.length})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchWpThemes()}
                      disabled={isLoadingWpThemes}
                    >
                      {isLoadingWpThemes ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                    {canManage && (
                      <Button
                        onClick={() => setShowInstallThemeDialog(true)}
                        className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Theme Installeren
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isLoadingWpThemes ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                  </div>
                ) : wpThemes.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Palette className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium mb-2">Nog geen themes gevonden</p>
                    <p className="text-sm">Controleer de verbinding met de site</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {wpThemes.map((wpTheme) => {
                      const platformTheme = myThemes.find(t => t.slug === wpTheme.slug);
                      const isActive = wpTheme.status === 'active';

                      return (
                        <Card
                          key={wpTheme.slug}
                          className={`border-2 transition-all ${
                            isActive 
                              ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50' 
                              : 'border-gray-200 hover:border-purple-200'
                          }`}
                        >
                          {wpTheme.screenshot && (
                            <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
                              <img 
                                src={wpTheme.screenshot} 
                                alt={wpTheme.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 truncate">{wpTheme.name}</h3>
                                <p className="text-xs text-gray-500">{wpTheme.author || 'Onbekend'}</p>
                              </div>
                              {isActive && (
                                <Badge className="bg-purple-100 text-purple-700 border-purple-200 ml-2">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Actief
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="outline" className="text-xs">
                                v{wpTheme.version}
                              </Badge>
                              {platformTheme && (
                                <Badge className="bg-indigo-100 text-indigo-700 text-xs">
                                  In Library
                                </Badge>
                              )}
                            </div>
                            {canManage && (
                              <div className="flex gap-2">
                                {!isActive && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleActivateTheme(wpTheme)}
                                    disabled={activateThemeMutation.isPending}
                                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                                  >
                                    {activateThemeMutation.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      'Activeren'
                                    )}
                                  </Button>
                                )}
                                {!isActive && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUninstallTheme(wpTheme)}
                                    disabled={uninstallThemeMutation.isPending}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health" className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Site Health Monitoring</h2>
                <p className="text-gray-500 mt-1">Monitor uptime, performance, security en updates</p>
              </div>
              <Button
                onClick={() => performHealthCheckMutation.mutate()}
                disabled={performHealthCheckMutation.isPending}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
              >
                {performHealthCheckMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Controleren...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Health Check Uitvoeren
                  </>
                )}
              </Button>
            </div>

            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2">
                  {getHealthStatusIcon(healthCheck.status)}
                  Algemene Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge className={`${getHealthStatusColor(healthCheck.status)} text-lg py-2 px-4`}>
                      {healthCheck.status.toUpperCase()}
                    </Badge>
                    {healthCheck.last_check && (
                      <p className="text-sm text-gray-500 mt-2">
                        Laatste check: {format(new Date(healthCheck.last_check), "d MMM yyyy HH:mm", { locale: nl })}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-gray-100">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    Uptime Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {healthCheck.uptime?.is_up !== undefined ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Status</span>
                        <Badge className={healthCheck.uptime.is_up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {healthCheck.uptime.is_up ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                      {healthCheck.uptime.response_time && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Response Time</span>
                          <span className="font-semibold">{healthCheck.uptime.response_time}ms</span>
                        </div>
                      )}
                      {healthCheck.uptime.uptime_percentage && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Uptime (30 dagen)</span>
                          <span className="font-semibold text-green-600">{healthCheck.uptime.uptime_percentage}%</span>
                        </div>
                      )}
                      {healthCheck.uptime.last_down && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Laatst Offline</span>
                          <span className="text-sm">{format(new Date(healthCheck.uptime.last_down), "d MMM HH:mm", { locale: nl })}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">Nog geen uptime data beschikbaar</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-gray-100">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {healthCheck.performance?.score ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Score</span>
                        <Badge className={`${getPerformanceColor(healthCheck.performance.score)}`}>
                          {healthCheck.performance.score.toUpperCase()}
                        </Badge>
                      </div>
                      {healthCheck.performance.page_load_time && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Page Load Time</span>
                          <span className="font-semibold">{healthCheck.performance.page_load_time}ms</span>
                        </div>
                      )}
                      {healthCheck.performance.ttfb && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Time to First Byte</span>
                          <span className="font-semibold">{healthCheck.performance.ttfb}ms</span>
                        </div>
                      )}
                      {healthCheck.performance.recommendations && healthCheck.performance.recommendations.length > 0 && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 mb-2">Aanbevelingen:</p>
                          <ul className="space-y-1">
                            {healthCheck.performance.recommendations.map((rec, idx) => (
                              <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                                <Zap className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">Nog geen performance data beschikbaar</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-gray-100">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-purple-600" />
                    Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {healthCheck.security ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">SSL/HTTPS</span>
                        <Badge className={healthCheck.security.ssl_valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {healthCheck.security.ssl_valid ? 'Geldig' : 'Niet Geldig'}
                        </Badge>
                      </div>
                      {healthCheck.security.vulnerabilities && healthCheck.security.vulnerabilities.length > 0 ? (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 mb-2">Gevonden Kwetsbaarheden:</p>
                          <div className="space-y-2">
                            {healthCheck.security.vulnerabilities.map((vuln, idx) => (
                              <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge className={
                                        vuln.severity === 'critical' ? 'bg-red-600 text-white' :
                                        vuln.severity === 'high' ? 'bg-orange-600 text-white' :
                                        vuln.severity === 'medium' ? 'bg-amber-600 text-white' :
                                        'bg-blue-600 text-white'
                                      }>
                                        {vuln.severity}
                                      </Badge>
                                      <span className="text-xs font-medium text-gray-900">{vuln.type}</span>
                                    </div>
                                    <p className="text-xs text-gray-700">{vuln.description}</p>
                                    {vuln.affected_plugin && (
                                      <p className="text-xs text-gray-500 mt-1">Plugin: {vuln.affected_plugin}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>Geen kwetsbaarheden gevonden</span>
                        </div>
                      )}
                      {healthCheck.security.last_scan && (
                        <p className="text-xs text-gray-500">
                          Laatste scan: {format(new Date(healthCheck.security.last_scan), "d MMM HH:mm", { locale: nl })}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">Nog geen security data beschikbaar</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-gray-100">
                  <CardTitle className="flex items-center gap-2">
                    <DownloadIcon className="w-5 h-5 text-indigo-600" />
                    Updates
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {healthCheck.updates ? (
                    <>
                      {healthCheck.updates.core && (
                        <div className="pb-3 border-b border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-700">WordPress Core</span>
                            {healthCheck.updates.core.update_available ? (
                              <Badge className="bg-amber-100 text-amber-700">Update Beschikbaar</Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-700">Up-to-date</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span>Huidige: {healthCheck.updates.core.current_version}</span>
                            {healthCheck.updates.core.update_available && (
                              <>
                                <ArrowRight className="w-3 h-3" />
                                <span className="font-semibold text-indigo-600">Nieuw: {healthCheck.updates.core.latest_version}</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {healthCheck.updates.plugins && healthCheck.updates.plugins.length > 0 && (
                        <div className="pb-3 border-b border-gray-100">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Plugin Updates ({healthCheck.updates.plugins.length})</p>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {healthCheck.updates.plugins.map((plugin, idx) => (
                              <div key={idx} className="text-xs text-gray-600 flex items-center justify-between">
                                <span className="truncate flex-1">{plugin.name}</span>
                                <span className="ml-2 text-indigo-600 font-medium whitespace-nowrap">
                                  {plugin.current_version} → {plugin.latest_version}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {healthCheck.updates.themes && healthCheck.updates.themes.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-2">Theme Updates ({healthCheck.updates.themes.length})</p>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {healthCheck.updates.themes.map((theme, idx) => (
                              <div key={idx} className="text-xs text-gray-600 flex items-center justify-between">
                                <span className="truncate flex-1">{theme.name}</span>
                                <span className="ml-2 text-indigo-600 font-medium whitespace-nowrap">
                                  {theme.current_version} → {theme.latest_version}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(!healthCheck.updates.plugins || healthCheck.updates.plugins.length === 0) &&
                       (!healthCheck.updates.themes || healthCheck.updates.themes.length === 0) &&
                       !healthCheck.updates.core?.update_available && (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>Alle updates zijn geïnstalleerd</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">Nog geen update data beschikbaar</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2">
                  <Bug className="w-5 h-5 text-orange-600" />
                  WordPress Debug Instellingen
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">WP_DEBUG</p>
                      <p className="text-xs text-gray-500 mt-1">Enable debugging mode</p>
                    </div>
                    <Switch
                      checked={healthCheck.debug_settings?.wp_debug || false}
                      onCheckedChange={(checked) =>
                        updateDebugSettingsMutation.mutate({
                          wp_debug: checked,
                          wp_debug_log: healthCheck.debug_settings?.wp_debug_log || false,
                          wp_debug_display: healthCheck.debug_settings?.wp_debug_display || false
                        })
                      }
                      disabled={updateDebugSettingsMutation.isPending}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">WP_DEBUG_LOG</p>
                      <p className="text-xs text-gray-500 mt-1">Log errors to file</p>
                    </div>
                    <Switch
                      checked={healthCheck.debug_settings?.wp_debug_log || false}
                      onCheckedChange={(checked) =>
                        updateDebugSettingsMutation.mutate({
                          wp_debug: healthCheck.debug_settings?.wp_debug || false,
                          wp_debug_log: checked,
                          wp_debug_display: healthCheck.debug_settings?.wp_debug_display || false
                        })
                      }
                      disabled={updateDebugSettingsMutation.isPending}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">WP_DEBUG_DISPLAY</p>
                      <p className="text-xs text-gray-500 mt-1">Display errors on screen</p>
                    </div>
                    <Switch
                      checked={healthCheck.debug_settings?.wp_debug_display || false}
                      onCheckedChange={(checked) =>
                        updateDebugSettingsMutation.mutate({
                          wp_debug: healthCheck.debug_settings?.wp_debug || false,
                          wp_debug_log: healthCheck.debug_settings?.wp_debug_log || false,
                          wp_debug_display: checked
                        })
                      }
                      disabled={updateDebugSettingsMutation.isPending}
                    />
                  </div>
                </div>
                <p className="text-xs text-amber-600 mt-4 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Let op: Debug mode alleen inschakelen tijdens development. Zet uit op productie sites.</span>
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Transfer Accept Section - At Bottom of Page */}
        {hasPendingTransfer && canManage && (
          <Card className="border-indigo-200 bg-white mt-8 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                Site Overdracht Afhandelen
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    <strong>{site.transfer_request?.requested_by_user_name}</strong> verzoekt om overdracht van deze site.
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Ingediend op: {format(new Date(site.transfer_request?.request_date), "d MMM yyyy HH:mm", { locale: nl })}
                  </p>
                </div>

                {/* Date Picker */}
                <div>
                  <Label>Geplande Overdrachtsdatum (optioneel)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal mt-2">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate ? format(scheduledDate, "PPP", { locale: nl }) : "Selecteer datum"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-gray-500 mt-1">
                    Als je geen datum selecteert, wordt de overdracht direct uitgevoerd.
                  </p>
                </div>

                {/* Plugin Transfer Selection */}
                {sitePlugins.length > 0 && (
                  <div>
                    <Label className="mb-3 block">Plugin Overdracht</Label>
                    <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-4">
                      {sitePlugins.map((plugin) => {
                        const canTransfer = plugin.installed_on?.length === 1;
                        const isSelected = selectedPluginsForTransfer.includes(plugin.id);

                        return (
                          <div key={plugin.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => togglePluginSelection(plugin.id)}
                              disabled={!canTransfer}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm text-gray-900">{plugin.name}</p>
                              <p className="text-xs text-gray-600 mt-1">
                                {canTransfer ? (
                                  <span className="text-green-600">✓ Kan worden overgedragen</span>
                                ) : (
                                  <span className="text-amber-600">
                                    ⚠ Geïnstalleerd op {plugin.installed_on?.length} sites - kan niet worden overgedragen
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Non-transfer action */}
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <Label className="mb-2 block text-sm">
                        Wat moet er gebeuren met plugins die niet worden overgedragen?
                      </Label>
                      <Select value={nonTransferAction} onValueChange={setNonTransferAction}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer actie" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="disconnect">Loskoppelen van platform (blijven geïnstalleerd op site)</SelectItem>
                          <SelectItem value="uninstall">Deïnstalleren van site</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm('Weet je zeker dat je dit overdrachtverzoek wilt weigeren?')) {
                        declineSiteTransferMutation.mutate();
                      }
                    }}
                    disabled={declineSiteTransferMutation.isPending}
                    className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                  >
                    {declineSiteTransferMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Weigeren...
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 mr-2" />
                        Verzoek Weigeren
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => acceptSiteTransferMutation.mutate()}
                    disabled={acceptSiteTransferMutation.isPending}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                  >
                    {acceptSiteTransferMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Accepteren...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Overdracht Accepteren
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Theme Install Dialog */}
        <Dialog open={showInstallThemeDialog} onOpenChange={setShowInstallThemeDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Theme Installeren</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="library" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="library">
                  <Palette className="w-4 h-4 mr-2" />
                  Mijn Library ({availableLibraryThemes.length})
                </TabsTrigger>
                <TabsTrigger value="wordpress">
                  <Globe className="w-4 h-4 mr-2" />
                  WordPress Library
                </TabsTrigger>
              </TabsList>

              <TabsContent value="library" className="space-y-4 mt-4">
                {availableLibraryThemes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Palette className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Alle themes uit je library zijn al geïnstalleerd</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {availableLibraryThemes.map((theme) => (
                      <Card key={theme.id} className="border">
                        {theme.screenshot_url && (
                          <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
                            <img 
                              src={theme.screenshot_url} 
                              alt={theme.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 truncate">{theme.name}</h3>
                              <p className="text-xs text-gray-500 mt-1">{theme.author || 'Onbekend'}</p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2 mb-3">
                            {theme.description || 'Geen beschrijving'}
                          </p>
                          <div className="flex items-center justify-between pt-2 border-t">
                            <Badge variant="outline" className="text-xs">
                              v{theme.latest_version}
                            </Badge>
                            <Button
                              size="sm"
                              onClick={() => handleInstallThemeFromLibrary(theme)}
                              disabled={installThemeMutation.isPending}
                              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                            >
                              Installeren
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="wordpress" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="wp-theme-search">Zoek in WordPress Theme Directory</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="wp-theme-search"
                      placeholder="Bijv: Astra, OceanWP..."
                      value={wpThemeSearchQuery}
                      onChange={(e) => setWpThemeSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchWpThemes()}
                    />
                    <Button
                      onClick={handleSearchWpThemes}
                      disabled={isSearchingWpThemes || !wpThemeSearchQuery.trim()}
                    >
                      {isSearchingWpThemes ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {wpThemeSearchResults.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {wpThemeSearchResults.map((wpTheme) => {
                      const alreadyInstalled = wpThemes.some(t => t.slug === wpTheme.slug);

                      return (
                        <Card key={wpTheme.slug} className="border">
                          {wpTheme.screenshot_url && (
                            <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
                              <img 
                                src={wpTheme.screenshot_url} 
                                alt={wpTheme.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 truncate">{wpTheme.name}</h3>
                                <p className="text-xs text-gray-500 mt-1">{wpTheme.author}</p>
                              </div>
                              {alreadyInstalled && (
                                <Badge className="bg-green-100 text-green-700 ml-2">
                                  Geïnstalleerd
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-yellow-500" fill="currentColor" />
                                <span>{wpTheme.rating}%</span>
                              </div>
                              <div>
                                <DownloadIcon className="w-3 h-3 inline mr-1" />
                                {wpTheme.active_installs?.toLocaleString()}+ actief
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t">
                              <Badge variant="outline" className="text-xs">
                                v{wpTheme.version}
                              </Badge>
                              <Button
                                size="sm"
                                onClick={() => handleInstallThemeFromWp(wpTheme)}
                                disabled={alreadyInstalled || installThemeMutation.isPending}
                                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                              >
                                {alreadyInstalled ? 'Geïnstalleerd' : 'Installeren'}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Plugin Installeren</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="library" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="library">
                  <Package className="w-4 h-4 mr-2" />
                  Mijn Library ({availableLibraryPlugins.length})
                </TabsTrigger>
                <TabsTrigger value="wordpress">
                  <Globe className="w-4 h-4 mr-2" />
                  WordPress Library
                </TabsTrigger>
              </TabsList>

              <TabsContent value="library" className="space-y-4 mt-4">
                {availableLibraryPlugins.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Alle plugins uit je library zijn al geïnstalleerd</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {availableLibraryPlugins.map((plugin) => (
                      <Card key={plugin.id} className="border">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base truncate">{plugin.name}</CardTitle>
                              <p className="text-xs text-gray-500 mt-1">{plugin.author || 'Onbekend'}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-xs text-gray-600 line-clamp-2 min-h-[2rem]">
                            {plugin.description || 'Geen beschrijving'}
                          </p>
                          <div className="flex items-center justify-between pt-2 border-t">
                            <Badge variant="outline" className="text-xs">
                              v{plugin.latest_version}
                            </Badge>
                            <Button
                              size="sm"
                              onClick={() => handleInstallFromLibrary(plugin)}
                              disabled={installPluginMutation.isPending}
                              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                            >
                              Installeren
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="wordpress" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="wp-search">Zoek in WordPress Plugin Directory</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="wp-search"
                      placeholder="Bijv: Yoast SEO, Contact Form 7..."
                      value={wpSearchQuery}
                      onChange={(e) => setWpSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchWpPlugins()}
                    />
                    <Button
                      onClick={handleSearchWpPlugins}
                      disabled={isSearchingWp || !wpSearchQuery.trim()}
                    >
                      {isSearchingWp ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {wpSearchResults.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {wpSearchResults.map((wpPlugin) => {
                      const alreadyInstalled = wpPlugins.some(p => p.slug === wpPlugin.slug);

                      return (
                        <Card key={wpPlugin.slug} className="border">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-base truncate">{wpPlugin.name}</CardTitle>
                                <p className="text-xs text-gray-500 mt-1">{wpPlugin.author}</p>
                              </div>
                              {alreadyInstalled && (
                                <Badge className="bg-green-100 text-green-700 ml-2">
                                  Geïnstalleerd
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-xs text-gray-600 line-clamp-2 min-h-[2rem]">
                              {wpPlugin.description}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-yellow-500" fill="currentColor" />
                                <span>{wpPlugin.rating}%</span>
                              </div>
                              <div>
                                <DownloadIcon className="w-3 h-3 inline mr-1" />
                                {wpPlugin.active_installs?.toLocaleString()}+ actief
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t">
                              <Badge variant="outline" className="text-xs">
                                v{wpPlugin.version}
                              </Badge>
                              <Button
                                size="sm"
                                onClick={() => handleInstallFromWp(wpPlugin)}
                                disabled={alreadyInstalled || installPluginMutation.isPending}
                                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                              >
                                {alreadyInstalled ? 'Geïnstalleerd' : 'Installeren'}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        <Dialog open={showUpdatePlatformDialog} onOpenChange={setShowUpdatePlatformDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Platform Plugin Updaten</DialogTitle>
            </DialogHeader>
            {selectedPluginForPlatformUpdate && (
              <div className="space-y-4 mt-4">
                <p className="text-sm text-gray-600">
                  De site heeft een nieuwere versie van <strong>{selectedPluginForPlatformUpdate.wpPlugin.name}</strong> dan het platform.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Site versie:</span>
                    <span className="font-semibold text-blue-700">v{selectedPluginForPlatformUpdate.wpPlugin.version}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Platform versie:</span>
                    <span className="font-semibold">v{selectedPluginForPlatformUpdate.platformPlugin.latest_version}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Wil je de plugin op het platform updaten naar de versie van deze site? De plugin wordt gedownload van de WordPress site en toegevoegd aan je library.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleUpdatePlatformPlugin}
                    disabled={updatePlatformPluginMutation.isPending}
                    className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                  >
                    {updatePlatformPluginMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updaten...
                      </>
                    ) : (
                      <>
                        <DownloadIcon className="w-4 h-4 mr-2" />
                        Platform Updaten
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowUpdatePlatformDialog(false);
                      setSelectedPluginForPlatformUpdate(null);
                    }}
                  >
                    Annuleren
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* The previous Dialog for Transfer Accept is removed, as it's now an inline section. */}

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Site Bewerken</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="edit-name">Site Naam</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-url">Site URL</Label>
                <Input
                  id="edit-url"
                  value={editForm.url}
                  onChange={(e) => setEditForm({...editForm, url: e.target.value})}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleEditSave}
                  disabled={editSiteMutation.isPending || !editForm.name || !editForm.url}
                  className="flex-1"
                >
                  {editSiteMutation.isPending ? "Opslaan..." : "Opslaan"}
                </Button>
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eigendom Overdragen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <p className="text-sm text-gray-600">
                Draag het eigendom van deze site over naar een andere gebruiker of team.
              </p>
              <div>
                <Label>Overdragen aan Gebruiker</Label>
                <Select
                  value={transferToUserId}
                  onValueChange={(value) => {
                    setTransferToUserId(value);
                    setTransferToTeamId("");
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
                <Label>Overdragen aan Team</Label>
                <Select
                  value={transferToTeamId}
                  onValueChange={(value) => {
                    setTransferToTeamId(value);
                    setTransferToUserId("");
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
                  className="flex-1"
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

        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delen met Teams</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <p className="text-sm text-gray-600">
                Selecteer de teams waarmee je deze site wilt delen.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto border p-2 rounded-lg">
                {userTeams.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Geen teams beschikbaar.</p>
                ) : (
                  userTeams.map(team => (
                    <div key={team.id} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedTeamIds.includes(team.id)}
                        onChange={() => toggleTeamSelection(team.id)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{team.name}</p>
                        <p className="text-xs text-gray-500">{team.description}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleShareSave} disabled={shareWithTeamsMutation.isPending} className="flex-1">
                  {shareWithTeamsMutation.isPending ? "Opslaan..." : "Opslaan"}
                </Button>
                <Button variant="outline" onClick={() => setShowShareDialog(false)}>
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <SendMessageDialog
          open={showMessageDialog}
          onOpenChange={setShowMessageDialog}
          toUserId={site.owner_type === "user" ? site.owner_id : null}
          toUserName={site.owner_type === "user" ? ownerUser?.full_name : null}
          toTeamId={site.owner_type === "team" ? site.owner_id : null}
          toTeamName={site.owner_type === "team" ? ownerTeam?.name : null}
          context={{
            type: "site",
            id: site.id,
            name: site.name
          }}
          isAdminAction={true}
        />

        {isAdmin && (
          <SendNotificationDialog
            open={showNotificationDialog}
            onOpenChange={setShowNotificationDialog}
            user={user}
            context={{
              type: "site",
              id: site.id,
              name: site.name
            }}
          />
        )}
      </div>
    </div>
  );
}