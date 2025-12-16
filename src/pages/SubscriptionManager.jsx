
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Receipt,
  Search,
  Users,
  Crown,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreVertical,
  Ban,
  Send,
  Plus
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "../Layout";

export default function SubscriptionManager() {
  const user = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate(createPageUrl("Dashboard"));
    }
  }, [user, navigate]);

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['admin-all-subscriptions'],
    queryFn: async () => {
      if (!user || user.role !== 'admin') return [];
      
      const subs = await base44.entities.UserSubscription.list("-created_date");
      return subs;
    },
    enabled: !!user && user.role === "admin",
    staleTime: 0,
    initialData: [],
  });

  const { data: allPlans = [] } = useQuery({
    queryKey: ['admin-subscription-plans'],
    queryFn: async () => {
      if (!user || user.role !== 'admin') return [];
      
      const plans = await base44.entities.SubscriptionPlan.list();
      return plans;
    },
    enabled: !!user && user.role === "admin",
    staleTime: 0,
    initialData: [],
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: async () => {
      if (!user || user.role !== 'admin') return [];
      
      const users = await base44.entities.User.list();
      return users;
    },
    enabled: !!user && user.role === "admin",
    staleTime: 0,
    initialData: [],
  });

  const getUserById = (userId) => allUsers.find(u => u.id === userId);
  const getPlanById = (planId) => allPlans.find(p => p.id === planId);

  const filteredSubscriptions = subscriptions.filter(sub => {
    const subUser = getUserById(sub.user_id);
    const plan = getPlanById(sub.plan_id);
    
    const matchesSearch = subUser?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          subUser?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          plan?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    const matchesPlan = planFilter === "all" || sub.plan_id === planFilter;
    
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === "active").length,
    trialing: subscriptions.filter(s => s.status === "trialing").length,
    canceled: subscriptions.filter(s => s.status === "canceled").length,
    revenue: subscriptions
      .filter(s => s.status === "active" || s.status === "trialing")
      .reduce((sum, s) => sum + (s.amount || 0), 0) / 100
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: "bg-green-100 text-green-700 border-green-200",
      trialing: "bg-blue-100 text-blue-700 border-blue-200",
      past_due: "bg-amber-100 text-amber-700 border-amber-200",
      canceled: "bg-red-100 text-red-700 border-red-200",
      incomplete: "bg-gray-100 text-gray-700 border-gray-200"
    };
    return styles[status] || styles.incomplete;
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case "active": return <CheckCircle className="w-4 h-4" />;
      case "trialing": return <Calendar className="w-4 h-4" />;
      case "past_due": return <AlertCircle className="w-4 h-4" />;
      case "canceled": return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      active: "Actief",
      trialing: "Proefperiode",
      past_due: "Achterstallig",
      canceled: "Geannuleerd",
      incomplete: "Incompleet",
      incomplete_expired: "Verlopen",
      unpaid: "Onbetaald"
    };
    return labels[status] || status;
  };

  const formatPrice = (amount, currency = "EUR") => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currency
    }).format(amount / 100);
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId) => {
      return base44.entities.UserSubscription.update(subscriptionId, {
        status: "canceled",
        canceled_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-subscriptions'] });
      toast({
        title: "Abonnement geannuleerd",
        description: "Het abonnement is succesvol geannuleerd.",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Fout bij annuleren",
        description: `Er is een fout opgetreden: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  if (!user || user.role !== "admin") {
    return null; 
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Abonnementenbeheer</h1>
          <p className="text-sm text-gray-600">Beheer alle actieve abonnementen en betalingen</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Totaal</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Actief</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Proefperiode</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.trialing}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">MRR</p>
                  <p className="text-2xl font-bold text-gray-900">€{stats.revenue.toFixed(2)}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                  <Crown className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-none shadow-md mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Zoek gebruikers of plannen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="active">Actief</SelectItem>
                  <SelectItem value="trialing">Proefperiode</SelectItem>
                  <SelectItem value="past_due">Achterstallig</SelectItem>
                  <SelectItem value="canceled">Geannuleerd</SelectItem>
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-[140px] h-9 text-sm">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Plannen</SelectItem>
                  {allPlans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Subscriptions List */}
        <div className="space-y-3">
          {filteredSubscriptions.map(subscription => {
            const subUser = getUserById(subscription.user_id);
            const plan = getPlanById(subscription.plan_id);
            
            return (
              <Card key={subscription.id} className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-10 h-10 border-2 border-gray-200 flex-shrink-0">
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 text-sm font-semibold">
                        {getInitials(subUser?.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {subUser?.full_name || "Onbekend"}
                        </h3>
                        <Badge className={`${getStatusBadge(subscription.status)} text-xs`}>
                          {getStatusIcon(subscription.status)}
                          <span className="ml-1">{getStatusLabel(subscription.status)}</span>
                        </Badge>
                        {subscription.cancel_at_period_end && (
                          <Badge variant="outline" className="text-xs text-amber-700 border-amber-200">
                            Wordt geannuleerd
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span>{subUser?.email}</span>
                        <span>•</span>
                        <span className="font-medium text-gray-900">{plan?.name || "Onbekend Plan"}</span>
                        <span>•</span>
                        <span>{formatPrice(subscription.amount || 0, subscription.currency)}/{subscription.interval === "year" ? "jaar" : "maand"}</span>
                      </div>
                    </div>

                    {subscription.current_period_end && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-600">Verlengt op</p>
                        <p className="text-xs font-medium text-gray-900">
                          {format(new Date(subscription.current_period_end), "d MMM yyyy", { locale: nl })}
                        </p>
                      </div>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => window.open(`https://dashboard.stripe.com/subscriptions/${subscription.stripe_subscription_id}`, '_blank')}>
                          <Receipt className="w-4 h-4 mr-2" />
                          Bekijk in Stripe
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Send className="w-4 h-4 mr-2" />
                          Mail Gebruiker
                        </DropdownMenuItem>
                        {subscription.status !== "canceled" && (
                          <DropdownMenuItem 
                            className="text-red-600 focus:text-red-600"
                            onClick={() => cancelSubscriptionMutation.mutate(subscription.id)}
                            disabled={cancelSubscriptionMutation.isLoading}
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            Abonnement annuleren
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredSubscriptions.length === 0 && (
          <Card className="border-none shadow-md">
            <CardContent className="p-12 text-center">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900 mb-1">Geen abonnementen gevonden</h3>
              <p className="text-sm text-gray-600">
                {searchQuery || statusFilter !== "all" || planFilter !== "all"
                  ? "Probeer een andere zoekopdracht of pas de filters aan"
                  : "Er zijn nog geen actieve abonnementen"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
