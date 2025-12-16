import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Briefcase, ArrowRight, Crown, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { checkSubscriptionLimit } from "../subscription/LimitChecker";
import { useState, useEffect } from "react";

export default function TeamProjectOverview({ userId }) {
  const [teamsLimitInfo, setTeamsLimitInfo] = useState(null);
  const [projectsLimitInfo, setProjectsLimitInfo] = useState(null);

  useEffect(() => {
    if (!userId) return;
    
    checkSubscriptionLimit(userId, 'teams').then(setTeamsLimitInfo);
    checkSubscriptionLimit(userId, 'projects').then(setProjectsLimitInfo);
  }, [userId]);

  const { data: userTeams = [] } = useQuery({
    queryKey: ['dashboard-teams', userId],
    queryFn: async () => {
      if (!userId) return [];
      const allTeams = await base44.entities.Team.list("-created_date");
      return allTeams.filter(team => 
        team.owner_id === userId || 
        team.members?.some(m => m.user_id === userId && m.status === "active")
      ).slice(0, 5);
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: true,
    initialData: [],
  });

  const { data: userProjects = [] } = useQuery({
    queryKey: ['dashboard-projects', userId],
    queryFn: async () => {
      if (!userId || userTeams.length === 0) return [];
      const teamIds = userTeams.map(t => t.id);
      const allProjects = await base44.entities.Project.list("-created_date");
      return allProjects.filter(p => teamIds.includes(p.team_id)).slice(0, 5);
    },
    enabled: !!userId && userTeams.length > 0,
    staleTime: 0,
    refetchOnMount: true,
    initialData: [],
  });

  const getInitials = (name) => {
    if (!name) return "T";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
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

  const UpgradePrompt = ({ featureType }) => (
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Lock className="w-8 h-8 text-indigo-600" />
      </div>
      <h4 className="font-semibold text-gray-900 mb-2">
        {featureType === 'teams' ? 'Teams' : 'Projecten'} niet beschikbaar
      </h4>
      <p className="text-sm text-gray-600 mb-4">
        Deze functie is niet inbegrepen in je huidige plan
      </p>
      <Button asChild size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
        <Link to={createPageUrl("Pricing")}>
          Upgrade je Plan
          <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </Button>
    </div>
  );

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="border-b border-gray-100 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Teams & Projecten</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              <Users className="w-3 h-3 mr-1" />
              {userTeams.length} teams
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Briefcase className="w-3 h-3 mr-1" />
              {userProjects.length} projecten
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs defaultValue="teams" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="teams">
              <Users className="w-4 h-4 mr-2" />
              Teams ({userTeams.length})
            </TabsTrigger>
            <TabsTrigger value="projects">
              <Briefcase className="w-4 h-4 mr-2" />
              Projecten ({userProjects.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="teams" className="space-y-3 mt-0">
            {!teamsLimitInfo?.enabled ? (
              <UpgradePrompt featureType="teams" />
            ) : userTeams.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nog geen teams</p>
                <Button asChild size="sm" className="mt-4" variant="outline">
                  <Link to={createPageUrl("Teams")}>
                    Team Aanmaken
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                {userTeams.map((team) => {
                  const isOwner = team.owner_id === userId;
                  const memberCount = team.members?.length || 0;
                  
                  return (
                    <div key={team.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group">
                      <Avatar className="w-10 h-10 border-2 border-gray-200">
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm">
                          {getInitials(team.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{team.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {isOwner && (
                            <>
                              <Badge className="bg-amber-100 text-amber-700 text-xs">
                                <Crown className="w-3 h-3 mr-1" />
                                Eigenaar
                              </Badge>
                              <span>•</span>
                            </>
                          )}
                          <span>{memberCount} {memberCount === 1 ? 'lid' : 'leden'}</span>
                        </div>
                      </div>
                      <Button asChild size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link to={createPageUrl(`TeamDetail?id=${team.id}`)}>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  );
                })}
                <Button asChild variant="outline" size="sm" className="w-full mt-4">
                  <Link to={createPageUrl("Teams")}>
                    Bekijk Alle Teams
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="projects" className="space-y-3 mt-0">
            {!projectsLimitInfo?.enabled ? (
              <UpgradePrompt featureType="projects" />
            ) : userProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nog geen projecten</p>
                {teamsLimitInfo?.enabled && (
                  <Button asChild size="sm" className="mt-4" variant="outline">
                    <Link to={createPageUrl("Projects")}>
                      Project Aanmaken
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                {userProjects.map((project) => (
                  <div key={project.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{project.title}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Badge className={`${getStatusColor(project.status)} text-xs`}>
                          {project.status}
                        </Badge>
                        {project.plugins?.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{project.plugins.length} plugins</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)}>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
                <Button asChild variant="outline" size="sm" className="w-full mt-4">
                  <Link to={createPageUrl("Projects")}>
                    Bekijk Alle Projecten
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}