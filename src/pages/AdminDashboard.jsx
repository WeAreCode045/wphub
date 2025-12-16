import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Package,
  Globe,
  Receipt,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Crown,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Loader2,
  ArrowRight,
  HardDrive,
  Cloud
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useUser } from "../Layout";

export default function AdminDashboard() {
  const user = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate(createPageUrl("Dashboard"));
    }
  }, [user, navigate]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      if (!user || user.role !== 'admin') return null;

      const [users, plugins, sites, subscriptions, activities] = await Promise.all([
        base44.entities.User.list("-created_date", 100),
        base44.entities.Plugin.list("-updated_date", 100),
        base44.entities.Site.list("-updated_date", 100),
        base44.entities.UserSubscription.list("-created_date", 100),
        base44.entities.ActivityLog.list("-created_date", 50)
      ]);

      const activeSubscriptions = subscriptions.filter(s => s.status === "active" || s.status === "trialing");
      const mrr = activeSubscriptions.reduce((sum, s) => sum + (s.amount || 0), 0) / 100;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const newUsersThisMonth = users.filter(u => new Date(u.created_date) > thirtyDaysAgo).length;
      const newSubscriptionsThisMonth = subscriptions.filter(s => new Date(s.created_date) > thirtyDaysAgo).length;

      return {
        users: {
          total: users.length,
          active: users.filter(u => !u.is_blocked).length,
          blocked: users.filter(u => u.is_blocked).length,
          admins: users.filter(u => u.role === "admin").length,
          newThisMonth: newUsersThisMonth,
          recentUsers: users.slice(0, 5)
        },
        plugins: {
          total: plugins.length,
          local: plugins.filter(p => p.source === "upload").length,
          remote: plugins.filter(p => p.source === "wplibrary").length,
          recentPlugins: plugins.slice(0, 5)
        },
        sites: {
          total: sites.length,
          active: sites.filter(s => s.connection_status === "active").length,
          inactive: sites.filter(s => s.connection_status === "inactive").length,
          recentSites: sites.slice(0, 5)
        },
        subscriptions: {
          total: subscriptions.length,
          active: activeSubscriptions.length,
          trialing: subscriptions.filter(s => s.status === "trialing").length,
          canceled: subscriptions.filter(s => s.status === "canceled").length,
          mrr: mrr,
          newThisMonth: newSubscriptionsThisMonth,
          recentSubscriptions: subscriptions.slice(0, 5)
        },
        activities: {
          total: activities.length,
          recent: activities.slice(0, 10)
        }
      };
    },
    enabled: !!user && user.role === "admin",
    staleTime: 0,
    refetchOnMount: true,
  });

  if (!user || user.role !== "admin") {
    return null;
  }

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Admin Dashboard 👨‍💼
          </h1>
          <p className="text-gray-600">Platform overzicht en statistieken</p>
        </div>

        {/* Main Stats */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="border-none shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-indigo-600" />
                </div>
                <Badge className="bg-green-100 text-green-700">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +{stats.users.newThisMonth}
                </Badge>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">Totaal Gebruikers</h3>
              <p className="text-3xl font-bold text-gray-900">{stats.users.total}</p>
              <p className="text-xs text-gray-500 mt-2">
                {stats.users.active} actief • {stats.users.blocked} geblokkeerd
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex gap-1">
                  <Badge variant="outline" className="text-xs">
                    <HardDrive className="w-3 h-3 mr-1" />
                    {stats.plugins.local}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Cloud className="w-3 h-3 mr-1" />
                    {stats.plugins.remote}
                  </Badge>
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">Totaal Plugins</h3>
              <p className="text-3xl font-bold text-gray-900">{stats.plugins.total}</p>
              <p className="text-xs text-gray-500 mt-2">
                {stats.plugins.local} lokaal • {stats.plugins.remote} remote
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center">
                  <Globe className="w-6 h-6 text-emerald-600" />
                </div>
                <Badge className={stats.sites.active > stats.sites.inactive ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                  {stats.sites.active} actief
                </Badge>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">Totaal Sites</h3>
              <p className="text-3xl font-bold text-gray-900">{stats.sites.total}</p>
              <p className="text-xs text-gray-500 mt-2">
                {stats.sites.active} actief • {stats.sites.inactive} inactief
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-amber-600" />
                </div>
                <Badge className="bg-green-100 text-green-700">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +{stats.subscriptions.newThisMonth}
                </Badge>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">MRR</h3>
              <p className="text-3xl font-bold text-gray-900">€{stats.subscriptions.mrr.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-2">
                {stats.subscriptions.active} actieve abonnementen
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-6">
          <Card className="border-none shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Actieve Abonnementen</p>
                  <p className="text-2xl font-bold text-green-600">{stats.subscriptions.active}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Proefperiodes</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.subscriptions.trialing}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Geannuleerd</p>
                  <p className="text-2xl font-bold text-red-600">{stats.subscriptions.canceled}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Totaal Abonnementen</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.subscriptions.total}</p>
                </div>
                <Receipt className="w-8 h-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity & Quick Links */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <Card className="border-none shadow-md">
            <CardHeader className="border-b border-gray-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Recente Activiteiten</CardTitle>
                <Button asChild size="sm" variant="ghost">
                  <Link to={createPageUrl("PlatformActivities")}>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {stats.activities.recent.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nog geen activiteiten</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.activities.recent.map((activity) => (
                    <div key={activity.id} className="p-3 hover:bg-gray-50 rounded-lg transition-colors">
                      <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-600">{activity.user_email}</p>
                        <span className="text-xs text-gray-400">•</span>
                        <p className="text-xs text-gray-400">
                          {format(new Date(activity.created_date), "d MMM HH:mm", { locale: nl })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Users */}
          <Card className="border-none shadow-md">
            <CardHeader className="border-b border-gray-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Nieuwe Gebruikers</CardTitle>
                <Button asChild size="sm" variant="ghost">
                  <Link to={createPageUrl("UserManager")}>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {stats.users.recentUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nog geen gebruikers</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.users.recentUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                        {u.full_name?.charAt(0) || "U"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{u.full_name || "Unnamed"}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.role === "admin" && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs">
                            <Crown className="w-3 h-3" />
                          </Badge>
                        )}
                        <Button asChild size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100">
                          <Link to={createPageUrl(`UserDetail?id=${u.id}`)}>
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}