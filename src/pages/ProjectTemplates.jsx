import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Layers,
  Plus,
  Search,
  Package,
  Edit,
  Trash2,
  Copy,
  ArrowLeft,
  Grid3x3,
  List,
  Globe,
  Users,
  Loader2
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";

export default function ProjectTemplates() {
  const [user, setUser] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    is_public: false,
    team_id: "",
    icon: "briefcase",
    color: "#6366f1",
    plugins: []
  });
  const [selectedPlugins, setSelectedPlugins] = useState([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['project-templates', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const allTemplates = await base44.entities.ProjectTemplate.list("-updated_date");
      return allTemplates.filter(t => 
        t.created_by === user.email || 
        t.is_public || 
        t.team_id
      );
    },
    enabled: !!user,
    initialData: [],
  });

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

  const { data: allPlugins = [] } = useQuery({
    queryKey: ['all-plugins', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const plugins = await base44.entities.Plugin.list();
      const teamIds = userTeams.map(t => t.id);
      return plugins.filter(p => 
        (p.owner_type === "user" && p.owner_id === user.id) ||
        (p.owner_type === "team" && teamIds.includes(p.owner_id)) ||
        p.shared_with_teams?.some(tid => teamIds.includes(tid))
      );
    },
    enabled: !!user && userTeams.length > 0,
    initialData: [],
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (templateData) => {
      const pluginsData = selectedPlugins.map(pluginId => {
        const plugin = allPlugins.find(p => p.id === pluginId);
        return {
          plugin_id: pluginId,
          version: plugin?.latest_version || "",
          settings: {}
        };
      });

      return base44.entities.ProjectTemplate.create({
        ...templateData,
        plugins: pluginsData,
        created_by: user.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-templates'] });
      setShowCreateDialog(false);
      setNewTemplate({
        name: "",
        description: "",
        is_public: false,
        team_id: "",
        icon: "briefcase",
        color: "#6366f1",
        plugins: []
      });
      setSelectedPlugins([]);
      toast({
        title: "Template aangemaakt",
        description: "De template is succesvol aangemaakt",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const pluginsData = selectedPlugins.map(pluginId => {
        const plugin = allPlugins.find(p => p.id === pluginId);
        return {
          plugin_id: pluginId,
          version: plugin?.latest_version || "",
          settings: {}
        };
      });

      return base44.entities.ProjectTemplate.update(id, {
        ...data,
        plugins: pluginsData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-templates'] });
      setShowEditDialog(false);
      setEditingTemplate(null);
      setSelectedPlugins([]);
      toast({
        title: "Template bijgewerkt",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => base44.entities.ProjectTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-templates'] });
      toast({
        title: "Template verwijderd",
      });
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async (template) => {
      return base44.entities.ProjectTemplate.create({
        ...template,
        name: `${template.name} (Kopie)`,
        created_by: user.email,
        is_public: false,
        team_id: ""
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-templates'] });
      toast({
        title: "Template gedupliceerd",
      });
    },
  });

  const handleCreateTemplate = () => {
    if (newTemplate.name) {
      createTemplateMutation.mutate(newTemplate);
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setNewTemplate({
      name: template.name,
      description: template.description,
      is_public: template.is_public,
      team_id: template.team_id || "",
      icon: template.icon || "briefcase",
      color: template.color || "#6366f1"
    });
    setSelectedPlugins(template.plugins?.map(p => p.plugin_id) || []);
    setShowEditDialog(true);
  };

  const handleUpdateTemplate = () => {
    if (editingTemplate && newTemplate.name) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data: newTemplate });
    }
  };

  const togglePluginSelection = (pluginId) => {
    setSelectedPlugins(prev => 
      prev.includes(pluginId) 
        ? prev.filter(id => id !== pluginId)
        : [...prev, pluginId]
    );
  };

  const filteredTemplates = templates.filter(template =>
    template.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canEditTemplate = (template) => {
    return template.created_by === user?.email || user?.role === "admin";
  };

  const getPluginName = (pluginId) => {
    const plugin = allPlugins.find(p => p.id === pluginId);
    return plugin?.name || "Onbekende plugin";
  };

  const iconOptions = [
    { value: "briefcase", label: "Briefcase" },
    { value: "globe", label: "Globe" },
    { value: "package", label: "Package" },
    { value: "users", label: "Users" },
    { value: "layers", label: "Layers" }
  ];

  const colorOptions = [
    { value: "#6366f1", label: "Indigo" },
    { value: "#8b5cf6", label: "Purple" },
    { value: "#ec4899", label: "Pink" },
    { value: "#f59e0b", label: "Amber" },
    { value: "#10b981", label: "Green" },
    { value: "#3b82f6", label: "Blue" },
    { value: "#ef4444", label: "Red" }
  ];

  const TemplateCard = ({ template }) => (
    <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${template.color}20` }}
            >
              <Layers className="w-6 h-6" style={{ color: template.color }} />
            </div>
            <div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <div className="flex gap-2 mt-1">
                {template.is_public && (
                  <Badge variant="outline" className="text-xs">
                    <Globe className="w-3 h-3 mr-1" />
                    Publiek
                  </Badge>
                )}
                {template.team_id && (
                  <Badge variant="outline" className="text-xs">
                    <Users className="w-3 h-3 mr-1" />
                    Team
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <p className="text-sm text-gray-600 line-clamp-2">
          {template.description || "Geen beschrijving"}
        </p>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Package className="w-4 h-4" />
          <span>{template.plugins?.length || 0} plugins</span>
        </div>

        {template.plugins && template.plugins.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">Plugins:</p>
            <div className="flex flex-wrap gap-1">
              {template.plugins.slice(0, 3).map((plugin, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {getPluginName(plugin.plugin_id)}
                </Badge>
              ))}
              {template.plugins.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{template.plugins.length - 3} meer
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t border-gray-100">
          {canEditTemplate(template) && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEditTemplate(template)}
                className="flex-1"
              >
                <Edit className="w-4 h-4 mr-2" />
                Bewerken
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm(`Weet je zeker dat je template "${template.name}" wilt verwijderen?`)) {
                    deleteTemplateMutation.mutate(template.id);
                  }
                }}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => duplicateTemplateMutation.mutate(template)}
            className={canEditTemplate(template) ? "" : "flex-1"}
          >
            <Copy className="w-4 h-4 mr-2" />
            Dupliceer
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const TemplateListItem = ({ template }) => (
    <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${template.color}20` }}
          >
            <Layers className="w-6 h-6" style={{ color: template.color }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">{template.name}</h3>
              {template.is_public && (
                <Badge variant="outline" className="text-xs">
                  <Globe className="w-3 h-3 mr-1" />
                  Publiek
                </Badge>
              )}
              {template.team_id && (
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  Team
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600 line-clamp-1">
              {template.description || "Geen beschrijving"}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 flex-shrink-0">
            <Package className="w-4 h-4" />
            <span>{template.plugins?.length || 0} plugins</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {canEditTemplate(template) && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditTemplate(template)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm(`Weet je zeker dat je template "${template.name}" wilt verwijderen?`)) {
                      deleteTemplateMutation.mutate(template.id);
                    }
                  }}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => duplicateTemplateMutation.mutate(template)}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" asChild>
            <Link to={createPageUrl("Projects")}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Project Templates</h1>
            <p className="text-gray-500">Maak herbruikbare templates met plugin configuraties</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-5 h-5 mr-2" />
            Nieuwe Template
          </Button>
        </div>

        <Card className="border-none shadow-lg mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Zoek templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-1 border rounded-lg p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className="h-8 w-8"
                >
                  <Grid3x3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className="h-8 w-8"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="p-12 text-center">
              <Layers className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery ? "Geen templates gevonden" : "Nog geen templates"}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery 
                  ? "Probeer een andere zoekopdracht" 
                  : "Maak je eerste template aan om projecten sneller op te zetten"
                }
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowCreateDialog(true)} className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="w-5 h-5 mr-2" />
                  Nieuwe Template
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === "grid" ? "grid md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
            {filteredTemplates.map((template) => (
              viewMode === "grid" ? (
                <TemplateCard key={template.id} template={template} />
              ) : (
                <TemplateListItem key={template.id} template={template} />
              )
            ))}
          </div>
        )}

        {/* Create/Edit Template Dialog */}
        <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setShowEditDialog(false);
            setEditingTemplate(null);
            setNewTemplate({
              name: "",
              description: "",
              is_public: false,
              team_id: "",
              icon: "briefcase",
              color: "#6366f1",
              plugins: []
            });
            setSelectedPlugins([]);
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{showEditDialog ? "Template Bewerken" : "Nieuwe Template Aanmaken"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Template Naam *</Label>
                <Input
                  id="name"
                  placeholder="E-commerce Website Template"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="description">Beschrijving</Label>
                <Textarea
                  id="description"
                  placeholder="Beschrijf de template..."
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="icon">Icoon</Label>
                  <Select value={newTemplate.icon} onValueChange={(value) => setNewTemplate({ ...newTemplate, icon: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map((icon) => (
                        <SelectItem key={icon.value} value={icon.value}>
                          {icon.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="color">Kleur</Label>
                  <Select value={newTemplate.color} onValueChange={(value) => setNewTemplate({ ...newTemplate, color: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {colorOptions.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: color.value }} />
                            {color.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="public"
                  checked={newTemplate.is_public}
                  onCheckedChange={(checked) => setNewTemplate({ ...newTemplate, is_public: checked })}
                />
                <Label htmlFor="public" className="cursor-pointer">
                  Maak deze template publiek (zichtbaar voor alle gebruikers)
                </Label>
              </div>

              <div>
                <Label htmlFor="team">Koppel aan Team (optioneel)</Label>
                <Select value={newTemplate.team_id} onValueChange={(value) => setNewTemplate({ ...newTemplate, team_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Geen team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Geen team</SelectItem>
                    {userTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Plugins Selecteren</Label>
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                  {allPlugins.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Geen plugins beschikbaar</p>
                  ) : (
                    allPlugins.map((plugin) => (
                      <div key={plugin.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                        <Checkbox
                          id={`plugin-${plugin.id}`}
                          checked={selectedPlugins.includes(plugin.id)}
                          onCheckedChange={() => togglePluginSelection(plugin.id)}
                        />
                        <Label htmlFor={`plugin-${plugin.id}`} className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-600" />
                            <span className="font-medium">{plugin.name}</span>
                            <Badge variant="outline" className="text-xs">
                              v{plugin.latest_version}
                            </Badge>
                          </div>
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {selectedPlugins.length} plugin(s) geselecteerd
                </p>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={showEditDialog ? handleUpdateTemplate : handleCreateTemplate}
                  disabled={!newTemplate.name || (showEditDialog ? updateTemplateMutation.isPending : createTemplateMutation.isPending)}
                  className="flex-1"
                >
                  {showEditDialog 
                    ? (updateTemplateMutation.isPending ? "Opslaan..." : "Opslaan")
                    : (createTemplateMutation.isPending ? "Aanmaken..." : "Template Aanmaken")
                  }
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowCreateDialog(false);
                    setShowEditDialog(false);
                  }}
                >
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}