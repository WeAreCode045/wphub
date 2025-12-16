
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Trash2, AlertTriangle, Shield } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

export default function TeamSettings() {
  const urlParams = new URLSearchParams(window.location.search);
  const teamId = urlParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [teamData, setTeamData] = useState({
    name: "",
    description: "",
    avatar_url: ""
  });

  const [settings, setSettings] = useState({
    allow_member_invites: false,
    default_team_role_id: "Member"
  });

  const [user, setUser] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
      const foundTeam = teams[0] || null;

      if (foundTeam) {
        setTeamData({
          name: foundTeam.name || "",
          description: foundTeam.description || "",
          avatar_url: foundTeam.avatar_url || ""
        });
        setSettings({
          allow_member_invites: foundTeam.settings?.allow_member_invites || false,
          default_team_role_id: foundTeam.settings?.default_team_role_id || "Member"
        });
      }

      return foundTeam;
    },
    enabled: !!teamId,
  });

  // Get custom roles
  const { data: customRoles = [] } = useQuery({
    queryKey: ['team-custom-roles', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      return await base44.entities.TeamRole.filter({ team_id: teamId, is_active: true });
    },
    enabled: !!teamId,
    initialData: [],
  });

  // Default roles that are always available
  const defaultRoles = [
    { id: "Member", name: "Member" },
    { id: "Manager", name: "Manager" },
    { id: "Admin", name: "Admin" }
  ];

  const allRoles = [...defaultRoles, ...customRoles];

  const updateTeamMutation = useMutation({
    mutationFn: async () => {
      return base44.entities.Team.update(teamId, {
        ...teamData,
        settings
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      alert('✅ Team instellingen opgeslagen!');
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async () => {
      // Delete team
      await base44.entities.Team.delete(teamId);

      // Log activity
      await base44.entities.ActivityLog.create({
        user_email: user.email,
        action: `Team verwijderd: ${team.name}`,
        entity_type: "team",
        entity_id: teamId
      });
    },
    onSuccess: () => {
      navigate(createPageUrl("Teams"));
    },
  });

  if (!teamId || !team) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto text-center py-12">
          <p className="text-gray-500">Team niet gevonden</p>
        </div>
      </div>
    );
  }

  const isOwner = team.owner_id === user?.id;

  if (!isOwner) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto text-center py-12">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Geen toegang</h3>
          <p className="text-gray-500 mb-6">Alleen de eigenaar kan team instellingen wijzigen</p>
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

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" asChild>
            <Link to={createPageUrl(`TeamDetail?id=${teamId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Team Instellingen</h1>
            <p className="text-gray-500 mt-1">{team.name}</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle>Algemene Informatie</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label htmlFor="name">Team Naam *</Label>
                <Input
                  id="name"
                  value={teamData.name}
                  onChange={(e) => setTeamData({ ...teamData, name: e.target.value })}
                  placeholder="Mijn Team"
                />
              </div>

              <div>
                <Label htmlFor="description">Beschrijving</Label>
                <Textarea
                  id="description"
                  value={teamData.description}
                  onChange={(e) => setTeamData({ ...teamData, description: e.target.value })}
                  placeholder="Beschrijf het doel van dit team..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="avatar_url">Avatar URL</Label>
                <Input
                  id="avatar_url"
                  type="url"
                  value={teamData.avatar_url}
                  onChange={(e) => setTeamData({ ...teamData, avatar_url: e.target.value })}
                  placeholder="https://voorbeeld.nl/avatar.png"
                />
                <p className="text-xs text-gray-500 mt-1">Upload een afbeelding en plak hier de URL</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle>Team Instellingen</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="allow_member_invites" className="font-semibold">
                    Members mogen uitnodigen
                  </Label>
                  <p className="text-sm text-gray-500">
                    Sta members toe om andere mensen uit te nodigen voor het team
                  </p>
                </div>
                <Switch
                  id="allow_member_invites"
                  checked={settings.allow_member_invites}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, allow_member_invites: checked })
                  }
                />
              </div>

              <div className="pt-4 border-t">
                <Label htmlFor="default_team_role_id" className="font-semibold">
                  Standaard Rol voor Nieuwe Leden
                </Label>
                <p className="text-sm text-gray-500 mb-3">
                  Deze rol wordt automatisch toegewezen aan nieuwe teamleden
                </p>
                <Select
                  value={settings.default_team_role_id || "Member"}
                  onValueChange={(value) =>
                    setSettings({ ...settings, default_team_role_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer een standaard rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {allRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          <span>{role.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              onClick={() => updateTeamMutation.mutate()}
              disabled={!teamData.name || updateTeamMutation.isPending}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Wijzigingen Opslaan
            </Button>
          </div>

          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Gevaarlijke Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Team Verwijderen</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Dit verwijdert het team permanent. Alle teamleden verliezen toegang.
                  Team-owned resources blijven behouden maar worden eigenaar-loos.
                </p>
                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <DialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Team Verwijderen
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Weet je het zeker?</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        Je staat op het punt om <strong>{team.name}</strong> permanent te verwijderen.
                        Deze actie kan niet ongedaan worden gemaakt.
                      </p>
                      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                        <p className="text-sm text-amber-800">
                          <strong>Let op:</strong> Alle teamleden verliezen toegang tot dit team en de bijbehorende resources.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          onClick={() => deleteTeamMutation.mutate()}
                          disabled={deleteTeamMutation.isPending}
                          className="flex-1"
                        >
                          Ja, Verwijder Team
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowDeleteDialog(false)}
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
        </div>
      </div>
    </div>
  );
}
