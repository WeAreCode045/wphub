
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  ArrowLeft,
  Settings,
  Crown,
  Shield,
  Mail,
  Trash2,
  Plus,
  Package,
  Globe,
  UserPlus,
  Share2,
  Edit2,
  AlertCircle,
  Activity,
  Bell,
  Inbox,
  Send,
  Briefcase // Added Briefcase icon
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TeamActivity from "../components/teams/TeamActivity";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import SendMessageDialog from "../components/messaging/SendMessageDialog";
import TeamInboxPopover from "../components/messaging/TeamInboxPopover";

// Default team roles - these are not stored in database
const DEFAULT_ROLES = {
  Owner: {
    id: "Owner",
    name: "Owner",
    description: "Team eigenaar met volledige controle en alle rechten",
    color: "bg-amber-100 text-amber-700",
    permissions: {
      sites: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        share: true,
        manage_plugins: true
      },
      plugins: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        share: true,
        install: true,
        uninstall: true,
        activate: true,
        deactivate: true,
        manage_versions: true
      },
      members: {
        view: true,
        invite: true,
        edit: true,
        remove: true,
        manage_roles: true
      },
      team: {
        view: true,
        edit_settings: true,
        manage_roles: true
      },
      notifications: { // Added for completeness, assumed owner has all
        view: true,
        create: true,
        edit: true,
        delete: true
      },
      inbox: { // Added for completeness, assumed owner has all
        view: true,
        send: true,
        delete: true
      },
      // New projects permissions for Owner
      projects: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        share: true
      }
    }
  },
  Admin: {
    id: "Admin",
    name: "Admin",
    description: "Alle rechten (zelfde als Owner), kan team instellingen en rollen beheren",
    color: "bg-purple-100 text-purple-700",
    permissions: {
      sites: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        share: true,
        manage_plugins: true
      },
      plugins: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        share: true,
        install: true,
        uninstall: true,
        activate: true,
        deactivate: true,
        manage_versions: true
      },
      members: {
        view: true,
        invite: true,
        edit: true,
        remove: true,
        manage_roles: true
      },
      team: {
        view: true,
        edit_settings: true,
        manage_roles: true
      },
      notifications: {
        view: true,
        create: true,
        edit: true,
        delete: true
      },
      inbox: {
        view: true,
        send: true,
        delete: true
      },
      // New projects permissions for Admin
      projects: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        share: true
      }
    }
  },
  Manager: {
    id: "Manager",
    name: "Manager",
    description: "Kan sites en plugins volledig beheren, en teamleden uitnodigen/bewerken",
    color: "bg-blue-100 text-blue-700",
    permissions: {
      sites: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        share: true,
        manage_plugins: true
      },
      plugins: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        share: true,
        install: true,
        uninstall: true,
        activate: true,
        deactivate: true,
        manage_versions: true
      },
      members: {
        view: true,
        invite: true,
        edit: true,
        remove: true,
        manage_roles: false
      },
      team: {
        view: true,
        edit_settings: false,
        manage_roles: false
      },
      notifications: {
        view: true,
        create: true,
        edit: false,
        delete: false
      },
      inbox: {
        view: true,
        send: true,
        delete: false
      },
      // New projects permissions for Manager
      projects: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        share: true
      }
    }
  },
  Member: {
    id: "Member",
    name: "Member",
    description: "Kan team resources bekijken en plugins activeren/deactiveren op sites",
    color: "bg-green-100 text-green-700",
    permissions: {
      sites: {
        view: true,
        create: false,
        edit: false,
        delete: false,
        share: false,
        manage_plugins: true
      },
      plugins: {
        view: true,
        create: false,
        edit: false,
        delete: false,
        share: false,
        install: false,
        uninstall: false,
        activate: true,
        deactivate: true,
        manage_versions: false
      },
      members: {
        view: true,
        invite: false,
        edit: false,
        remove: false,
        manage_roles: false
      },
      team: {
        view: true,
        edit_settings: false,
        manage_roles: false
      },
      notifications: {
        view: true,
        create: false,
        edit: false,
        delete: false
      },
      inbox: {
        view: true,
        send: false,
        delete: false
      },
      // New projects permissions for Member
      projects: {
        view: true,
        create: false,
        edit: false,
        delete: false,
        share: false
      }
    }
  }
};

