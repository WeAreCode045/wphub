
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Plus, Edit2, Trash2, Users, Package, Globe, ArrowLeft, CheckCircle, Edit, Bell } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export default function TeamRoles() {
  const [searchParams] = useSearchParams();
  const teamId = searchParams.get('id');
  const navigate = useNavigate();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleData, setRoleData] = useState({
    name: "",
    description: "",
    permissions: {
      sites: { view: false, create: false, edit: false, delete: false, share: false, manage_plugins: false },
      plugins: { view: false, create: false, edit: false, delete: false, share: false, install: false, uninstall: false, activate: false, deactivate: false, manage_versions: false },
      members: { view: false, invite: false, edit: false, remove: false, manage_roles: false },
      team: { view: true, edit_settings: false, manage_roles: false },
      notifications: { view: false, create: false, delete: false }
    }
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

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

  const { data: team } = useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      if (!teamId) return null;
      const teams = await base44.entities.Team.filter({ id: teamId });
      return teams[0] || null;
    },
    enabled: !!teamId,
  });

  const { data: teamRoles = [] } = useQuery({
    queryKey: ['team-roles', teamId],
    queryFn: () => base44.entities.TeamRole.filter({ team_id: teamId }, "-created_date"),
    enabled: !!teamId,
    initialData: [],
  });

  const createRoleMutation = useMutation({
    mutationFn: (roleData) => 
      base44.entities.TeamRole.create({
        ...roleData,
        team_id: teamId,
        type: "custom",
        is_active: true,
        assigned_count: 0
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-roles'] });
      resetDialog();
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ roleId, data }) => 
      base44.entities.TeamRole.update(roleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-roles'] });
      resetDialog();
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId) => base44.entities.TeamRole.delete(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-roles'] });
    },
  });

  const resetDialog = () => {
    setShowCreateDialog(false);
    setEditingRole(null);
    setRoleData({
      name: "",
      description: "",
      permissions: {
        sites: { view: false, create: false, edit: false, delete: false, share: false, manage_plugins: false },
        plugins: { view: false, create: false, edit: false, delete: false, share: false, install: false, uninstall: false, activate: false, deactivate: false, manage_versions: false },
        members: { view: false, invite: false, edit: false, remove: false, manage_roles: false },
        team: { view: true, edit_settings: false, manage_roles: false },
        notifications: { view: false, create: false, delete: false }
      }
    });
  };

  const handleEditRole = (role) => {
    setEditingRole(role);
    setRoleData({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions
    });
    setShowCreateDialog(true);
  };

  const handleSaveRole = () => {
    if (editingRole) {
      updateRoleMutation.mutate({ roleId: editingRole.id, data: roleData });
    } else {
      createRoleMutation.mutate(roleData);
    }
  };

  const togglePermission = (category, permission) => {
    setRoleData({
      ...roleData,
      permissions: {
        ...roleData.permissions,
        [category]: {
          ...roleData.permissions[category],
          [permission]: !roleData.permissions[category][permission]
        }
      }
    });
  };

  const toggleAllInCategory = (category, enable) => {
    const categoryPerms = roleData.permissions[category];
    const updatedPerms = {};
    Object.keys(categoryPerms).forEach(key => {
      updatedPerms[key] = enable;
    });
    setRoleData({
      ...roleData,
      permissions: {
        ...roleData.permissions,
        [category]: updatedPerms
      }
    });
  };

  if (!teamId || !team) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto text-center py-12">
          <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
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
  
  // Owner always has access to manage roles
  // Or members with team role that has manage_roles permission
  // Or members with legacy manage_members permission
  const canManageRoles = isOwner || 
    (member?.team_role_id && teamRoles.find(r => r.id === member.team_role_id)?.permissions?.team?.manage_roles) ||
    member?.permissions?.manage_members;

  if (!canManageRoles) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto text-center py-12">
          <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Geen toegang</h3>
          <p className="text-gray-500 mb-6">Je hebt geen rechten om team roles te beheren</p>
          <Button asChild>
            <Link to={createPageUrl(`TeamDetail?id=${teamId}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Terug naar Team
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const PermissionSection = ({ title, category, icon: Icon, permissions }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleAllInCategory(category, true)}
          >
            Alles aan
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleAllInCategory(category, false)}
          >
            Alles uit
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(permissions).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <Label htmlFor={`${category}_${key}`} className="text-sm cursor-pointer">
              {label}
            </Label>
            <Switch
              id={`${category}_${key}`}
              checked={roleData.permissions[category][key]}
              onCheckedChange={() => togglePermission(category, key)}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const filteredRoles = teamRoles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" asChild>
            <Link to={createPageUrl(`TeamDetail?id=${teamId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Team Roles</h1>
            <p className="text-gray-500">{team.name}</p>
          </div>

          <Dialog open={showCreateDialog} onOpenChange={(open) => {
            if (!open) resetDialog();
            setShowCreateDialog(open);
          }}>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-5 h-5 mr-2" />
                Nieuwe Role
            </Button>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRole ? "Role Bewerken" : "Nieuwe Team Role Aanmaken"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Role Naam *</Label>
                    <Input
                      id="name"
                      placeholder="Content Manager"
                      value={roleData.name}
                      onChange={(e) => setRoleData({ ...roleData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Beschrijving</Label>
                    <Textarea
                      id="description"
                      placeholder="Beschrijf wat deze role kan doen..."
                      value={roleData.description}
                      onChange={(e) => setRoleData({ ...roleData, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>

                <Separator />

                <Tabs defaultValue="sites" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="sites">Sites</TabsTrigger>
                    <TabsTrigger value="plugins">Plugins</TabsTrigger>
                    <TabsTrigger value="members">Members</TabsTrigger>
                    <TabsTrigger value="team">Team</TabsTrigger>
                    <TabsTrigger value="notifications">Notificaties</TabsTrigger>
                  </TabsList>

                  <TabsContent value="sites" className="space-y-4 mt-4">
                    <PermissionSection
                      title="Site Permissions"
                      category="sites"
                      icon={Globe}
                      permissions={{
                        view: "Bekijken",
                        create: "Aanmaken",
                        edit: "Bewerken",
                        delete: "Verwijderen",
                        share: "Delen",
                        manage_plugins: "Plugins beheren"
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="plugins" className="space-y-4 mt-4">
                    <PermissionSection
                      title="Plugin Permissions"
                      category="plugins"
                      icon={Package}
                      permissions={{
                        view: "Bekijken",
                        create: "Aanmaken",
                        edit: "Bewerken",
                        delete: "Verwijderen",
                        share: "Delen",
                        install: "Installeren",
                        uninstall: "Deïnstalleren",
                        activate: "Activeren",
                        deactivate: "Deactiveren",
                        manage_versions: "Versies beheren"
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="members" className="space-y-4 mt-4">
                    <PermissionSection
                      title="Member Management Permissions"
                      category="members"
                      icon={Users}
                      permissions={{
                        view: "Bekijken",
                        invite: "Uitnodigen",
                        edit: "Bewerken",
                        remove: "Verwijderen",
                        manage_roles: "Roles toewijzen"
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="team" className="space-y-4 mt-4">
                    <PermissionSection
                      title="Team Permissions"
                      category="team"
                      icon={Users}
                      permissions={{
                        view: "Team bekijken",
                        edit_settings: "Instellingen bewerken",
                        manage_roles: "Roles beheren"
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="notifications" className="space-y-4 mt-4">
                    <PermissionSection
                      title="Notification Permissions"
                      category="notifications"
                      icon={Bell}
                      permissions={{
                        view: "Notificaties bekijken",
                        create: "Notificaties aanmaken",
                        delete: "Notificaties verwijderen"
                      }}
                    />
                  </TabsContent>
                </Tabs>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={handleSaveRole}
                    disabled={!roleData.name}
                    className="flex-1"
                  >
                    {editingRole ? "Wijzigingen Opslaan" : "Role Aanmaken"}
                  </Button>
                  <Button variant="outline" onClick={resetDialog}>
                    Annuleren
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center space-x-4 mb-6">
          <Input
            placeholder="Zoek rollen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {filteredRoles.length === 0 ? (
            <Card className="border-none shadow-lg">
              <CardContent className="p-12 text-center">
                <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Geen rollen gevonden</h3>
                <p className="text-gray-500 mb-6">Pas je zoekterm aan of maak een nieuwe rol aan.</p>
                <Button onClick={() => setShowCreateDialog(true)} className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="w-5 h-5 mr-2" />
                  Nieuwe Role
                </Button>
              </CardContent>
            </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRoles.map((role) => (
              <Card key={role.id} className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{role.name}</CardTitle>
                        {role.type === "default" && (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Standaard
                          </Badge>
                        )}
                      </div>
                      {role.description && (
                        <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Permissions</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(role.permissions || {}).map(([category, perms]) => {
                        const activePerms = Object.entries(perms).filter(([_, value]) => value === true);
                        return activePerms.map(([perm, _]) => (
                          <Badge key={`${role.id}-${category}-${perm}`} variant="outline" className="text-xs">
                            {category}.{perm.replace(/_/g, ' ')}
                          </Badge>
                        ));
                      })}
                      {Object.values(role.permissions || {}).every(perms => Object.values(perms).every(v => v === false)) && (
                          <Badge variant="secondary" className="text-xs">Geen actieve permissies</Badge>
                        )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-2">
                    {role.type !== "default" ? (
                      <>
                        <Button asChild className="w-full" size="sm">
                          <Link to={createPageUrl(`TeamRoleDetail?id=${role.id}&team_id=${teamId}`)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Bewerken
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(`Weet je zeker dat je de rol "${role.name}" wilt verwijderen?`)) {
                              deleteRoleMutation.mutate(role.id);
                            }
                          }}
                          disabled={deleteRoleMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Verwijderen
                        </Button>
                      </>
                    ) : (
                      <div className="text-center py-2">
                        <p className="text-xs text-gray-500">
                          {role.name === "Owner" 
                            ? "De Owner rol kan niet worden bewerkt of verwijderd" 
                            : "Standaard rollen kunnen niet worden bewerkt of verwijderd"
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
