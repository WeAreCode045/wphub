
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Users,
  Crown,
  Settings,
  Trash2,
  UserPlus,
  Grid3x3,
  List,
  Eye
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { checkSubscriptionLimit } from "../components/subscription/LimitChecker";
import { useToast } from "@/components/ui/use-toast";
import FeatureGate from "../components/subscription/FeatureGate";
import { useUser } from "../Layout";

export default function Teams() {
  const user = useUser();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", description: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const allTeams = await base44.entities.Team.list("-created_date");
      const userTeams = allTeams.filter(team => 
        team.owner_id === user.id || 
        team.members?.some(m => m.user_id === user.id && m.status === "active")
      );
      
      return userTeams;
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: true,
    initialData: [],
  });

  const createTeamMutation = useMutation({
    mutationFn: async (teamData) => {
      if (!user) throw new Error("User not loaded");
      
      const limitCheck = await checkSubscriptionLimit(user.id, 'teams');
      
      if (!limitCheck.allowed) {
        throw new Error(limitCheck.message);
      }

      const newTeam = await base44.entities.Team.create({
        name: teamData.name,
        description: teamData.description,
        owner_id: user.id,
        members: [{
          user_id: user.id,
          email: user.email,
          team_role_id: "Owner",
          status: "active",
          joined_at: new Date().toISOString()
        }]
      });

      await base44.functions.invoke('createDefaultTeamRoles', {
        team_id: newTeam.id
      });

      await base44.entities.ActivityLog.create({
        user_email: user.email,
        action: `Team aangemaakt: ${teamData.name}`,
        entity_type: "team",
        entity_id: newTeam.id
      });

      return newTeam;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowCreateDialog(false);
      setNewTeam({ name: "", description: "" });
      toast({
        title: "Team aangemaakt",
        description: "Het team is succesvol aangemaakt",
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

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId) => {
      if (!user) throw new Error("User not loaded");
      
      const team = teams.find(t => t.id === teamId);
      
      if (team) {
        await base44.entities.ActivityLog.create({
          user_email: user.email,
          action: `Team verwijderd: ${team.name}`,
          entity_type: "team"
        });
      }
      
      return base44.entities.Team.delete(teamId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({
        title: "Team verwijderd",
        description: "Het team is succesvol verwijderd",
      });
    },
  });

  const handleCreateTeam = () => {
    if (newTeam.name) {
      createTeamMutation.mutate(newTeam);
    }
  };

  const filteredTeams = teams.filter(team =>
    team.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name) => {
    if (!name) return "T";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const isOwner = (team) => team.owner_id === user?.id;

  const getMemberCount = (team) => team.members?.length || 0;

  const TeamCard = ({ team }) => (
    <Card className="border-none shadow-md hover:shadow-lg transition-all">
      <CardHeader className="bg-gradient-to-br from-indigo-50 to-purple-50 border-b border-gray-100 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="w-12 h-12 border-2 border-gray-200">
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm">
                {getInitials(team.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate text-gray-900">{team.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {isOwner(team) && (
                  <Badge className="bg-amber-100 text-amber-700 text-xs">
                    <Crown className="w-3 h-3 mr-1" />
                    Eigenaar
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {getMemberCount(team)} leden
                </Badge>
              </div>
            </div>
          </div>
          {isOwner(team) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Eye className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl(`TeamSettings?id=${team.id}`)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Instellingen
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    if (confirm(`Weet je zeker dat je "${team.name}" wilt verwijderen?`)) {
                      deleteTeamMutation.mutate(team.id);
                    }
                  }}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Verwijderen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        {team.description ? (
          <p className="text-sm text-gray-600 line-clamp-2">{team.description}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">Geen beschrijving</p>
        )}

        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <Button 
            asChild 
            size="sm" 
            className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
          >
            <Link to={createPageUrl(`TeamDetail?id=${team.id}`)}>
              Bekijken
            </Link>
          </Button>
          {isOwner(team) && (
            <Button 
              asChild
              variant="outline" 
              size="sm"
              className="hover:bg-indigo-50 hover:text-indigo-700"
            >
              <Link to={createPageUrl(`TeamSettings?id=${team.id}`)}>
                <Settings className="w-4 h-4" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const TeamListItem = ({ team }) => (
    <Card className="border-none shadow-md hover:shadow-lg transition-all">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-12 h-12 border-2 border-gray-200 flex-shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm">
              {getInitials(team.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{team.name}</h3>
              {isOwner(team) && (
                <Badge className="bg-amber-100 text-amber-700 text-xs">
                  <Crown className="w-3 h-3 mr-1" />
                  Eigenaar
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                <Users className="w-3 h-3 mr-1" />
                {getMemberCount(team)} leden
              </Badge>
            </div>
            {team.description && (
              <p className="text-sm text-gray-600 line-clamp-1">{team.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button 
              asChild 
              size="sm" 
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
            >
              <Link to={createPageUrl(`TeamDetail?id=${team.id}`)}>
                Bekijken
              </Link>
            </Button>
            {isOwner(team) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl(`TeamSettings?id=${team.id}`)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Instellingen
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      if (confirm(`Weet je zeker dat je "${team.name}" wilt verwijderen?`)) {
                        deleteTeamMutation.mutate(team.id);
                      }
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Verwijderen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <FeatureGate userId={user?.id} featureType="teams">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Mijn Teams</h1>
          <p className="text-sm text-gray-600">Beheer je teams en samenwerking</p>
        </div>

        <Card className="border-none shadow-md mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Zoek teams..."
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
                onClick={() => setShowCreateDialog(true)}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nieuw Team
              </Button>
            </div>
          </CardContent>
        </Card>

        {filteredTeams.length === 0 ? (
          <Card className="border-none shadow-md">
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                {searchQuery ? "Geen teams gevonden" : "Nog geen teams"}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {searchQuery 
                  ? "Probeer een andere zoekterm" 
                  : "Maak je eerste team aan om samen te werken"}
              </p>
              {!searchQuery && (
                <Button 
                  onClick={() => setShowCreateDialog(true)}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nieuw Team
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === "grid" ? "grid md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
            {filteredTeams.map((team) => (
              viewMode === "grid" ? (
                <TeamCard key={team.id} team={team} />
              ) : (
                <TeamListItem key={team.id} team={team} />
              )
            ))}
          </div>
        )}

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nieuw Team Aanmaken</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="team-name">Team Naam *</Label>
                <Input
                  id="team-name"
                  placeholder="Bijv: Development Team"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="team-description">Beschrijving</Label>
                <Textarea
                  id="team-description"
                  placeholder="Wat doet dit team?"
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  className="mt-2"
                  rows={3}
                />
              </div>
              <DialogFooter className="mt-4">
                <Button
                  onClick={handleCreateTeam}
                  disabled={createTeamMutation.isPending || !newTeam.name}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                >
                  {createTeamMutation.isPending ? "Aanmaken..." : "Team Aanmaken"}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Annuleren
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </FeatureGate>
  );
}