export default function TeamDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const teamId = urlParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditMemberDialog, setShowEditMemberDialog] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTeamRoleId, setInviteTeamRoleId] = useState("Member");
  const [user, setUser] = useState(null);
  const [teamNotificationsOpen, setTeamNotificationsOpen] = useState(false);
  // const [teamInboxOpen, setTeamInboxOpen] = useState(false); // Removed as Popover is replaced
  const [showNewNotificationDialog, setShowNewNotificationDialog] = useState(false);
  const [showTeamInboxDialog, setShowTeamInboxDialog] = useState(false);
  const [showTeamMemberMessageDialog, setShowTeamMemberMessageDialog] = useState(false);
  const [selectedTeamMember, setSelectedTeamMember] = useState(null);
  const [newNotification, setNewNotification] = useState({
    title: "",
    message: "",
    type: "team_announcement"
  });
  const [activeTab, setActiveTab] = useState("overview"); // Added activeTab state

  useEffect(() => {
    if (!teamId) {
      navigate(createPageUrl("Teams"));
    }
    loadUser();
  }, [teamId, navigate]);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: team, isLoading } = useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      if (!teamId) return null;
      const teams = await base44.entities.Team.filter({ id: teamId });
      return teams[0] || null;
    },
    enabled: !!teamId,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const { data: teamPlugins = [] } = useQuery({
    queryKey: ['team-plugins', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const allPlugins = await base44.entities.Plugin.list();
      return allPlugins.filter(p =>
        p.owner_type === "team" && p.owner_id === teamId ||
        p.shared_with_teams?.includes(teamId)
      );
    },
    enabled: !!teamId,
    initialData: [],
  });

  const { data: teamSites = [] } = useQuery({
    queryKey: ['team-sites', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const allSites = await base44.entities.Site.list();
      return allSites.filter(s =>
        s.owner_type === "team" && s.owner_id === teamId ||
        s.shared_with_teams?.includes(teamId)
      );
    },
    enabled: !!teamId,
    initialData: [],
  });

  // Get custom roles only (default roles are constants)
  const { data: customRoles = [] } = useQuery({
    queryKey: ['team-custom-roles', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      return await base44.entities.TeamRole.filter({ team_id: teamId, is_active: true });
    },
    enabled: !!teamId,
    initialData: [],
  });

  const { data: teamNotifications = [] } = useQuery({
    queryKey: ['team-notifications', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      return base44.entities.Notification.filter({
        recipient_type: "team",
        team_id: teamId
      }, "-created_date", 20);
    },
    enabled: !!teamId,
    initialData: [],
  });

  const { data: teamInboxMessages = [] } = useQuery({
    queryKey: ['team-inbox', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      return base44.entities.Message.filter({
        recipient_type: "team",
        team_id: teamId
      }, "-created_date", 20);
    },
    enabled: !!teamId,
    initialData: [],
  });

  const { data: teamProjects = [] } = useQuery({
    queryKey: ['team-projects', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const allProjects = await base44.entities.Project.list("-updated_date");
      return allProjects.filter(p => p.team_id === teamId);
    },
    enabled: !!teamId,
    initialData: [],
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async () => {
      const users = await base44.entities.User.filter({ email: inviteEmail });

      if (users.length === 0) {
        throw new Error('Alleen reeds geregistreerde gebruikers kunnen worden uitgenodigd.');
      }

      const existingUser = users[0];
      const currentMembers = team.members || [];

      if (currentMembers.some(m => m.user_id === existingUser.id)) {
        throw new Error('Deze gebruiker is al lid van het team (of is al uitgenodigd).');
      }

      const updatedMembers = [
        ...currentMembers,
        {
          user_id: existingUser.id,
          email: existingUser.email,
          team_role_id: inviteTeamRoleId,
          status: "pending",
          joined_at: new Date().toISOString()
        }
      ];

      await base44.entities.Team.update(teamId, { members: updatedMembers });

      const invite = await base44.entities.TeamInvite.create({
        team_id: teamId,
        team_name: team.name,
        invited_email: inviteEmail,
        invited_by_id: user.id,
        invited_by_name: user.full_name,
        team_role_id: inviteTeamRoleId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });

      await base44.entities.Notification.create({
        recipient_id: existingUser.id,
        recipient_email: existingUser.email,
        title: `Uitnodiging voor team: ${team.name}`,
        message: `Je bent uitgenodigd voor het team "${team.name}" door ${user.full_name}`,
        type: "team_invite",
        team_invite_id: invite.id,
        team_id: teamId
      });

      await base44.entities.ActivityLog.create({
        user_email: user.email,
        action: `${existingUser.full_name} uitgenodigd voor team ${team.name}`,
        entity_type: "team",
        entity_id: teamId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteTeamRoleId("Member");
    },
    onError: (error) => {
      alert('❌ Fout bij uitnodigen: ' + error.message);
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId) => {
      const updatedMembers = (team.members || []).filter(m => m.user_id !== memberId);
      return base44.entities.Team.update(teamId, { members: updatedMembers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ memberId, team_role_id }) => {
      const currentMembers = team.members || [];
      const memberIndex = currentMembers.findIndex(m => m.user_id === memberId);

      if (memberIndex === -1) {
        throw new Error('Teamlid niet gevonden');
      }

      const updatedMembers = currentMembers.map((m, index) =>
        index === memberIndex
          ? { ...m, team_role_id }
          : m
      );

      await base44.entities.Team.update(teamId, { members: updatedMembers });

      const memberUser = allUsers.find(u => u.id === memberId);
      if (memberUser) {
        await base44.entities.Notification.create({
          recipient_id: memberUser.id,
          recipient_email: memberUser.email,
          title: `Je rol in team "${team.name}" is bijgewerkt`,
          message: `Je rol is bijgewerkt door ${user.full_name}`,
          type: "info"
        });
      }

      await base44.entities.ActivityLog.create({
        user_email: user.email,
        action: `Rol bijgewerkt voor ${memberUser?.full_name || 'teamlid'} in team ${team.name}`,
        entity_type: "team",
        entity_id: teamId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setShowEditMemberDialog(false);
      setEditingMember(null);
    },
  });

  const createTeamNotificationMutation = useMutation({
    mutationFn: async (notificationData) => {
      return base44.entities.Notification.create({
        ...notificationData,
        recipient_type: "team",
        team_id: teamId,
        sender_id: user.id,
        sender_name: user.full_name
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-notifications'] });
      setShowNewNotificationDialog(false);
      setNewNotification({
        title: "",
        message: "",
        type: "team_announcement"
      });
      alert('✅ Team notificatie verstuurd');
    },
  });

  const markTeamNotificationAsReadMutation = useMutation({
    mutationFn: (notificationId) =>
      base44.entities.Notification.update(notificationId, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-notifications'] });
    },
  });

  const deleteTeamNotificationMutation = useMutation({
    mutationFn: (notificationId) => base44.entities.Notification.delete(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-notifications'] });
      alert('✅ Notificatie verwijderd');
    },
  });

  const handleEditMember = (member) => {
    setEditingMember({
      ...member,
      new_team_role_id: member.team_role_id || "Member"
    });
    setShowEditMemberDialog(true);
  };

  const handleSaveMemberChanges = () => {
    if (!editingMember || !editingMember.new_team_role_id) {
      alert('Selecteer een rol');
      return;
    }

    updateMemberMutation.mutate({
      memberId: editingMember.user_id,
      team_role_id: editingMember.new_team_role_id
    });
  };

  const handleSendNotification = () => {
    if (!newNotification.title || !newNotification.message) {
      alert('Vul alle velden in');
      return;
    }
    createTeamNotificationMutation.mutate(newNotification);
  };

  if (!teamId || !team) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto text-center py-12">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Team niet gevonden</h3>
          <Button asChild>
            <Link to={createPageUrl("Teams")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Terug naar Teams
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = team.owner_id === user?.id;
  const member = team.members?.find(m => m.user_id === user?.id);
  const isPendingMember = member?.status === "pending";

  // Redirect pending members back to Teams page
  if (isPendingMember) {
    navigate(createPageUrl("Teams"));
    return null;
  }

  const getMemberRole = (memberId) => {
    const m = team.members?.find(m => m.user_id === memberId);
    if (!m || !m.team_role_id) return null;

    // Check if it's a default role
    if (DEFAULT_ROLES[m.team_role_id]) {
      return DEFAULT_ROLES[m.team_role_id];
    }

    // Otherwise it's a custom role
    return customRoles.find(r => r.id === m.team_role_id);
  };

  const currentUserRole = getMemberRole(user?.id);

  // Determine permissions based on role
  const getPermissions = (role) => {
    if (!role) return {};

    // If it's a default role, use the permissions from DEFAULT_ROLES
    if (DEFAULT_ROLES[role.id]) {
      return DEFAULT_ROLES[role.id].permissions;
    }

    // Otherwise it's a custom role with its own permissions
    return role.permissions || {};
  };

  const permissions = getPermissions(currentUserRole);

  const hasPermission = (category, action) => {
    if (isOwner) return true;
    if (!currentUserRole || !currentUserRole.permissions) return false;
    return currentUserRole.permissions[category]?.[action] === true;
  };

  const getUserById = (userId) => allUsers.find(u => u.id === userId);

  const getRoleName = (roleId) => {
    if (DEFAULT_ROLES[roleId]) return DEFAULT_ROLES[roleId].name;
    const role = customRoles.find(r => r.id === roleId);
    return role?.name || "Geen rol";
  };

  const getRoleBadgeColor = (roleId) => {
    if (DEFAULT_ROLES[roleId]) return DEFAULT_ROLES[roleId].color;
    return "bg-indigo-100 text-indigo-700";
  };

  // All available roles (default + custom)
  const allAvailableRoles = [
    ...Object.values(DEFAULT_ROLES).filter(r => r.id !== "Owner"), // Owner can't be assigned manually
    ...customRoles
  ];

  const unreadTeamNotifications = teamNotifications.filter(n => !n.is_read).length;
  const unreadTeamMessages = teamInboxMessages.filter(m => !m.is_read).length;

  const getNotificationIcon = (type) => {
    switch (type) {
      case "team_announcement":
        return <Bell className="w-4 h-4 text-indigo-600" />;
      case "success":
        return <Shield className="w-4 h-4 text-green-600" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case "info":
        return <Activity className="w-4 h-4 text-blue-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" asChild>
            <Link to={createPageUrl("Teams")}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{team.name}</h1>
            {team.description && (
              <p className="text-gray-500 mt-1">{team.description}</p>
            )}
          </div>

          {/* Team Inbox - Send Message Button */}
          {(isOwner || hasPermission('inbox', 'send')) && (
            <Button
              variant="outline"
              onClick={() => setShowTeamInboxDialog(true)}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <Send className="w-4 h-4 mr-2" />
              Bericht naar Team
            </Button>
          )}

          {/* Team Inbox Icon - Replace old Popover with component */}
          {(isOwner || hasPermission('inbox', 'view')) && (
            <TeamInboxPopover
              teamId={teamId}
              teamName={team.name}
              unreadCount={unreadTeamMessages}
              canDelete={isOwner || hasPermission('inbox', 'delete')}
            />
          )}

          {/* Team Notifications Icon */}
          {(isOwner || hasPermission('notifications', 'view')) && (
            <Popover open={teamNotificationsOpen} onOpenChange={setTeamNotificationsOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadTeamNotifications > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                      {unreadTeamNotifications > 9 ? '9+' : unreadTeamNotifications}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="end">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Team Notificaties</h3>
                    <p className="text-xs text-gray-500 mt-1">{unreadTeamNotifications} ongelezen</p>
                  </div>
                  {(isOwner || hasPermission('notifications', 'create')) && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setTeamNotificationsOpen(false);
                        setShowNewNotificationDialog(true);
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Nieuw
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-80">
                  <div className="p-2">
                    {teamNotifications.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Geen notificaties</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {teamNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-3 rounded-lg transition-colors ${
                              notification.is_read ? 'bg-white' : 'bg-blue-50'
                            }`}
                          >
                            <div className="flex items-start gap-2 mb-2">
                              {getNotificationIcon(notification.type)}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                                <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {notification.sender_name && (
                                    <>
                                      <p className="text-xs text-gray-400">
                                        Van: {notification.sender_name}
                                      </p>
                                      <span className="text-xs text-gray-400">•</span>
                                    </>
                                  )}
                                  <p className="text-xs text-gray-400">
                                    {format(new Date(notification.created_date), "d MMM HH:mm", { locale: nl })}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-2">
                              {!notification.is_read && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="flex-1 h-7 text-xs"
                                  onClick={() => markTeamNotificationAsReadMutation.mutate(notification.id)}
                                >
                                  Markeer als gelezen
                                </Button>
                              )}
                              {(isOwner || hasPermission('notifications', 'delete')) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-red-600 hover:text-red-700"
                                  onClick={() => {
                                    if (confirm('Weet je zeker dat je deze notificatie wilt verwijderen?')) {
                                      deleteTeamNotificationMutation.mutate(notification.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}

          {isOwner && (
            <>
              <Button asChild variant="outline">
                <Link to={createPageUrl(`TeamRoles?id=${teamId}`)}>
                  <Shield className="w-4 h-4 mr-2" />
                  Roles
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={createPageUrl(`TeamSettings?id=${teamId}`)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Instellingen
                </Link>
              </Button>
            </>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">
              <Activity className="w-4 h-4 mr-2" />
              Overzicht
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="w-4 h-4 mr-2" />
              Teamleden
            </TabsTrigger>
            <TabsTrigger value="projects">
              <Briefcase className="w-4 h-4 mr-2" />
              Projecten
            </TabsTrigger>
            <TabsTrigger value="plugins">
              <Package className="w-4 h-4 mr-2" />
              Plugins
            </TabsTrigger>
            <TabsTrigger value="sites">
              <Globe className="w-4 h-4 mr-2" />
              Sites
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-4 gap-6">
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-500">Teamleden</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{team.members?.length || 0}</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-500">Projecten</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{teamProjects.length}</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-500">Plugins</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{teamPlugins.length}</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-500">Sites</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{teamSites.length}</p>
                </CardContent>
              </Card>
            </div>
            {(isOwner || hasPermission('members', 'invite')) && (
              <Button
                onClick={() => setShowInviteDialog(true)}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Lid Uitnodigen
              </Button>
            )}
             <Card className="border-none shadow-lg mt-6">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-500">Jouw Rol</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={getRoleBadgeColor(member?.team_role_id)}>
                    <Shield className="w-3 h-3 mr-1" />
                    {getRoleName(member?.team_role_id)}
                  </Badge>
                </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="members">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle>Teamleden ({team.members?.length || 0})</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {(team.members || []).map((member) => {
                    const memberUser = getUserById(member.user_id);
                    const memberIsOwner = member.team_role_id === "Owner";
                    const isPending = member.status === "pending";

                    return (
                      <div key={member.user_id} className={`flex items-center justify-between p-4 rounded-lg border ${
                        isPending ? 'border-amber-200 bg-amber-50' : 'border-gray-200'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 bg-gradient-to-br rounded-full flex items-center justify-center ${
                            isPending ? 'from-amber-100 to-amber-200' : 'from-indigo-100 to-indigo-200'
                          }`}>
                            <span className={`font-semibold ${
                              isPending ? 'text-amber-700' : 'text-indigo-700'
                            }`}>
                              {memberUser?.full_name?.charAt(0) || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{memberUser?.full_name || member.email}</p>
                            <p className="text-sm text-gray-500">{member.email}</p>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              <Badge className={getRoleBadgeColor(member.team_role_id)}>
                                <Shield className="w-3 h-3 mr-1" />
                                {getRoleName(member.team_role_id)}
                              </Badge>
                              {isPending && (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  In afwachting
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {!memberIsOwner && (
                          <div className="flex gap-2">
                            {(isOwner || hasPermission('inbox', 'send')) && member.user_id !== user?.id && !isPending && memberUser && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedTeamMember({
                                    id: member.user_id,
                                    name: memberUser.full_name,
                                    email: member.email
                                  });
                                  setShowTeamMemberMessageDialog(true);
                                }}
                              >
                                <Mail className="w-4 h-4 mr-2" />
                                Bericht
                              </Button>
                            )}
                            {(isOwner || hasPermission('members', 'edit')) && member.user_id !== user?.id && !isPending && (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleEditMember(member)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )}
                            {(isOwner || hasPermission('members', 'remove')) && member.user_id !== user?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm('Weet je zeker dat je dit lid wilt verwijderen?')) {
                                    removeMemberMutation.mutate(member.user_id);
                                  }
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle>Team Projecten ({teamProjects.length})</CardTitle>
                  {(isOwner || hasPermission('projects', 'create')) && (
                    <Button size="sm" asChild>
                      <Link to={createPageUrl("Projects")}>
                        <Plus className="w-4 h-4 mr-2" />
                        Project Toevoegen
                      </Link>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {teamProjects.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>Nog geen projecten voor dit team</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teamProjects.map((project) => (
                      <div key={project.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex items-center justify-center">
                            <Briefcase className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{project.title}</p>
                            <p className="text-sm text-gray-500">{project.description}</p>
                            <div className="flex gap-2 mt-1">
                              <Badge className={
                                project.status === "completed" ? "bg-green-100 text-green-700" :
                                project.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                                project.status === "on_hold" ? "bg-amber-100 text-amber-700" :
                                "bg-gray-100 text-gray-700"
                              }>
                                {project.status}
                              </Badge>
                              <Badge className={
                                project.priority === "urgent" ? "bg-red-100 text-red-700" :
                                project.priority === "high" ? "bg-orange-100 text-orange-700" :
                                project.priority === "medium" ? "bg-blue-100 text-blue-700" :
                                "bg-gray-100 text-gray-700"
                              }>
                                {project.priority}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {(isOwner || hasPermission('projects', 'view')) && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)}>
                              Bekijken
                            </Link>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plugins">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle>Team Plugins ({teamPlugins.length})</CardTitle>
                  {(isOwner || hasPermission('plugins', 'create')) && (
                    <Button size="sm" asChild>
                      <Link to={createPageUrl("Plugins")}>
                        <Plus className="w-4 h-4 mr-2" />
                        Plugin Toevoegen
                      </Link>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {teamPlugins.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>Nog geen plugins voor dit team</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teamPlugins.map((plugin) => (
                      <div key={plugin.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{plugin.name}</p>
                            <p className="text-sm text-gray-500">{plugin.description}</p>
                            {plugin.owner_type === "user" && (
                              <Badge variant="outline" className="mt-1">
                                <Share2 className="w-3 h-3 mr-1" />
                                Gedeeld
                              </Badge>
                            )}
                          </div>
                        </div>
                        {(isOwner || hasPermission('plugins', 'view')) && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to={createPageUrl(`PluginDetail?id=${plugin.id}`)}>
                              Bekijken
                            </Link>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sites">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle>Team Sites ({teamSites.length})</CardTitle>
                  {(isOwner || hasPermission('sites', 'create')) && (
                    <Button size="sm" asChild>
                      <Link to={createPageUrl("Sites")}>
                        <Plus className="w-4 h-4 mr-2" />
                        Site Toevoegen
                      </Link>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {teamSites.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Globe className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>Nog geen sites voor dit team</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teamSites.map((site) => (
                      <div key={site.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-lg flex items-center justify-center">
                            <Globe className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{site.name}</p>
                            <p className="text-sm text-gray-500">{site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
                            {site.owner_type === "user" && (
                              <Badge variant="outline" className="mt-1">
                                <Share2 className="w-3 h-3 mr-1" />
                                Gedeeld
                              </Badge>
                            )}
                          </div>
                        </div>
                        {(isOwner || hasPermission('sites', 'view')) && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to={createPageUrl(`SiteDetail?id=${site.id}`)}>
                              Bekijken
                            </Link>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Moved activity tab to the end after previous changes */}
          <TabsContent value="activity">
            <TeamActivity teamId={teamId} />
          </TabsContent>
        </Tabs>

        {/* New Team Notification Dialog */}
        <Dialog open={showNewNotificationDialog} onOpenChange={setShowNewNotificationDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nieuwe Team Notificatie</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="notification-title">Titel *</Label>
                <Input
                  id="notification-title"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification({...newNotification, title: e.target.value})}
                  placeholder="Titel van de notificatie"
                />
              </div>
              <div>
                <Label htmlFor="notification-message">Bericht *</Label>
                <Textarea
                  id="notification-message"
                  value={newNotification.message}
                  onChange={(e) => setNewNotification({...newNotification, message: e.target.value})}
                  placeholder="Schrijf je bericht..."
                  rows={5}
                />
              </div>
              <div>
                <Label htmlFor="notification-type">Type</Label>
                <Select
                  value={newNotification.type}
                  onValueChange={(value) => setNewNotification({...newNotification, type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team_announcement">Aankondiging</SelectItem>
                    <SelectItem value="info">Informatie</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Waarschuwing</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={handleSendNotification}
                  disabled={createTeamNotificationMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {createTeamNotificationMutation.isPending ? "Versturen..." : "Verstuur Notificatie"}
                </Button>
                <Button variant="outline" onClick={() => setShowNewNotificationDialog(false)}>
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Invite Dialog */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Teamlid Uitnodigen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="email">E-mailadres *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="naam@voorbeeld.nl"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Alleen reeds geregistreerde gebruikers kunnen worden uitgenodigd.
                </p>
              </div>
              <div>
                <Label htmlFor="team_role">Team Rol *</Label>
                <Select value={inviteTeamRoleId} onValueChange={setInviteTeamRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer een rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {allAvailableRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          <span>{role.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {DEFAULT_ROLES[inviteTeamRoleId]?.description ||
                    customRoles.find(r => r.id === inviteTeamRoleId)?.description}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => inviteMemberMutation.mutate()}
                  disabled={!inviteEmail || !inviteTeamRoleId || inviteMemberMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {inviteMemberMutation.isPending ? "Uitnodigen..." : "Uitnodiging Versturen"}
                </Button>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showEditMemberDialog} onOpenChange={setShowEditMemberDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Teamlid Rol Bewerken</DialogTitle>
            </DialogHeader>
            {editingMember && (
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-sm text-gray-500">Teamlid</Label>
                  <p className="font-semibold text-gray-900 mt-1">
                    {getUserById(editingMember.user_id)?.full_name || editingMember.email}
                  </p>
                  <p className="text-sm text-gray-500">{editingMember.email}</p>
                </div>

                <div>
                  <Label htmlFor="edit_team_role">Team Rol *</Label>
                  <Select
                    value={editingMember.new_team_role_id || ""}
                    onValueChange={(value) => setEditingMember({
                      ...editingMember,
                      new_team_role_id: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer een rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {allAvailableRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            <span>{role.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {DEFAULT_ROLES[editingMember.new_team_role_id]?.description ||
                     customRoles.find(r => r.id === editingMember.new_team_role_id)?.description}
                  </p>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={handleSaveMemberChanges}
                    disabled={!editingMember.new_team_role_id || updateMemberMutation.isPending}
                    className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                  >
                    Wijzigingen Opslaan
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditMemberDialog(false);
                      setEditingMember(null);
                    }}
                  >
                    Annuleren
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <SendMessageDialog
          open={showTeamInboxDialog}
          onOpenChange={setShowTeamInboxDialog}
          isTeamInbox={true}
          toTeamId={teamId}
          toTeamName={team.name}
          context={{
            type: "team",
            id: teamId,
            name: team.name
          }}
        />

        <SendMessageDialog
          open={showTeamMemberMessageDialog}
          onOpenChange={setShowTeamMemberMessageDialog}
          toTeamMemberId={selectedTeamMember?.id}
          toTeamMemberName={selectedTeamMember?.name}
          context={{
            type: "team",
            id: teamId,
            name: team.name
          }}
        />
      </div>
    </div>
  );
}
