
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Layers,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Search,
  Grid3x3,
  List,
  MoreVertical,
  Package,
  Users,
  Building,
  Crown
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "../Layout";

export default function PlanGroups() {
  const user = useUser();
  const [showDialog, setShowDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    slug: "",
    icon: "users",
    color: "#6366f1",
    sort_order: 0,
    is_active: true,
    target_audience: "individual",
    highlight_badge: "",
    upgrade_settings: {
      allow_upgrade_within_group: true,
      allow_upgrade_to_groups: [],
      allow_downgrade_within_group: true,
      allow_downgrade_to_groups: [],
      require_approval_for_upgrade: false,
      prorate_on_upgrade: true
    }
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate(createPageUrl("Dashboard"));
    }
  }, [user, navigate]);

  const { data: planGroups = [], isLoading } = useQuery({
    queryKey: ['admin-plan-groups'],
    queryFn: async () => {
      if (!user || user.role !== 'admin') return [];
      
      const groups = await base44.entities.PlanGroup.list("sort_order");
      return groups;
    },
    enabled: !!user && user.role === "admin",
    staleTime: 0,
    initialData: [],
  });

  const { data: allPlans = [] } = useQuery({
    queryKey: ['admin-subscription-plans'],
    queryFn: async () => {
      if (!user || user.role !== 'admin') return [];
      
      const plans = await base44.entities.SubscriptionPlan.list();
      return plans;
    },
    enabled: !!user && user.role === "admin",
    staleTime: 0,
    initialData: [],
  });

  const createGroupMutation = useMutation({
    mutationFn: (groupData) => base44.entities.PlanGroup.create(groupData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plan-groups'] });
      setShowDialog(false);
      resetForm();
      toast({
        title: "Groep aangemaakt",
        description: "De plangroep is succesvol aangemaakt",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij aanmaken",
        description: error.message,
      });
    }
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PlanGroup.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plan-groups'] });
      setShowDialog(false);
      resetForm();
      toast({
        title: "Groep bijgewerkt",
        description: "De plangroep is succesvol bijgewerkt",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij bijwerken",
        description: error.message,
      });
    }
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId) => base44.entities.PlanGroup.delete(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plan-groups'] });
      toast({
        title: "Groep verwijderd",
        description: "De plangroep is succesvol verwijderd",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij verwijderen",
        description: error.message,
      });
    }
  });

  const handleSubmit = () => {
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, data: formData });
    } else {
      createGroupMutation.mutate(formData);
    }
  };

  const handleEdit = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || "",
      slug: group.slug,
      icon: group.icon || "users",
      color: group.color || "#6366f1",
      sort_order: group.sort_order || 0,
      is_active: group.is_active,
      target_audience: group.target_audience || "individual",
      highlight_badge: group.highlight_badge || "",
      upgrade_settings: group.upgrade_settings || {
        allow_upgrade_within_group: true,
        allow_upgrade_to_groups: [],
        allow_downgrade_within_group: true,
        allow_downgrade_to_groups: [],
        require_approval_for_upgrade: false,
        prorate_on_upgrade: true
      }
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingGroup(null);
    setFormData({
      name: "",
      description: "",
      slug: "",
      icon: "users",
      color: "#6366f1",
      sort_order: 0,
      is_active: true,
      target_audience: "individual",
      highlight_badge: "",
      upgrade_settings: {
        allow_upgrade_within_group: true,
        allow_upgrade_to_groups: [],
        allow_downgrade_within_group: true,
        allow_downgrade_to_groups: [],
        require_approval_for_upgrade: false,
        prorate_on_upgrade: true
      }
    });
  };

  const getPlansInGroup = (groupId) => {
    return allPlans.filter(p => p.group_id === groupId);
  };

  const filteredGroups = planGroups.filter(group =>
    group.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const iconOptions = [
    { value: "users", label: "Users", icon: Users },
    { value: "building", label: "Building", icon: Building },
    { value: "package", label: "Package", icon: Package },
    { value: "crown", label: "Crown", icon: Crown },
    { value: "layers", label: "Layers", icon: Layers }
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

  const audienceOptions = [
    { value: "individual", label: "Individual" },
    { value: "team", label: "Team" },
    { value: "agency", label: "Agency" },
    { value: "enterprise", label: "Enterprise" }
  ];

  const GroupCard = ({ group }) => {
    const plansInGroup = getPlansInGroup(group.id);
    const IconComponent = iconOptions.find(i => i.value === group.icon)?.icon || Layers;

    return (
      <Card className="border-none shadow-md hover:shadow-lg transition-all">
        <CardHeader className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-100 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${group.color}20` }}
              >
                <IconComponent className="w-6 h-6" style={{ color: group.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base truncate text-gray-900">{group.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={group.is_active ? "bg-green-100 text-green-700 text-xs" : "bg-gray-100 text-gray-700 text-xs"}>
                    {group.is_active ? "Actief" : "Inactief"}
                  </Badge>
                  {group.highlight_badge && (
                    <Badge variant="outline" className="text-xs">
                      {group.highlight_badge}
                    </Badge>
                  )}
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
                <DropdownMenuItem onClick={() => handleEdit(group)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Bewerken
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (plansInGroup.length > 0) {
                      toast({
                        variant: "destructive",
                        title: "Kan niet verwijderen",
                        description: "Verwijder eerst alle plannen in deze groep",
                      });
                      return;
                    }
                    if (confirm(`Weet je zeker dat je "${group.name}" wilt verwijderen?`)) {
                      deleteGroupMutation.mutate(group.id);
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
          <p className="text-sm text-gray-600 line-clamp-2">
            {group.description || "Geen beschrijving"}
          </p>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Plannen:</span>
              <span className="font-semibold text-gray-900">{plansInGroup.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Doelgroep:</span>
              <Badge variant="outline" className="text-xs">{group.target_audience}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Sorteervolgorde:</span>
              <span className="font-semibold text-gray-900">{group.sort_order}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const GroupListItem = ({ group }) => {
    const plansInGroup = getPlansInGroup(group.id);
    const IconComponent = iconOptions.find(i => i.value === group.icon)?.icon || Layers;

    return (
      <Card className="border-none shadow-md hover:shadow-lg transition-all">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${group.color}20` }}
            >
              <IconComponent className="w-6 h-6" style={{ color: group.color }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{group.name}</h3>
                <Badge className={group.is_active ? "bg-green-100 text-green-700 text-xs" : "bg-gray-100 text-gray-700 text-xs"}>
                  {group.is_active ? "Actief" : "Inactief"}
                </Badge>
                {group.highlight_badge && (
                  <Badge variant="outline" className="text-xs">
                    {group.highlight_badge}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 line-clamp-1">
                {group.description || "Geen beschrijving"}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-600 flex-shrink-0">
              <div className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                <span>{plansInGroup.length} plannen</span>
              </div>
              <Badge variant="outline" className="text-xs">{group.target_audience}</Badge>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(group)}>
                <Edit className="w-4 h-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      if (plansInGroup.length > 0) {
                        toast({
                          variant: "destructive",
                          title: "Kan niet verwijderen",
                          description: "Verwijder eerst alle plannen in deze groep",
                        });
                        return;
                      }
                      if (confirm(`Weet je zeker dat je "${group.name}" wilt verwijderen?`)) {
                        deleteGroupMutation.mutate(group.id);
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

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Plan Groepen</h1>
          <p className="text-sm text-gray-600">Organiseer abonnementsplannen in groepen</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Totaal Groepen</p>
                  <p className="text-2xl font-bold text-gray-900">{planGroups.length}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex items-center justify-center">
                  <Layers className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Actieve Groepen</p>
                  <p className="text-2xl font-bold text-green-600">{planGroups.filter(g => g.is_active).length}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Totaal Plannen</p>
                  <p className="text-2xl font-bold text-purple-600">{allPlans.length}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-purple-600" />
                </div>
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
                  placeholder="Zoek groepen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
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
                onClick={() => {
                  resetForm();
                  setShowDialog(true);
                }}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nieuwe Groep
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Groups Grid/List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <Card className="border-none shadow-md">
            <CardContent className="p-12 text-center">
              <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                {searchQuery ? "Geen groepen gevonden" : "Nog geen groepen"}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {searchQuery
                  ? "Probeer een andere zoekopdracht"
                  : "Maak je eerste plangroep aan om te beginnen"}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => {
                    resetForm();
                    setShowDialog(true);
                  }}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nieuwe Groep
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === "grid" ? "grid md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
            {filteredGroups.map((group) => (
              viewMode === "grid" ? (
                <GroupCard key={group.id} group={group} />
              ) : (
                <GroupListItem key={group.id} group={group} />
              )
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={(open) => {
          if (!open) resetForm();
          setShowDialog(open);
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? "Groep Bewerken" : "Nieuwe Groep Aanmaken"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Groepsnaam *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Bijv: Personal Plans"
                  />
                </div>
                <div>
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                    placeholder="bijv: personal"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Beschrijving</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Korte beschrijving van deze plangroep"
                  rows={3}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="icon">Icoon</Label>
                  <Select value={formData.icon} onValueChange={(value) => setFormData({...formData, icon: value})}>
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
                  <Select value={formData.color} onValueChange={(value) => setFormData({...formData, color: value})}>
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

                <div>
                  <Label htmlFor="sort_order">Sorteervolgorde</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({...formData, sort_order: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="target_audience">Doelgroep</Label>
                  <Select value={formData.target_audience} onValueChange={(value) => setFormData({...formData, target_audience: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {audienceOptions.map((audience) => (
                        <SelectItem key={audience.value} value={audience.value}>
                          {audience.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="highlight_badge">Highlight Badge</Label>
                  <Input
                    id="highlight_badge"
                    value={formData.highlight_badge}
                    onChange={(e) => setFormData({...formData, highlight_badge: e.target.value})}
                    placeholder="Bijv: Populair"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-base">Groep Actief</Label>
                  <p className="text-sm text-gray-600">Maak deze groep zichtbaar voor gebruikers</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                />
              </div>

              <DialogFooter className="pt-4 border-t mt-4 flex gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={
                    createGroupMutation.isPending ||
                    updateGroupMutation.isPending ||
                    !formData.name ||
                    !formData.slug
                  }
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                >
                  {createGroupMutation.isPending || updateGroupMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Opslaan...
                    </>
                  ) : (
                    editingGroup ? "Groep Bijwerken" : "Groep Aanmaken"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false);
                    resetForm();
                  }}
                >
                  Annuleren
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
