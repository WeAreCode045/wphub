
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/dialog";
import {
  Briefcase,
  ArrowLeft,
  Calendar,
  Users,
  Globe,
  Package,
  FileText,
  Clock,
  Plus,
  Edit,
  Trash2,
  Upload,
  Download,
  CheckCircle,
  Circle,
  Save,
  X,
  UserPlus,
  Loader2,
  Mail,
  Send,
  Inbox
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import SendMessageDialog from "../components/messaging/SendMessageDialog";
import ProjectInboxPopover from "../components/messaging/ProjectInboxPopover";


export default function ProjectDetail() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showAddEventDialog, setShowAddEventDialog] = useState(false); // Renamed from showAddTimelineDialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showProjectInboxDialog, setShowProjectInboxDialog] = useState(false);
  const [showProjectMemberMessageDialog, setShowProjectMemberMessageDialog] = useState(false);
  const [selectedProjectMember, setSelectedProjectMember] = useState(null);
  // const [projectInboxOpen, setProjectInboxOpen] = useState(false); // Removed, managed by ProjectInboxPopover
  const [selectedMember, setSelectedMember] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [newEvent, setNewEvent] = useState({ // Renamed from newTimeline
    title: "",
    description: "",
    date: new Date().toISOString().split('T')[0]
  });
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    status: "",
    priority: "",
    start_date: "",
    end_date: ""
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get("id");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const projects = await base44.entities.Project.filter({ id: projectId });
      return projects[0] || null;
    },
    enabled: !!projectId,
  });

  const { data: team } = useQuery({
    queryKey: ['project-team', project?.team_id],
    queryFn: async () => {
      if (!project?.team_id) return null;
      const teams = await base44.entities.Team.filter({ id: project.team_id });
      return teams[0] || null;
    },
    enabled: !!project?.team_id,
  });

  const { data: site } = useQuery({
    queryKey: ['project-site', project?.site_id],
    queryFn: async () => {
      if (!project?.site_id) return null;
      const sites = await base44.entities.Site.filter({ id: project.site_id });
      return sites[0] || null;
    },
    enabled: !!project?.site_id,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const { data: plugins = [] } = useQuery({
    queryKey: ['project-plugins'],
    queryFn: async () => {
      if (!project?.plugins) return [];
      const pluginIds = project.plugins.map(p => p.plugin_id);
      const allPlugins = await base44.entities.Plugin.list();
      return allPlugins.filter(p => pluginIds.includes(p.id));
    },
    enabled: !!project?.plugins && project.plugins.length > 0,
    initialData: [],
  });

  const { data: projectInboxMessages = [] } = useQuery({
    queryKey: ['project-inbox', projectId],
    queryFn: async () => {
      if (!projectId || !project?.inbox_id) return [];
      const messages = await base44.entities.Message.filter({
        to_mailbox_id: project.inbox_id
      }, "-created_date", 20); // Fetch top 20 latest messages
      return messages;
    },
    enabled: !!projectId && !!project?.inbox_id,
    initialData: [],
  });

  useEffect(() => {
    if (project) {
      setNotes(project.notes || "");
      setEditForm({
        title: project.title,
        description: project.description,
        status: project.status,
        priority: project.priority,
        start_date: project.start_date?.split('T')[0] || "",
        end_date: project.end_date?.split('T')[0] || ""
      });
    }
  }, [project]);

  const updateProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
      setShowEditDialog(false); // Close dialog on success
      toast({
        title: "Project bijgewerkt",
        description: "De wijzigingen zijn succesvol opgeslagen",
      });
    },
    onError: (error) => {
      toast({
        title: "Fout bij bijwerken",
        description: error.message || "Er is een onverwachte fout opgetreden.",
        variant: "destructive"
      });
    }
  });

  const saveNotesMutation = useMutation({
    mutationFn: (notes) => base44.entities.Project.update(projectId, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
      setIsEditingNotes(false);
      toast({
        title: "Notities opgeslagen",
      });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ userId, role }) => {
      const currentMembers = project.assigned_members || [];
      if (currentMembers.some(m => m.user_id === userId)) {
        throw new Error("Dit teamlid is al toegewezen aan het project");
      }
      const updatedMembers = [...currentMembers, { user_id: userId, role_on_project: role }];
      return base44.entities.Project.update(projectId, { assigned_members: updatedMembers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
      setShowAddMemberDialog(false);
      setSelectedMember("");
      setMemberRole("");
      toast({
        title: "Teamlid toegevoegd",
      });
    },
    onError: (error) => {
      toast({
        title: "Fout bij toevoegen teamlid",
        description: error.message || "Er is een onverwachte fout opgetreden.",
        variant: "destructive"
      });
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId) => {
      const updatedMembers = project.assigned_members.filter(m => m.user_id !== userId);
      return base44.entities.Project.update(projectId, { assigned_members: updatedMembers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
      toast({
        title: "Teamlid verwijderd",
      });
    },
  });

  const addEventMutation = useMutation({ // Renamed from addTimelineEventMutation
    mutationFn: (event) => {
      const currentEvents = project.timeline_events || [];
      const updatedEvents = [...currentEvents, { ...event, completed: false }];
      return base44.entities.Project.update(projectId, { timeline_events: updatedEvents });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
      setShowAddEventDialog(false); // Renamed
      setNewEvent({ title: "", description: "", date: new Date().toISOString().split('T')[0] }); // Renamed
      toast({
        title: "Mijlpaal toegevoegd",
      });
    },
  });

  const toggleTimelineEventMutation = useMutation({
    mutationFn: (index) => {
      const updatedEvents = [...project.timeline_events];
      updatedEvents[index].completed = !updatedEvents[index].completed;
      return base44.entities.Project.update(projectId, { timeline_events: updatedEvents });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
    },
  });

  const deleteTimelineEventMutation = useMutation({
    mutationFn: (index) => {
      const updatedEvents = project.timeline_events.filter((_, i) => i !== index);
      return base44.entities.Project.update(projectId, { timeline_events: updatedEvents });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
      toast({
        title: "Mijlpaal verwijderd",
      });
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (file) => {
      const { data } = await base44.integrations.Core.UploadFile({ file });
      const currentAttachments = project.attachments || [];
      const newAttachment = {
        file_url: data.file_url,
        file_name: file.name,
        uploaded_by: user.email,
        uploaded_at: new Date().toISOString()
      };
      const updatedAttachments = [...currentAttachments, newAttachment];
      return base44.entities.Project.update(projectId, { attachments: updatedAttachments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
      toast({
        title: "Bestand geüpload",
      });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (index) => {
      const updatedAttachments = project.attachments.filter((_, i) => i !== index);
      return base44.entities.Project.update(projectId, { attachments: updatedAttachments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
      toast({
        title: "Bestand verwijderd",
      });
    },
  });

  const togglePluginInstalledMutation = useMutation({
    mutationFn: (pluginId) => {
      const updatedPlugins = project.plugins.map(p =>
        p.plugin_id === pluginId ? { ...p, installed: !p.installed } : p
      );
      return base44.entities.Project.update(projectId, { plugins: updatedPlugins });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
    },
  });

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAttachmentMutation.mutate(file);
    }
  };

  const handleSaveNotes = () => {
    saveNotesMutation.mutate(notes);
  };

  const handleAddMember = () => {
    if (selectedMember && memberRole) {
      addMemberMutation.mutate({ userId: selectedMember, role: memberRole });
    }
  };

  const handleAddEvent = () => { // Renamed from handleAddTimeline
    if (newEvent.title && newEvent.date) { // Renamed
      addEventMutation.mutate(newEvent); // Renamed
    }
  };

  const handleEditSave = () => { // Renamed from handleUpdateProject
    updateProjectMutation.mutate(editForm);
  };

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

  const getUserName = (userId) => {
    const user = allUsers.find(u => u.id === userId);
    return user?.full_name || "Onbekend";
  };

  const getTeamMembers = () => {
    if (!team?.members) return [];
    // Filter out members who are already assigned to the project
    const assignedUserIds = new Set(project?.assigned_members?.map(m => m.user_id) || []);
    return team.members.filter(m => m.status === "active" && !assignedUserIds.has(m.user_id));
  };

  // Define canManage based on available user data.
  // In a real application, this would involve checking user roles, project ownership, or specific permissions.
  // For this implementation, we'll assume a user can manage if they are logged in.
  const canManage = !!user;
  const unreadProjectMessages = projectInboxMessages.filter(m => !m.is_read).length;

  if (isLoading || !project) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

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
            <h1 className="text-3xl font-bold text-gray-900 mb-1">{project.title}</h1>
            <p className="text-gray-500">{project.description}</p>
          </div>

          {/* Project Inbox - Send Message Button */}
          {canManage && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowProjectInboxDialog(true)}
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <Send className="w-4 h-4 mr-2" />
                Bericht naar Project
              </Button>

              {/* Project Inbox Icon - Replace old Popover with component */}
              <ProjectInboxPopover
                projectId={projectId}
                projectName={project.title}
                unreadCount={unreadProjectMessages}
                canDelete={canManage}
              />
            </>
          )}

          <Button variant="outline" onClick={() => setShowEditDialog(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Bewerken
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Project Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <Badge className={getStatusColor(project.status)}>
                  {project.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Prioriteit</p>
                <Badge className={getPriorityColor(project.priority)}>
                  {project.priority}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Team</p>
                <p className="text-sm font-medium">{team?.name || "Laden..."}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Site</p>
                <p className="text-sm font-medium">{site?.name || "Laden..."}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Planning
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {project.start_date && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Startdatum</p>
                  <p className="text-sm font-medium">
                    {format(new Date(project.start_date), "d MMMM yyyy", { locale: nl })}
                  </p>
                </div>
              )}
              {project.end_date && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Einddatum</p>
                  <p className="text-sm font-medium">
                    {format(new Date(project.end_date), "d MMMM yyyy", { locale: nl })}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1">Mijlpalen</p>
                <p className="text-sm font-medium">
                  {project.timeline_events?.length || 0} events
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4" />
                Resources
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Teamleden</p>
                <p className="text-sm font-medium">
                  {project.assigned_members?.length || 0} leden
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Plugins</p>
                <p className="text-sm font-medium">
                  {project.plugins?.length || 0} plugins
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Bestanden</p>
                <p className="text-sm font-medium">
                  {project.attachments?.length || 0} bestanden
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">
              <Briefcase className="w-4 h-4 mr-2" />
              Overzicht
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <Clock className="w-4 h-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="w-4 h-4 mr-2" />
              Teamleden
            </TabsTrigger>
            <TabsTrigger value="plugins">
              <Package className="w-4 h-4 mr-2" />
              Plugins
            </TabsTrigger>
            <TabsTrigger value="attachments">
              <FileText className="w-4 h-4 mr-2" />
              Bestanden
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle>Project Notities</CardTitle>
                  {!isEditingNotes ? (
                    canManage && (
                      <Button variant="outline" size="sm" onClick={() => setIsEditingNotes(true)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Bewerken
                      </Button>
                    )
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsEditingNotes(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                      <Button size="sm" onClick={handleSaveNotes} disabled={saveNotesMutation.isPending}>
                        <Save className="w-4 h-4 mr-2" />
                        {saveNotesMutation.isPending ? "Opslaan..." : "Opslaan"}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isEditingNotes ? (
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={10}
                    placeholder="Voeg projectnotities toe..."
                    className="w-full"
                  />
                ) : (
                  <div className="prose max-w-none">
                    {notes ? (
                      <p className="text-gray-700 whitespace-pre-wrap">{notes}</p>
                    ) : (
                      <p className="text-gray-400 italic">Nog geen notities toegevoegd</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            {canManage && (
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowEditDialog(true)}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Project Bewerken
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="space-y-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle>Project Timeline</CardTitle>
                  {canManage && (
                    <Button onClick={() => setShowAddEventDialog(true)} // Renamed
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white" // New style
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Mijlpaal Toevoegen
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {project.timeline_events && project.timeline_events.length > 0 ? (
                  <div className="space-y-4">
                    {project.timeline_events
                      .sort((a, b) => new Date(a.date) - new Date(b.date))
                      .map((event, index) => (
                        <div key={index} className="flex items-start gap-4 p-4 rounded-lg border hover:border-indigo-200 transition-all">
                          <button
                            onClick={() => canManage && toggleTimelineEventMutation.mutate(index)}
                            className="mt-1"
                            disabled={!canManage}
                          >
                            {event.completed ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <Circle className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className={`font-semibold ${event.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                  {event.title}
                                </h4>
                                <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                                <p className="text-xs text-gray-500 mt-2">
                                  {format(new Date(event.date), "d MMMM yyyy", { locale: nl })}
                                </p>
                              </div>
                              {canManage && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteTimelineEventMutation.mutate(index)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nog geen mijlpalen toegevoegd</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle>Toegewezen Teamleden</CardTitle>
                  {canManage && (
                    <Button onClick={() => setShowAddMemberDialog(true)}
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white" // New style
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Lid Toevoegen
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {project.assigned_members && project.assigned_members.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {project.assigned_members.map((member, index) => {
                      const memberUser = allUsers.find(u => u.id === member.user_id);
                      return (
                        <div key={index} className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback className="bg-indigo-100 text-indigo-700">
                                {getUserName(member.user_id).substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-gray-900">{getUserName(member.user_id)}</p>
                              <p className="text-xs text-gray-500">{member.role_on_project}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {canManage && member.user_id !== user?.id && memberUser && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedProjectMember({
                                    id: member.user_id,
                                    name: memberUser.full_name,
                                    email: memberUser.email
                                  });
                                  setShowProjectMemberMessageDialog(true);
                                }}
                              >
                                <Mail className="w-4 h-4 mr-2" />
                                Bericht
                              </Button>
                            )}
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeMemberMutation.mutate(member.user_id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nog geen teamleden toegewezen</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plugins Tab */}
          <TabsContent value="plugins" className="space-y-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <CardTitle>Project Plugins</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {plugins.length > 0 ? (
                  <div className="space-y-3">
                    {plugins.map((plugin) => {
                      const projectPlugin = project.plugins.find(p => p.plugin_id === plugin.id);
                      return (
                        <div key={plugin.id} className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                              <Package className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{plugin.name}</p>
                              <p className="text-xs text-gray-500">Versie: {projectPlugin?.version || plugin.latest_version}</p>
                            </div>
                          </div>
                          {canManage && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">
                                {projectPlugin?.installed ? "Geïnstalleerd" : "Niet geïnstalleerd"}
                              </span>
                              <Switch
                                checked={projectPlugin?.installed || false}
                                onCheckedChange={() => togglePluginInstalledMutation.mutate(plugin.id)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Geen plugins gekoppeld aan dit project</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attachments Tab */}
          <TabsContent value="attachments" className="space-y-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle>Project Bestanden</CardTitle>
                  {canManage && (
                    <Button onClick={() => document.getElementById('file-upload').click()}>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                  )}
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {project.attachments && project.attachments.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {project.attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="w-5 h-5 text-gray-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{attachment.file_name}</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(attachment.uploaded_at), "d MMM yyyy", { locale: nl })} • {attachment.uploaded_by}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                          >
                            <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
                              <Download className="w-4 h-4" />
                            </a>
                          </Button>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteAttachmentMutation.mutate(index)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nog geen bestanden geüpload</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Member Dialog */}
        <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Teamlid Toevoegen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Teamlid</Label>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer teamlid" />
                  </SelectTrigger>
                  <SelectContent>
                    {getTeamMembers().map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {getUserName(member.user_id)} ({member.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rol in Project</Label>
                <Input
                  placeholder="bijv. Developer, Designer, Tester"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddMember} disabled={!selectedMember || !memberRole || addMemberMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {addMemberMutation.isPending ? "Toevoegen..." : "Lid Toevoegen"}
                </Button>
                <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Event Dialog */}
        <Dialog open={showAddEventDialog} onOpenChange={setShowAddEventDialog}> {/* Renamed from showAddTimelineDialog */}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mijlpaal Toevoegen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Titel</Label>
                <Input
                  placeholder="Mijlpaal titel"
                  value={newEvent.title} // Renamed from newTimeline.title
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} // Renamed
                />
              </div>
              <div>
                <Label>Beschrijving</Label>
                <Textarea
                  placeholder="Beschrijving..."
                  value={newEvent.description} // Renamed from newTimeline.description
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} // Renamed
                  rows={3}
                />
              </div>
              <div>
                <Label>Datum</Label>
                <Input
                  type="date"
                  value={newEvent.date} // Renamed from newTimeline.date
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} // Renamed
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddEvent} disabled={!newEvent.title || !newEvent.date || addEventMutation.isPending} // Renamed handler and loading state
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {addEventMutation.isPending ? "Toevoegen..." : "Event Toevoegen"}
                </Button>
                <Button variant="outline" onClick={() => setShowAddEventDialog(false)}> {/* Renamed */}
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Project Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Project Bewerken</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Titel</Label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Beschrijving</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioriteit</Label>
                  <Select value={editForm.priority} onValueChange={(value) => setEditForm({ ...editForm, priority: value })}>
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Startdatum</Label>
                  <Input
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Einddatum</Label>
                  <Input
                    type="date"
                    value={editForm.end_date}
                    onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleEditSave} disabled={updateProjectMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {updateProjectMutation.isPending ? "Opslaan..." : "Opslaan"}
                </Button>
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <SendMessageDialog
          open={showProjectInboxDialog}
          onOpenChange={setShowProjectInboxDialog}
          isProjectInbox={true}
          projectId={projectId}
          projectName={project.title}
          context={{
            type: "project",
            id: projectId,
            name: project.title
          }}
        />

        <SendMessageDialog
          open={showProjectMemberMessageDialog}
          onOpenChange={setShowProjectMemberMessageDialog}
          toUserId={selectedProjectMember?.id}
          toUserName={selectedProjectMember?.name}
          context={{
            type: "project",
            id: projectId,
            name: project.title
          }}
        />
      </div>
    </div>
  );
}
