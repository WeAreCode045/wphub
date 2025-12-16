
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Briefcase,
  Plus,
  Search,
  Users,
  Calendar,
  Globe,
  Grid3x3,
  List,
  MoreVertical,
  Edit,
  Trash2,
  Package,
  Layers,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { checkSubscriptionLimit } from "../components/subscription/LimitChecker";
import FeatureGate from "../components/subscription/FeatureGate";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "../Layout";


export default function Projects() {
  const user = useUser();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    team_id: "",
    site_id: "",
    status: "planning",
    priority: "medium",
    start_date: new Date().toISOString().split('T')[0],
    template_id: null // Changed from "" to null for consistency with SelectItem value={null}
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get user's teams
  const { data: userTeams = [] } = useQuery({
    queryKey: ['teams', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const allTeams = await base44.entities.Team.list();
      const teams = allTeams.filter(t =>
        t.owner_id === user.id ||
        t.members?.some(m => m.user_id === user.id && m.status === "active")
      );
      
      return teams;
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: true,
    initialData: [],
  });

  // Get all projects (personal + team projects)
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const teamIds = userTeams.map(t => t.id);
      if (teamIds.length === 0) return []; // Only show projects associated with a team the user is part of.
      
      const allProjects = await base44.entities.Project.list("-created_date"); // Filter by created_date as per outline
      const userProjects = allProjects.filter(p => teamIds.includes(p.team_id));
      
      return userProjects;
    },
    enabled: !!user && userTeams.length > 0,
    staleTime: 0,
    refetchOnMount: true,
    initialData: [],
  });

  // Get all sites for dropdown
  const { data: allSites = [] } = useQuery({
    queryKey: ['sites', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const userSites = await base44.entities.Site.filter({
        owner_type: "user",
        owner_id: user.id
      });
      
      return userSites;
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: true,
    initialData: [],
  });

  // Get project templates
  const { data: templates = [] } = useQuery({
    queryKey: ['project-templates', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.ProjectTemplate.list();
    },
    enabled: !!user,
    initialData: [],
  });

  const createProjectMutation = useMutation({
    mutationFn: async (projectData) => {
      if (!user) throw new Error("User not loaded");
      
      const team = userTeams.find(t => t.id === projectData.team_id);
      if (!team) throw new Error("Team niet gevonden");
      
      if (team.owner_id !== user.id) {
        throw new Error("Alleen team owners kunnen projecten aanmaken");
      }
      
      const limitCheck = await checkSubscriptionLimit(user.id, 'projects');
      
      if (!limitCheck.allowed) {
        throw new Error(limitCheck.message);
      }
      
      // If template is selected, get plugins from template
      let plugins = [];
      if (projectData.template_id) {
        const template = templates.find(t => t.id === projectData.template_id);
        if (template && template.plugins) {
          plugins = template.plugins.map(p => ({
            plugin_id: p.plugin_id,
            version: p.version,
            installed: false
          }));
        }
      }

      const newProject = await base44.entities.Project.create({
        ...projectData,
        plugins,
        assigned_members: [{ user_id: user.id, role_on_project: "Project Lead" }],
        timeline_events: [],
        attachments: [],
        notes: ""
      });

      // Log activity
      await base44.entities.ActivityLog.create({
        user_email: user.email,
        action: `Project aangemaakt: ${newProject.title}`,
        entity_type: "project",
        entity_id: newProject.id
      });

      return newProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreateDialog(false);
      setNewProject({
        title: "",
        description: "",
        team_id: "",
        site_id: "",
        status: "planning",
        priority: "medium",
        start_date: new Date().toISOString().split('T')[0],
        template_id: null
      });
      toast({
        title: "Project aangemaakt!",
        description: "Je nieuwe project is succesvol aangemaakt.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fout bij aanmaken project",
        description: error.message || "Er is een onbekende fout opgetreden.",
        variant: "destructive",
      });
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId) => base44.entities.Project.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: "Project verwijderd",
        description: "Het project is succesvol verwijderd.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fout bij verwijderen project",
        description: error.message || "Er is een onbekende fout opgetreden.",
        variant: "destructive",
      });
    }
  });

  const handleCreateProject = () => {
    if (newProject.title && newProject.team_id && newProject.site_id) {
      createProjectMutation.mutate(newProject);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status) => {
    const colors = {
      planning: "bg-blue-100 text-blue-700",
      in_progress: "bg-indigo-100 text-indigo-700",
      completed: "bg-green-100 text-green-700",
      on_hold: "bg-amber-100 text-amber-700",
      cancelled: "bg-red-100 text-red-700"
    };
    return colors[status] || colors.planning;
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

  const getTeamName = (teamId) => {
    const team = userTeams.find(t => t.id === teamId);
    return team?.name || "Persoonlijk";
  };

  const getSiteName = (siteId) => {
    const site = allSites.find(s => s.id === siteId);
    return site?.name || "Onbekende site";
  };

  const ProjectCard = ({ project }) => (
    <Card className="border-none shadow-md hover:shadow-lg transition-all">
      <CardHeader className="bg-gradient-to-br from-indigo-50 to-purple-50 border-b border-gray-100 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate text-gray-900">{project.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`${getStatusColor(project.status)} text-xs`}>
                  {project.status}
                </Badge>
                <Badge className={`${getPriorityColor(project.priority)} text-xs`}>
                  {project.priority}
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
              <DropdownMenuItem asChild>
                <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Bekijken
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (confirm(`Weet je zeker dat je project "${project.title}" wilt verwijderen?`)) {
                    deleteProjectMutation.mutate(project.id);
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
          {project.description || "Geen beschrijving"}
        </p>

        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-gray-600">
            <Users className="w-3.5 h-3.5" />
            <span>{getTeamName(project.team_id)}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Globe className="w-3.5 h-3.5" />
            <span>{getSiteName(project.site_id)}</span>
          </div>
          {project.start_date && (
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-3.5 h-3.5" />
              <span>{format(new Date(project.start_date), "d MMM yyyy", { locale: nl })}</span>
            </div>
          )}
          {project.plugins && project.plugins.length > 0 && (
            <div className="flex items-center gap-2 text-gray-600">
              <Package className="w-3.5 h-3.5" />
              <span>{project.plugins.length} plugins</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <Button 
            asChild 
            size="sm" 
            className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
          >
            <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)}>
              Bekijken
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const ProjectListItem = ({ project }) => (
    <Card className="border-none shadow-md hover:shadow-lg transition-all">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
            <Briefcase className="w-6 h-6 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{project.title}</h3>
              <Badge className={`${getStatusColor(project.status)} text-xs`}>
                {project.status}
              </Badge>
              <Badge className={`${getPriorityColor(project.priority)} text-xs`}>
                {project.priority}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>{getTeamName(project.team_id)}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                <span>{getSiteName(project.site_id)}</span>
              </div>
              {project.plugins && project.plugins.length > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    <span>{project.plugins.length} plugins</span>
                  </div>
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
              <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)}>
                Bekijken
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    if (confirm(`Weet je zeker dat je project "${project.title}" wilt verwijderen?`)) {
                      deleteProjectMutation.mutate(project.id);
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

  return (
    <FeatureGate userId={user?.id} featureType="projects">
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Projecten</h1>
            <p className="text-sm text-gray-600">Beheer je projecten en milestones</p>
          </div>

          {/* Filters */}
          <Card className="border-none shadow-md mb-6">
            <CardContent className="p-4">
              <div className="flex gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Zoek projecten..."
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
                  variant="outline" 
                  asChild
                  className="hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <Link to={createPageUrl("ProjectTemplates")}>
                    <Layers className="w-4 h-4 mr-2" />
                    Templates
                  </Link>
                </Button>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0">
                      <Plus className="w-4 h-4 mr-2" />
                      Nieuw Project
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Nieuw Project Aanmaken</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="title">Project Titel *</Label>
                        <Input
                          id="title"
                          placeholder="Website Redesign"
                          value={newProject.title}
                          onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="description">Beschrijving</Label>
                        <Textarea
                          id="description"
                          placeholder="Beschrijf het project..."
                          value={newProject.description}
                          onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="team">Team *</Label>
                          <Select value={newProject.team_id} onValueChange={(value) => setNewProject({ ...newProject, team_id: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecteer team" />
                            </SelectTrigger>
                            <SelectContent>
                              {userTeams.map((team) => (
                                <SelectItem key={team.id} value={team.id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="site">Site *</Label>
                          <Select value={newProject.site_id} onValueChange={(value) => setNewProject({ ...newProject, site_id: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecteer site" />
                            </SelectTrigger>
                            <SelectContent>
                              {allSites.map((site) => (
                                <SelectItem key={site.id} value={site.id}>
                                  {site.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="template">Project Template (optioneel)</Label>
                        <Select value={newProject.template_id} onValueChange={(value) => setNewProject({ ...newProject, template_id: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Geen template" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={null}>Geen template</SelectItem>
                            {templates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="priority">Prioriteit</Label>
                          <Select value={newProject.priority} onValueChange={(value) => setNewProject({ ...newProject, priority: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="start_date">Startdatum</Label>
                          <Input
                            id="start_date"
                            type="date"
                            value={newProject.start_date}
                            onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t">
                        <Button
                          onClick={handleCreateProject}
                          disabled={!newProject.title || !newProject.team_id || !newProject.site_id || createProjectMutation.isPending}
                          className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                        >
                          {createProjectMutation.isPending ? "Aanmaken..." : "Project Aanmaken"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowCreateDialog(false)}
                        >
                          Annuleren
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Projects Grid/List */}
          {filteredProjects.length === 0 ? (
            <Card className="border-none shadow-md">
              <CardContent className="p-12 text-center">
                <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {searchQuery ? "Geen projecten gevonden" : "Nog geen projecten"}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {searchQuery
                    ? "Probeer een andere zoekopdracht"
                    : "Maak je eerste project aan om te beginnen"
                  }
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowCreateDialog(true)} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0">
                    <Plus className="w-4 h-4 mr-2" />
                    Nieuw Project
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className={viewMode === "grid" ? "grid md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
              {filteredProjects.map((project) => (
                viewMode === "grid" ? (
                  <ProjectCard key={project.id} project={project} />
                ) : (
                  <ProjectListItem key={project.id} project={project} />
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </FeatureGate>
  );
}
