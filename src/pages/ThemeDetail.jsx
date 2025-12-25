import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Crown,
  Download,
  Edit,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  Palette,
  Plus,
  Share2,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Settings,
  ShieldCheck
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

const decodeHtmlEntities = (text) => {
  if (!text) return text;
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
};

export default function ThemeDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const themeId = urlParams.get("id");
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
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

  const { data: theme } = useQuery({
    queryKey: ['theme', themeId],
    queryFn: () => base44.entities.Theme.get(themeId),
  });

  useEffect(() => {
    if (theme && showEditDialog) {
      setEditForm({
        name: theme.name,
        description: theme.description || "",
        author: theme.author || ""
      });
    }
  }, [theme, showEditDialog]);

  useEffect(() => {
    if (theme && showShareDialog) {
      setSelectedTeamIds(theme.shared_with_teams || []);
    }
  }, [theme, showShareDialog]);

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
      const { file_url } = await base44.integrations.Core.UploadFile({ file, bucket: 'Themes' });

      const versions = theme.versions || [];
      versions.push({
        version,
        download_url: file_url,
        created_at: new Date().toISOString()
      });

      await base44.entities.Theme.update(themeId, {
        versions,
        latest_version: version
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theme', themeId] });
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
      const versions = theme.versions.filter(v => v.version !== versionToDelete);
      const latestVersion = versions.length > 0
        ? versions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].version
        : null;

      await base44.entities.Theme.update(themeId, {
        versions,
        latest_version: latestVersion
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theme', themeId] });
      toast({
        variant: "success",
        title: "Versie verwijderd",
        description: "De versie is succesvol verwijderd",
      });
    },
  });

  const flagAsRiskMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Theme.update(themeId, {
        is_disabled: !theme.is_disabled,
        disabled_reason: !theme.is_disabled ? 'Gemarkeerd als risico door beheerder' : null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theme', themeId] });
      toast({
        variant: "success",
        title: theme.is_disabled ? "Risico verwijderd" : "Gemarkeerd als risico",
        description: theme.is_disabled ? "De risicovlag is succesvol verwijderd." : "Het theme is gemarkeerd als risico.",
      });
    },
  });

  const deleteThemeMutation = useMutation({
    mutationFn: () => base44.entities.Theme.delete(themeId),
    onSuccess: () => {
      toast({
        variant: "success",
        title: "Theme verwijderd",
        description: "Het theme is succesvol verwijderd",
      });
      setTimeout(() => {
        window.location.href = createPageUrl("Themes");
      }, 500);
    },
  });

  const editThemeMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Theme.update(themeId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theme', themeId] });
      setShowEditDialog(false);
      toast({
        variant: "success",
        title: "Theme bewerkt",
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
      return base44.entities.Theme.update(themeId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theme', themeId] });
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
      return base44.entities.Theme.update(themeId, {
        shared_with_teams: teamIds
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theme', themeId] });
      setShowShareDialog(false);
      toast({
        variant: "success",
        title: "Delen bijgewerkt",
        description: "Het theme wordt nu gedeeld met de geselecteerde teams",
      });
    },
  });

  const handleUploadVersion = async () => {
    if (newVersion && selectedFile) {
      uploadVersionMutation.mutate({ version: newVersion, file: selectedFile });
    }
  };

  const handleEditSave = () => {
    if (editForm.name) {
      editThemeMutation.mutate(editForm);
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

  const toggleTeamSelection = (teamId) => {
    setSelectedTeamIds(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const getUserById = (userId) => allUsers.find(u => u.id === userId);

  const isAdmin = user?.role === "admin";

  if (!theme) {
    return <div className="p-8">Theme wordt geladen...</div>;
  }

  const versions = theme.versions || [];
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

  const canManageTheme = () => {
    if (!user || !theme) return false;
    if (theme.owner_type === "user" && theme.owner_id === user.id) return true;
    if (theme.owner_type === "team") {
      const team = userTeams.find(t => t.id === theme.owner_id);
      if (team?.owner_id === user.id) return true;
      const member = team?.members?.find(m => m.user_id === user.id);
      if (member?.permissions?.manage_themes) return true;
    }
    return false;
  };

  const canManage = canManageTheme();
  const ownerUser = getUserById(theme.owner_id);
  const isTeamOwned = theme.owner_type === "team";
  const ownerTeam = isTeamOwned ? userTeams.find(t => t.id === theme.owner_id) : null;

  const sitesThemeInstalledOn = allSites.filter(site => {
    if (!theme.installed_on?.some(install => install.site_id === site.id)) return false;
    if (!user) return false;
    if (site.owner_type === "user" && site.owner_id === user.id) return true;
    if (site.owner_type === "team") {
      const team = userTeams.find(t => t.id === site.owner_id);
      if (!team) return false;
      const isMember = team.owner_id === user.id || 
                       team.members?.some(m => m.user_id === user.id && m.status === "active");
      if (!isMember) return false;
      if (!theme.shared_with_teams?.includes(team.id)) return false;
      return true;
    }
    return false;
  });

  const installedCount = sitesThemeInstalledOn.length;

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
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                <Palette className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 mb-1">{decodeHtmlEntities(theme?.name)}</h1>
                <p className="text-sm text-gray-600">{decodeHtmlEntities(theme?.description)}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              {canManage && (
                <Button
                  onClick={() => setShowUploadDialog(true)}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Nieuwe Versie Uploaden
                </Button>
              )}
              
              {theme.owner_type === "user" && theme.owner_id === user?.id && (
                <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                  <Crown className="w-3 h-3 mr-1" />
                  Eigenaar
                </Badge>
              )}
              {theme.is_disabled && (
                <Badge className="bg-red-100 text-red-700 border-red-200">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Risico
                </Badge>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 mt-4 ml-4 pl-4 border-l-2 border-pink-300">
              <Badge className="bg-pink-100 text-pink-700 border-pink-200 text-xs">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Admin Actions
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowMessageDialog(true)}
                className="border-pink-200 text-pink-700 hover:bg-pink-50"
              >
                <Mail className="w-4 h-4 mr-2" />
                Bericht
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowNotificationDialog(true)}
                className="border-pink-200 text-pink-700 hover:bg-pink-50"
              >
                <Bell className="w-4 h-4 mr-2" />
                Notificatie
              </Button>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Theme Info Card */}
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-purple-600" />
                Theme Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {theme.screenshot_url && (
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-3">
                  <img 
                    src={theme.screenshot_url} 
                    alt={theme.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Slug</span>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">{theme.slug}</code>
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
                  {theme.updated_date ? format(new Date(theme.updated_date), 'd MMM yyyy', { locale: nl }) : 'N/A'}
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
                <div className="text-center p-2 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 mb-1">Versie</p>
                  <p className="text-lg font-bold text-purple-700">
                    {theme.latest_version ? `v${theme.latest_version}` : "N/A"}
                  </p>
                </div>
                <div className="text-center p-2 bg-pink-50 rounded-lg">
                  <p className="text-xs text-pink-600 mb-1">Versies</p>
                  <p className="text-lg font-bold text-pink-700">{versions.length}</p>
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
                            className={`h-12 w-12 ${theme.is_disabled ? 'bg-red-50 border-red-200' : ''}`}
                          >
                            {flagAsRiskMutation.isPending ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <AlertTriangle className={`w-5 h-5 ${theme.is_disabled ? 'text-red-600' : ''}`} />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {theme.is_disabled ? 'Verwijder Risico Flag' : 'Markeer als Risico'}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => {
                              if (confirm('Weet je zeker dat je dit theme wilt verwijderen?')) {
                                deleteThemeMutation.mutate();
                              }
                            }}
                            disabled={deleteThemeMutation.isPending}
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          >
                            {deleteThemeMutation.isPending ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Trash2 className="w-5 h-5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Theme Verwijderen</TooltipContent>
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
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-purple-600" />
                  Theme Versies
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {sortedVersions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Palette className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nog geen versies beschikbaar</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedVersions.map((version, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-purple-200 transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">v{version.version}</h3>
                            {version.version === theme.latest_version && (
                              <Badge className="bg-purple-100 text-purple-700 border-purple-200">
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

          {/* Sites Section */}
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-600" />
                Geïnstalleerd op Sites ({sitesThemeInstalledOn.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {sitesThemeInstalledOn.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Dit theme is nog niet geïnstalleerd op je sites</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {sitesThemeInstalledOn.map(site => {
                    const installation = theme.installed_on?.find(i => i.site_id === site.id);
                    const installedVersion = installation?.version || "Unknown";

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
                                className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1 hover:underline truncate"
                              >
                                {site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              </a>
                            </div>
                            <Badge className="bg-green-100 text-green-700 ml-2">
                              v{installedVersion}
                            </Badge>
                          </div>

                          <Button size="sm" variant="outline" asChild className="w-full">
                            <Link to={createPageUrl(`SiteDetail?id=${site.id}`)}>
                              <Settings className="w-4 h-4 mr-2" />
                              Site Bekijken
                            </Link>
                          </Button>
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
                <Label htmlFor="file">Theme ZIP Bestand *</Label>
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
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
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

        {/* Edit Theme Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Theme Bewerken</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="edit-name">Theme Naam</Label>
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
                  disabled={editThemeMutation.isPending} 
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                >
                  {editThemeMutation.isPending ? "Opslaan..." : "Opslaan"}
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
                Draag het eigendom van dit theme over naar een ander gebruiker of team.
              </p>
              <div>
                <Label htmlFor="transfer-user">Overdragen aan Gebruiker</Label>
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
                <Label htmlFor="transfer-team">Overdragen aan Team</Label>
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
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
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
                Selecteer de teams waarmee je dit theme wilt delen.
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
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
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

        {/* Message Dialog */}
        <SendMessageDialog
          open={showMessageDialog}
          onOpenChange={setShowMessageDialog}
          user={user}
          toUserId={theme.owner_type === "user" ? theme.owner_id : null}
          toUserName={theme.owner_type === "user" ? ownerUser?.full_name : null}
          context={{
            type: "theme",
            id: theme.id,
            name: theme.name
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
              type: "theme",
              id: theme.id,
              name: theme.name
            }}
          />
        )}
      </div>
    </div>
  );
}