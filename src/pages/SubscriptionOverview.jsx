import { useState, useEffect } from "react";
import { entities, User } from "@/api/entities";
import { supabase } from '@/utils';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  CreditCard,
  TrendingUp,
  DollarSign,
  Search,
  Filter,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function SubscriptionOverview() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Get all users with their subscription data
  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['all-users-with-subscriptions'],
    queryFn: async () => {
      const users = await entities.User.list();
      const usersWithSubscriptions = await Promise.all(
        users.map(async (user) => {
          try {
            const subscription = await entities.UserSubscription.get(user.id);
            return { ...user, subscription };
          } catch (error) {
            return { ...user, subscription: null };
          }
        })
      );
      return usersWithSubscriptions;
    },
  });

  // Filter users based on search and status
  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = !searchTerm ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "subscribed" && user.subscription) ||
      (statusFilter === "unsubscribed" && !user.subscription) ||
      (user.subscription && user.subscription.status === statusFilter);

    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const totalUsers = allUsers.length;
  const subscribedUsers = allUsers.filter(u => u.subscription).length;
  const activeSubscriptions = allUsers.filter(u => u.subscription?.status === 'active').length;
  const pastDueSubscriptions = allUsers.filter(u => u.subscription?.status === 'past_due').length;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Actief</Badge>;
      case 'past_due':
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" />Achterstallig</Badge>;
      case 'canceled':
        return <Badge className="bg-gray-100 text-gray-800"><XCircle className="w-3 h-3 mr-1" />Geannuleerd</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Proefperiode</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (usersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Abonnementen Overzicht</h1>
          <p className="text-sm text-gray-600">Overzicht van alle gebruikers en hun abonnementen</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-none shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Totaal Gebruikers</p>
                <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center">
              <CreditCard className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Met Abonnement</p>
                <p className="text-2xl font-bold text-gray-900">{subscribedUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Actieve Abonnementen</p>
                <p className="text-2xl font-bold text-gray-900">{activeSubscriptions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Achterstallig</p>
                <p className="text-2xl font-bold text-gray-900">{pastDueSubscriptions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Zoek op naam of email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter op status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle gebruikers</SelectItem>
                <SelectItem value="subscribed">Met abonnement</SelectItem>
                <SelectItem value="unsubscribed">Zonder abonnement</SelectItem>
                <SelectItem value="active">Actief</SelectItem>
                <SelectItem value="past_due">Achterstallig</SelectItem>
                <SelectItem value="canceled">Geannuleerd</SelectItem>
                <SelectItem value="trialing">Proefperiode</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle>Gebruikers ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Gebruiker</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Abonnement</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Einddatum</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Aangemaakt</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{user.name || 'Geen naam'}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {user.subscription ? (
                        <div>
                          <p className="font-medium">{user.subscription.plan_name || 'Onbekend plan'}</p>
                          <p className="text-sm text-gray-600">ID: {user.subscription.subscription_id?.slice(-8)}</p>
                        </div>
                      ) : (
                        <span className="text-gray-500">Geen abonnement</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {user.subscription ? getStatusBadge(user.subscription.status) : <Badge variant="outline">Geen</Badge>}
                    </td>
                    <td className="py-3 px-4">
                      {user.subscription?.period_end_date ? (
                        <span className="text-sm">
                          {format(new Date(user.subscription.period_end_date), 'dd MMM yyyy', { locale: nl })}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">
                        {format(new Date(user.created_at), 'dd MMM yyyy', { locale: nl })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Geen gebruikers gevonden die voldoen aan de filtercriteria.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}