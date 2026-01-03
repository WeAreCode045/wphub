
import { useState, useEffect } from "react";
import { entities } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  Calendar,
  Shield,
  User,
  Package,
  Globe,
  Send,
  CheckCircle,
  XCircle,
  Bell,
  Crown,
  Edit,
  Ban,
  CreditCard,
  Percent,
  
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "../Layout";
import { supabase } from "@/utils";

import SendMessageDialog from "../components/messaging/SendMessageDialog";
import SendNotificationDialog from "../components/messaging/SendNotificationDialog";

export default function UserDetail() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentUser = useUser();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", company: "", phone: "", role: "" });
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [discountForm, setDiscountForm] = useState({
    discount_percent: 10,
    duration_type: 'once',
    duration_months: 3,
  });

  // Redirect if no userId - with delay to ensure searchParams are loaded
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!userId) {
        console.log('No userId found, redirecting to UserManager');
        navigate(createPageUrl("UserManager"));
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [userId, navigate]);

  const { data: targetUser, isLoading: userLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      if (!userId) return null;
      const users = await entities.User.list();
      const foundUser = users.find(u => u.id === userId) || null;
      if (foundUser) {
        setEditForm({
          full_name: foundUser.full_name || "",
          email: foundUser.email || "",
          company: foundUser.company || "",
          phone: foundUser.phone || "",
          role: foundUser.role || "user"
        });
      }
      return foundUser;
    },
    enabled: !!userId,
    staleTime: 0, // Cache for 30 seconds
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', userId],
    queryFn: async () => {
      if (!userId || !targetUser) return [];
      const allSites = await entities.Site.list();
      return allSites.filter(site => site.created_by === targetUser.email);
    },
    enabled: !!userId && !!targetUser,
    initialData: [],
  });

  const { data: plugins = [] } = useQuery({
    queryKey: ['plugins', userId],
    queryFn: async () => {
      if (!userId || !targetUser) return [];
      const allPlugins = await entities.Plugin.list();
      return allPlugins.filter(plugin => plugin.created_by === targetUser.email);
    },
    enabled: !!userId && !!targetUser,
    initialData: [],
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      return entities.Notification.filter({ recipient_id: userId }, "-created_date", 10);
    },
    enabled: !!userId,
    initialData: [],
  });

  const { data: userSubscription } = useQuery({
    queryKey: ['user-subscription', userId],
    queryFn: async () => {
      if (!userId) return null;
      return entities.UserSubscription.get(userId);
    },
    enabled: !!userId,
  });

  const { data: availablePlans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => entities.SubscriptionPlan.list(),
    enabled: isAdmin,
    initialData: [],
  });

  

  const updateUserMutation = useMutation({
    mutationFn: async (updatedData) => {
      if (!userId) throw new Error("User ID is missing.");
      const { data, error } = await supabase.functions.invoke('updateUserAdmin', {
        body: { user_id: userId, updates: updatedData }
      });
      if (error) throw new Error(error.message || 'Failed to update user');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      setShowEditDialog(false);
      toast({
        title: "Gebruiker bijgewerkt",
        description: "De gebruiker is succesvol bijgewerkt.",
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

  const blockUserMutation = useMutation({
    mutationFn: async (status) => {
      if (!userId) throw new Error("User ID is missing.");
      await entities.User.update(userId, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      alert('✅ Gebruiker status succesvol bijgewerkt!');
    },
    onError: (error) => {
      alert('❌ Fout bij bijwerken status: ' + error.message);
    }
  });

  const assignSubscriptionMutation = useMutation({
    mutationFn: async ({ user_id, plan_id }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(
        'https://ossyxxlplvqakowiwbok.supabase.co/functions/v1/admin-assign-subscription',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ user_id, plan_id }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to assign subscription');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscription', userId] });
      setShowSubscriptionDialog(false);
      setSelectedPlanId("");
      toast({
        title: "Abonnement toegewezen",
        description: "Het abonnement is succesvol toegewezen aan de gebruiker.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij toewijzen",
        description: error.message,
      });
    }
  });

  const applyDiscountMutation = useMutation({
    mutationFn: async ({ user_id, discount_percent, duration_type, duration_months }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(
        'https://ossyxxlplvqakowiwbok.supabase.co/functions/v1/admin-apply-subscription-discount',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ user_id, discount_percent, duration_type, duration_months }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to apply discount');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscription', userId] });
      setShowDiscountDialog(false);
      toast({
        title: "Korting toegepast",
        description: "De korting is succesvol toegepast op het abonnement.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij toepassen korting",
        description: error.message,
      });
    }
  });

  

  const handleEditSubmit = () => {
    updateUserMutation.mutate(editForm);
  };

  const handleBlockUser = () => {
    if (!targetUser) return;
    const newStatus = targetUser.status === "active" ? "inactive" : "active";
    if (window.confirm(`Weet je zeker dat je deze gebruiker wilt ${newStatus === "inactive" ? "blokkeren" : "deblokkeren"}?`)) {
      blockUserMutation.mutate(newStatus);
    }
  };

  const handleAssignSubscription = () => {
    if (!selectedPlanId || !userId) return;
    assignSubscriptionMutation.mutate({ 
      user_id: userId, 
      plan_id: parseInt(selectedPlanId) 
    });
  };

  const handleApplyDiscount = () => {
    if (!userId) return;
    applyDiscountMutation.mutate({ 
      user_id: userId,
      discount_percent: discountForm.discount_percent,
      duration_type: discountForm.duration_type,
      duration_months: discountForm.duration_type === 'repeating' ? discountForm.duration_months : undefined,
    });
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (userLoading || !currentUser) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto text-center py-12">
          <p className="text-gray-500">Gebruiker wordt geladen...</p>
        </div>
      </div>
    );
  }

  if (!targetUser) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto text-center py-12">
          <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Gebruiker niet gevonden</h3>
          <p className="text-gray-500 mb-6">Deze gebruiker bestaat niet of is verwijderd</p>
          <Button asChild>
            <Link to={createPageUrl("UserManager")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Terug naar Gebruikers
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const isActive = targetUser.status === "active" || !targetUser.status;
  const canEdit = currentUser?.role === "admin";
  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" asChild>
            <Link to={createPageUrl("UserManager")}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <Avatar className="w-16 h-16 border-2 border-indigo-100">
            <AvatarImage src={targetUser.avatar_url} />
            <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold text-lg">
              {getInitials(targetUser.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              {targetUser.full_name}
              {targetUser.role === "admin" && (
                <Crown className="w-6 h-6 text-amber-500" fill="currentColor" />
              )}
            </h1>
            <p className="text-gray-500 mt-1">{targetUser.email}</p>
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowMessageDialog(true)}>
            <Mail className="w-4 h-4 mr-2" />
            Bericht
          </Button>

          <Button variant="outline" size="sm" onClick={() => setShowNotificationDialog(true)}>
            <Bell className="w-4 h-4 mr-2" />
            Notificatie
          </Button>

          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Bewerken
              </Button>
              {targetUser.id !== currentUser?.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBlockUser}
                  className={targetUser.status === "active" ? "text-red-600 hover:text-red-700 border-red-200" : "text-green-600 hover:text-green-700 border-green-200"}
                  disabled={blockUserMutation.isPending}
                >
                  <Ban className="w-4 h-4 mr-2" />
                  {blockUserMutation.isPending
                    ? "Bezig..."
                    : targetUser.status === "active" ? "Blokkeer" : "Deblokkeer"}
                </Button>
              )}
            </>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Verbonden Sites</p>
                  <p className="text-3xl font-bold">{sites.length}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center">
                  <Globe className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Plugins</p>
                  <p className="text-3xl font-bold">{plugins.length}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notificaties</p>
                  <p className="text-3xl font-bold">{notifications.length}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center">
                  <Bell className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card className="border-none shadow-lg">
            <Tabs defaultValue="account" className="w-full">
              <CardHeader className="border-b border-gray-100">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="account" className="gap-2">
                    <User className="w-4 h-4" />
                    Account Info
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="gap-2">
                    <Bell className="w-4 h-4" />
                    Notificaties
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <TabsContent value="account" className="m-0">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <Avatar className="w-20 h-20 border-4 border-purple-100">
                      <AvatarImage src={targetUser.avatar_url} />
                      <AvatarFallback className="bg-purple-100 text-purple-700 text-2xl font-semibold">
                        {getInitials(targetUser.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{targetUser.full_name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          className={`${
                            targetUser.role === "admin"
                              ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                              : "bg-gray-100 text-gray-700 border-gray-200"
                          }`}
                        >
                          {targetUser.role === "admin" ? (
                            <>
                              <Shield className="w-3 h-3 mr-1" />
                              Admin
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3 mr-1" />
                              Gebruiker
                            </>
                          )}
                        </Badge>
                        {isActive ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Actief
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-100 text-gray-600">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactief
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">E-mailadres</p>
                        <p className="text-sm font-medium text-gray-900">{targetUser.email}</p>
                      </div>
                    </div>

                    {targetUser.company && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Building className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Bedrijf</p>
                          <p className="text-sm font-medium text-gray-900">{targetUser.company}</p>
                        </div>
                      </div>
                    )}

                    {targetUser.phone && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Telefoonnummer</p>
                          <p className="text-sm font-medium text-gray-900">{targetUser.phone}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Lid sinds</p>
                        <p className="text-sm font-medium text-gray-900">
                          {targetUser.created_date ? format(new Date(targetUser.created_date), "d MMMM yyyy", { locale: nl }) : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </TabsContent>

              <TabsContent value="notifications" className="m-0">
                <CardContent className="p-6">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Nog geen notificaties</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notifications.slice(0, 5).map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-3 rounded-lg border transition-all ${
                            notif.is_read
                              ? "border-gray-100 bg-white"
                              : "border-amber-200 bg-amber-50"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <p className="font-medium text-gray-900 text-sm">{notif.title}</p>
                            {!notif.is_read && (
                              <Badge variant="secondary" className="text-xs">Nieuw</Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mb-2">{notif.message}</p>
                          <p className="text-xs text-gray-400">
                            {notif.created_date ? format(new Date(notif.created_date), "d MMM yyyy HH:mm", { locale: nl }) : '-'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="border-none shadow-lg">
            <Tabs defaultValue="sites" className="w-full">
              <CardHeader className="border-b border-gray-100">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="sites" className="gap-2">
                    <Globe className="w-4 h-4" />
                    Sites ({sites.length})
                  </TabsTrigger>
                  <TabsTrigger value="plugins" className="gap-2">
                    <Package className="w-4 h-4" />
                    Plugins ({plugins.length})
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <TabsContent value="sites" className="m-0">
                <CardContent className="p-6">
                  {sites.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Nog geen sites</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sites.map((site) => (
                        <Link
                          key={site.id}
                          to={createPageUrl(`SiteDetail?id=${site.id}`)}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-all border border-gray-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-lg flex items-center justify-center">
                              <Globe className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{site.name}</p>
                              <p className="text-xs text-gray-500">{site.url}</p>
                            </div>
                          </div>
                          <Badge
                            className={
                              site.status === "active"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : "bg-gray-100 text-gray-700 border-gray-200"
                            }
                          >
                            {site.status || "inactive"}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </TabsContent>

              <TabsContent value="plugins" className="m-0">
                <CardContent className="p-6">
                  {plugins.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Nog geen plugins</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {plugins.map((plugin) => (
                        <Link
                          key={plugin.id}
                          to={createPageUrl(`PluginDetail?id=${plugin.id}`)}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-all border border-gray-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex items-center justify-center">
                              <Package className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{plugin.name}</p>
                              <p className="text-xs text-gray-500">
                                {plugin.latest_version ? `v${plugin.latest_version}` : "Geen versie"}
                              </p>
                            </div>
                          </div>
                          <Badge className={plugin.is_public ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                            {plugin.is_public ? "Public" : "Privé"}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Subscription Management Section */}
        {isAdmin && (
          <Card className="border-none shadow-lg mb-8">
            <CardHeader className="border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  <CardTitle>Abonnement Beheer</CardTitle>
                </div>
                <div className="flex gap-2">
                  {userSubscription && (
                    <Button
                      onClick={() => setShowDiscountDialog(true)}
                      size="sm"
                      variant="outline"
                      className="border-green-200 text-green-700 hover:bg-green-50"
                    >
                      <Percent className="w-4 h-4 mr-2" />
                      Korting Toepassen
                    </Button>
                  )}
                  <Button
                    onClick={() => setShowSubscriptionDialog(true)}
                    size="sm"
                    variant="outline"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Abonnement Toewijzen
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {userSubscription ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Huidig Plan</p>
                      <p className="text-xl font-bold text-gray-900">{userSubscription.plan_name}</p>
                    </div>
                    <Badge
                      className={
                        userSubscription.status === 'active'
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : userSubscription.status === 'trialing'
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-gray-100 text-gray-700 border-gray-200'
                      }
                    >
                      {userSubscription.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {userSubscription.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Startdatum</p>
                      <p className="text-sm font-medium">
                        {userSubscription.period_start_date 
                          ? format(new Date(userSubscription.period_start_date), "d MMM yyyy", { locale: nl })
                          : '-'}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Einddatum</p>
                      <p className="text-sm font-medium">
                        {userSubscription.period_end_date 
                          ? format(new Date(userSubscription.period_end_date), "d MMM yyyy", { locale: nl })
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 mb-4">Geen actief abonnement</p>
                  <Button
                    onClick={() => setShowSubscriptionDialog(true)}
                    size="sm"
                  >
                    Abonnement Toewijzen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gebruiker Bewerken</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-full_name">Volledige Naam</Label>
                <Input
                  id="edit-full_name"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">E-mailadres</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  disabled={true}
                />
              </div>
              <div>
                <Label htmlFor="edit-company">Bedrijf</Label>
                <Input
                  id="edit-company"
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Telefoonnummer</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-role">Rol</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(value) => setEditForm({ ...editForm, role: value })}
                  disabled={targetUser.id === currentUser?.id}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Selecteer rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Gebruiker</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Annuleren
              </Button>
              <Button onClick={handleEditSubmit} disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? "Opslaan..." : "Opslaan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SendMessageDialog
          open={showMessageDialog}
          onOpenChange={setShowMessageDialog}
          toUserId={targetUser?.id}
          toUserName={targetUser?.full_name}
          context={{
            type: "user",
            id: targetUser?.id,
            name: targetUser?.full_name
          }}
        />

        <SendNotificationDialog
          open={showNotificationDialog}
          onOpenChange={setShowNotificationDialog}
          user={currentUser}
          context={{
            type: "user",
            id: targetUser.id,
            name: targetUser.full_name
          }}
          defaultRecipientType="user"
          defaultRecipientId={targetUser.id}
        />

        {/* Subscription Assignment Dialog */}
        <Dialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abonnement Toewijzen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-gray-600">
                Wijs een abonnement toe aan <strong>{targetUser.full_name}</strong>. 
                Dit zal een nieuw Stripe-abonnement aanmaken en eventuele bestaande actieve abonnementen vervangen.
              </p>
              
              {userSubscription && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Let op:</strong> Gebruiker heeft momenteel het "{userSubscription.plan_name}" plan. 
                    Dit zal worden vervangen.
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="plan-select">Selecteer Abonnement</Label>
                <Select
                  value={selectedPlanId}
                  onValueChange={setSelectedPlanId}
                >
                  <SelectTrigger id="plan-select">
                    <SelectValue placeholder="Kies een abonnement..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id.toString()}>
                        {plan.name} - €{(plan.monthly_price_cents / 100).toFixed(2)}/maand
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowSubscriptionDialog(false);
                  setSelectedPlanId("");
                }}
              >
                Annuleren
              </Button>
              <Button 
                onClick={handleAssignSubscription} 
                disabled={!selectedPlanId || assignSubscriptionMutation.isPending}
              >
                {assignSubscriptionMutation.isPending ? "Toewijzen..." : "Abonnement Toewijzen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Discount Dialog */}
        <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Korting Toepassen op Abonnement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-gray-600">
                Pas een korting toe op het huidige abonnement van <strong>{targetUser.full_name}</strong>.
              </p>

              <div>
                <Label htmlFor="discount-percent">Kortingspercentage (%)</Label>
                <Input
                  id="discount-percent"
                  type="number"
                  min="1"
                  max="100"
                  value={discountForm.discount_percent}
                  onChange={(e) => setDiscountForm({ ...discountForm, discount_percent: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Voer een percentage in tussen 1% en 100%
                </p>
              </div>

              <div>
                <Label htmlFor="duration-type">Duur van de Korting</Label>
                <Select
                  value={discountForm.duration_type}
                  onValueChange={(value) => setDiscountForm({ ...discountForm, duration_type: value })}
                >
                  <SelectTrigger id="duration-type">
                    <SelectValue placeholder="Kies duur..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Eenmalig (volgende factuur)</SelectItem>
                    <SelectItem value="repeating">Aantal maanden</SelectItem>
                    <SelectItem value="forever">Voor altijd</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {discountForm.duration_type === 'repeating' && (
                <div>
                  <Label htmlFor="duration-months">Aantal Maanden</Label>
                  <Input
                    id="duration-months"
                    type="number"
                    min="1"
                    max="60"
                    value={discountForm.duration_months}
                    onChange={(e) => setDiscountForm({ ...discountForm, duration_months: parseInt(e.target.value) || 1 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    De korting wordt gedurende dit aantal maanden toegepast
                  </p>
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Voorbeeld:</strong> {discountForm.discount_percent}% korting {' '}
                  {discountForm.duration_type === 'once' && 'op de volgende factuur'}
                  {discountForm.duration_type === 'repeating' && `gedurende ${discountForm.duration_months} maanden`}
                  {discountForm.duration_type === 'forever' && 'voor altijd'}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowDiscountDialog(false)}
              >
                Annuleren
              </Button>
              <Button 
                onClick={handleApplyDiscount} 
                disabled={applyDiscountMutation.isPending || discountForm.discount_percent < 1 || discountForm.discount_percent > 100}
                className="bg-green-600 hover:bg-green-700"
              >
                {applyDiscountMutation.isPending ? "Toepassen..." : "Korting Toepassen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual subscription dialog removed */}
      </div>
    </div>
  );
}
