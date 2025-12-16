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
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  Users,
  Crown,
  Package,
  Globe,
  Settings
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export default function RoleManager() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleData, setRoleData] = useState({
    name: "",
    description: "",
    permissions: {
      sites: { view: false, create: false, edit: false, delete: false, share: false, manage_plugins: false },
      plugins: { view: false, create: false, edit: false, delete: false, share: false, install: false, uninstall: false, activate: false, deactivate: false, manage_versions: false },
      users: { view: false, invite: false, edit: false, delete: false, manage_roles: false },
      teams: { view: false, create: false, edit: false, delete: false, manage_members: false },
      platform: { manage_roles: false, view_analytics: false, manage_settings: false }
    }
  });
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => base44.entities.Role.list("-created_date"),
    initialData: [],
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const createRoleMutation = useMutation({
    mutationFn: (roleData) => 
      base44.entities.Role.create({
        ...roleData,
        type: "custom",
        is_active: true,
        assigned_count: 0
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      resetDialog();
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ roleId, data }) => 
      base44.entities.Role.update(roleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      resetDialog();
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId) => base44.entities.Role.delete(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
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
        users: { view: false, invite: false, edit: false, delete: false, manage_roles: false },
        teams: { view: false, create: false, edit: false, delete: false, manage_members: false },
        platform: { manage_roles: false, view_analytics: false, manage_settings: false }
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

  const getRoleUsersCount = (roleId) => {
    return users.filter(u => u.custom_role_id === roleId).length;
  };

  const canManageRoles = user?.role === "admin";

  if (!canManageRoles) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto text-center py-12">
          <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Geen toegang</h3>
          <p className="text-gray-500">Alleen admins kunnen roles beheren</p>
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

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Role Management</h1>
            <p className="text-gray-500">Beheer platform-wide roles en permissions</p>
          </div>

          <Dialog open={showCreateDialog} onOpenChange={(open) => {
            if (!open) resetDialog();
            setShowCreateDialog(open);
          }}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-5 h-5 mr-2" />
                Nieuwe Role
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRole ? "Role Bewerken" : "Nieuwe Role Aanmaken"}</DialogTitle>
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
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="teams">Teams</TabsTrigger>
                    <TabsTrigger value="platform">Platform</TabsTrigger>
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

                  <TabsContent value="users" className="space-y-4 mt-4">
                    <PermissionSection
                      title="User Management Permissions"
                      category="users"
                      icon={Users}
                      permissions={{
                        view: "Bekijken",
                        invite: "Uitnodigen",
                        edit: "Bewerken",
                        delete: "Verwijderen",
                        manage_roles: "Roles toewijzen"
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="teams" className="space-y-4 mt-4">
                    <PermissionSection
                      title="Team Permissions"
                      category="teams"
                      icon={Users}
                      permissions={{
                        view: "Bekijken",
                        create: "Aanmaken",
                        edit: "Bewerken",
                        delete: "Verwijderen",
                        manage_members: "Members beheren"
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="platform" className="space-y-4 mt-4">
                    <PermissionSection
                      title="Platform Permissions"
                      category="platform"
                      icon={Settings}
                      permissions={{
                        manage_roles: "Roles beheren",
                        view_analytics: "Analytics bekijken",
                        manage_settings: "Instellingen beheren"
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

        <div className="grid gap-6">
          {roles.length === 0 ? (
            <Card className="border-none shadow-lg">
              <CardContent className="p-12 text-center">
                <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Nog geen custom roles</h3>
                <p className="text-gray-500 mb-6">Maak je eerste custom role aan</p>
                <Button onClick={() => setShowCreateDialog(true)} className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="w-5 h-5 mr-2" />
                  Nieuwe Role
                </Button>
              </CardContent>
            </Card>
          ) : (
            roles.map((role) => {
              const userCount = getRoleUsersCount(role.id);
              const isSystem = role.type === "system";
              
              return (
                <Card key={role.id} className="border-none shadow-lg">
                  <CardHeader className="border-b border-gray-100">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          isSystem ? 'bg-gradient-to-br from-amber-100 to-amber-200' : 'bg-gradient-to-br from-indigo-100 to-indigo-200'
                        }`}>
                          {isSystem ? (
                            <Crown className="w-6 h-6 text-amber-600" />
                          ) : (
                            <Shield className="w-6 h-6 text-indigo-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle>{role.name}</CardTitle>
                            {isSystem && (
                              <Badge className="bg-amber-100 text-amber-700">System</Badge>
                            )}
                            {!role.is_active && (
                              <Badge variant="outline" className="text-gray-500">Inactief</Badge>
                            )}
                          </div>
                          {role.description && (
                            <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {userCount} {userCount === 1 ? 'gebruiker' : 'gebruikers'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {!isSystem && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditRole(role)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (userCount > 0) {
                                alert(`Deze role is toegewezen aan ${userCount} gebruiker(s). Verwijder eerst de role van deze gebruikers.`);
                                return;
                              }
                              if (confirm('Weet je zeker dat je deze role wilt verwijderen?')) {
                                deleteRoleMutation.mutate(role.id);
                              }
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {role.permissions.sites && Object.values(role.permissions.sites).some(v => v) && (
                        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Globe className="w-4 h-4 text-emerald-600" />
                            <h4 className="font-semibold text-emerald-900">Sites</h4>
                          </div>
                          <ul className="text-sm text-emerald-700 space-y-1">
                            {role.permissions.sites.view && <li>• Bekijken</li>}
                            {role.permissions.sites.create && <li>• Aanmaken</li>}
                            {role.permissions.sites.edit && <li>• Bewerken</li>}
                            {role.permissions.sites.delete && <li>• Verwijderen</li>}
                            {role.permissions.sites.share && <li>• Delen</li>}
                            {role.permissions.sites.manage_plugins && <li>• Plugins beheren</li>}
                          </ul>
                        </div>
                      )}

                      {role.permissions.plugins && Object.values(role.permissions.plugins).some(v => v) && (
                        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="w-4 h-4 text-indigo-600" />
                            <h4 className="font-semibold text-indigo-900">Plugins</h4>
                          </div>
                          <ul className="text-sm text-indigo-700 space-y-1">
                            {role.permissions.plugins.view && <li>• Bekijken</li>}
                            {role.permissions.plugins.create && <li>• Aanmaken</li>}
                            {role.permissions.plugins.edit && <li>• Bewerken</li>}
                            {role.permissions.plugins.delete && <li>• Verwijderen</li>}
                            {role.permissions.plugins.install && <li>• Installeren</li>}
                            {role.permissions.plugins.activate && <li>• Activeren</li>}
                          </ul>
                        </div>
                      )}

                      {role.permissions.users && Object.values(role.permissions.users).some(v => v) && (
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-purple-600" />
                            <h4 className="font-semibold text-purple-900">Users</h4>
                          </div>
                          <ul className="text-sm text-purple-700 space-y-1">
                            {role.permissions.users.view && <li>• Bekijken</li>}
                            {role.permissions.users.invite && <li>• Uitnodigen</li>}
                            {role.permissions.users.edit && <li>• Bewerken</li>}
                            {role.permissions.users.delete && <li>• Verwijderen</li>}
                            {role.permissions.users.manage_roles && <li>• Roles toewijzen</li>}
                          </ul>
                        </div>
                      )}

                      {role.permissions.teams && Object.values(role.permissions.teams).some(v => v) && (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-blue-600" />
                            <h4 className="font-semibold text-blue-900">Teams</h4>
                          </div>
                          <ul className="text-sm text-blue-700 space-y-1">
                            {role.permissions.teams.view && <li>• Bekijken</li>}
                            {role.permissions.teams.create && <li>• Aanmaken</li>}
                            {role.permissions.teams.edit && <li>• Bewerken</li>}
                            {role.permissions.teams.delete && <li>• Verwijderen</li>}
                            {role.permissions.teams.manage_members && <li>• Members beheren</li>}
                          </ul>
                        </div>
                      )}

                      {role.permissions.platform && Object.values(role.permissions.platform).some(v => v) && (
                        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Settings className="w-4 h-4 text-amber-600" />
                            <h4 className="font-semibold text-amber-900">Platform</h4>
                          </div>
                          <ul className="text-sm text-amber-700 space-y-1">
                            {role.permissions.platform.manage_roles && <li>• Roles beheren</li>}
                            {role.permissions.platform.view_analytics && <li>• Analytics</li>}
                            {role.permissions.platform.manage_settings && <li>• Instellingen</li>}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}