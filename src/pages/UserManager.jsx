
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  Search,
  UserCheck,
  UserX,
  Crown,
  Shield,
  MoreVertical,
  Eye,
  Ban,
  CheckCircle,
  Grid3x3,
  List,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Loader2,
  AlertTriangle
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useUser } from "../Layout";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/api/supabaseClient";

const USERS_PER_PAGE = 20;

export default function UserManager() {
  const user = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate(createPageUrl("Dashboard"));
    }
  }, [user, navigate]);

  // Fetch users with pagination
  const { data: usersData = { users: [], total: 0 }, isLoading } = useQuery({
    queryKey: ['admin-users', currentPage, searchQuery, statusFilter, roleFilter],
    queryFn: async () => {
      if (!user || user.role !== 'admin') return { users: [], total: 0 };

      // Call the getAllUsersAdmin edge function
      const { data, error } = await supabase.functions.invoke('getAllUsersAdmin', {
        body: {
          page: currentPage,
          limit: USERS_PER_PAGE,
          search: searchQuery || null,
          status: statusFilter !== "all" ? statusFilter : null,
          role: roleFilter !== "all" ? roleFilter : null,
        }
      });

      if (error) throw new Error(error.message);

      return data || { users: [], total: 0 };
    },
    enabled: !!user && user.role === "admin",
    staleTime: 0,
    initialData: { users: [], total: 0 },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      const { data: result, error } = await supabase.functions.invoke('updateUserAdmin', {
        body: { user_id: userId, updates: data }
      });
      if (error) throw new Error(error.message || 'Failed to update user');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      const { data, error } = await supabase.functions.invoke('deleteUserAdmin', {
        body: { user_id: userId }
      });
      if (error) throw new Error(error.message || 'Failed to delete user');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeletingUserId(null);
      toast({
        title: "Gebruiker verwijderd",
        description: "De gebruiker en alle gerelateerde data zijn succesvol verwijderd.",
      });
    },
    onError: (error) => {
      setDeletingUserId(null);
      toast({
        variant: "destructive",
        title: "Fout bij verwijderen",
        description: error.message,
      });
    }
  });

  const handleDeleteUser = (targetUser) => {
    if (user && targetUser.id === user.id) {
      toast({
        variant: "destructive",
        title: "Kan niet verwijderen",
        description: "Je kunt je eigen account niet verwijderen.",
      });
      return;
    }

    if (confirm(`Weet je zeker dat je gebruiker "${targetUser.full_name}" wilt verwijderen?\n\nDit verwijdert ook:\n- Alle plugins van deze gebruiker\n- Alle sites van deze gebruiker\n- Alle teams waar deze gebruiker eigenaar van is\n- Alle projecten in teams van deze gebruiker\n- Alle abonnementen, berichten en notificaties\n\nDeze actie kan niet ongedaan worden gemaakt!`)) {
      deleteUserMutation.mutate(targetUser.id);
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = Math.ceil(usersData.total / USERS_PER_PAGE) || 1;

  const UserCard = ({ user: targetUser }) => (
    <Card className="border-none shadow-md hover:shadow-lg transition-all">
      <CardHeader className="bg-gradient-to-br from-indigo-50 to-purple-50 border-b border-gray-100 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="w-12 h-12 border-2 border-gray-200">
              <AvatarImage src={targetUser.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm">
                {getInitials(targetUser.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate text-gray-900">{targetUser.full_name || "Unnamed User"}</CardTitle>
              <p className="text-xs text-gray-600 truncate">{targetUser.email}</p>
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
                <Link to={createPageUrl(`UserDetail?id=${targetUser.id}`)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Bekijk Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const newStatus = !targetUser.is_blocked;
                  if (confirm(`Weet je zeker dat je deze gebruiker wilt ${newStatus ? 'blokkeren' : 'deblokkeren'}?`)) {
                    updateUserMutation.mutate({
                      userId: targetUser.id,
                      data: { is_blocked: newStatus }
                    });
                  }
                }}
                className={targetUser.is_blocked ? "text-green-600" : "text-red-600"}
              >
                {targetUser.is_blocked ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Deblokkeren
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4 mr-2" />
                    Blokkeren
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDeleteUser(targetUser)}
                disabled={deletingUserId === targetUser.id}
                className="text-red-600"
              >
                {deletingUserId === targetUser.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verwijderen...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Verwijderen
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={targetUser.role === "admin" ? "bg-purple-100 text-purple-700 text-xs" : "bg-blue-100 text-blue-700 text-xs"}>
            {targetUser.role === "admin" ? (
              <>
                <Crown className="w-3 h-3 mr-1" />
                Admin
              </>
            ) : (
              <>
                <Shield className="w-3 h-3 mr-1" />
                User
              </>
            )}
          </Badge>
          <Badge className={targetUser.is_blocked ? "bg-red-100 text-red-700 text-xs" : "bg-green-100 text-green-700 text-xs"}>
            {targetUser.is_blocked ? (
              <>
                <UserX className="w-3 h-3 mr-1" />
                Geblokkeerd
              </>
            ) : (
              <>
                <UserCheck className="w-3 h-3 mr-1" />
                Actief
              </>
            )}
          </Badge>
        </div>

        {targetUser.company && (
          <div className="text-xs text-gray-600">
            <span className="font-medium">Bedrijf:</span> {targetUser.company}
          </div>
        )}

        <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
          Aangemaakt: {format(new Date(targetUser.created_date), "d MMM yyyy", { locale: nl })}
        </div>

        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <Button asChild size="sm" className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0">
            <Link to={createPageUrl(`UserDetail?id=${targetUser.id}`)}>
              <Eye className="w-4 h-4 mr-2" />
              Details
            </Link>
          </Button>
          <Button
            onClick={() => handleDeleteUser(targetUser)}
            disabled={deletingUserId === targetUser.id}
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {deletingUserId === targetUser.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const UserListItem = ({ user: targetUser }) => (
    <Card className="border-none shadow-md hover:shadow-lg transition-all">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-12 h-12 border-2 border-gray-200 flex-shrink-0">
            <AvatarImage src={targetUser.avatar_url} />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm">
              {getInitials(targetUser.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{targetUser.full_name || "Unnamed User"}</h3>
              <Badge className={targetUser.role === "admin" ? "bg-purple-100 text-purple-700 text-xs" : "bg-blue-100 text-blue-700 text-xs"}>
                {targetUser.role === "admin" ? (
                  <>
                    <Crown className="w-3 h-3 mr-1" />
                    Admin
                  </>
                ) : (
                  <>
                    <Shield className="w-3 h-3 mr-1" />
                    User
                  </>
                )}
              </Badge>
              <Badge className={targetUser.is_blocked ? "bg-red-100 text-red-700 text-xs" : "bg-green-100 text-green-700 text-xs"}>
                {targetUser.is_blocked ? (
                  <>
                    <UserX className="w-3 h-3 mr-1" />
                    Geblokkeerd
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3 h-3 mr-1" />
                    Actief
                  </>
                )}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 truncate">{targetUser.email}</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button asChild size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0">
              <Link to={createPageUrl(`UserDetail?id=${targetUser.id}`)}>
                <Eye className="w-4 h-4 mr-2" />
                Details
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
                    const newStatus = !targetUser.is_blocked;
                    if (confirm(`Weet je zeker dat je deze gebruiker wilt ${newStatus ? 'blokkeren' : 'deblokkeren'}?`)) {
                      updateUserMutation.mutate({
                        userId: targetUser.id,
                        data: { is_blocked: newStatus }
                      });
                    }
                  }}
                  className={targetUser.is_blocked ? "text-green-600" : "text-red-600"}
                >
                  {targetUser.is_blocked ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Deblokkeren
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4 mr-2" />
                      Blokkeren
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDeleteUser(targetUser)}
                  disabled={deletingUserId === targetUser.id}
                  className="text-red-600"
                >
                  {deletingUserId === targetUser.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verwijderen...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Verwijderen
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Gebruikersbeheer</h1>
          <p className="text-sm text-gray-600">Beheer alle platform gebruikers</p>
        </div>

        <Card className="border-none shadow-md mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Zoek gebruikers..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[150px] h-9 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="active">Actief</SelectItem>
                  <SelectItem value="blocked">Geblokkeerd</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={(value) => {
                setRoleFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[130px] h-9 text-sm">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Rollen</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
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
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : usersData.users.length === 0 ? (
          <Card className="border-none shadow-md">
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Geen gebruikers gevonden
              </h3>
              <p className="text-sm text-gray-600">
                Pas je filters aan of probeer een andere zoekopdracht
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className={viewMode === "grid" ? "grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6" : "space-y-3 mb-6"}>
              {usersData.users.map((targetUser) => (
                viewMode === "grid" ? (
                  <UserCard key={targetUser.id} user={targetUser} />
                ) : (
                  <UserListItem key={targetUser.id} user={targetUser} />
                )
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Pagina {currentPage} van {totalPages} (Toon {usersData.users.length} gebruikers)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Vorige
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!usersData.hasMore || usersData.users.length < USERS_PER_PAGE}
                >
                  Volgende
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
