import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Crown,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Package,
  Globe,
  Users,
  Briefcase,
  Calendar,
  CreditCard,
  Download,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Shield,
  ArrowUp,
  ArrowDown,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { checkDowngradeEligibility } from "../components/subscription/LimitChecker";
import { useToast } from "@/components/ui/use-toast";

export default function MySubscription() {
  const [user, setUser] = useState(null);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [changeAction, setChangeAction] = useState(null); // 'upgrade' or 'downgrade'
  const [downgradeViolations, setDowngradeViolations] = useState([]);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['my-subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const allSubs = await base44.entities.UserSubscription.filter({
        user_id: user.id
      });
      const activeSubs = allSubs.filter(s =>
        s.status === 'active' || s.status === 'trialing'
      );
      return activeSubs.length > 0 ? activeSubs[0] : null;
    },
    enabled: !!user,
  });

  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ['subscription-plan', subscription?.plan_id],
    queryFn: async () => {
      if (!subscription?.plan_id) return null;
      const plans = await base44.entities.SubscriptionPlan.filter({
        id: subscription.plan_id
      });
      return plans[0] || null;
    },
    enabled: !!subscription?.plan_id,
  });

  const { data: allPlans = [] } = useQuery({
    queryKey: ['all-plans'],
    queryFn: async () => {
      return base44.entities.SubscriptionPlan.filter({
        is_active: true
      }, "sort_order");
    },
    initialData: [],
  });

  // Real-time usage data
  const { data: pluginsUsed = 0 } = useQuery({
    queryKey: ['my-plugins-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const plugins = await base44.entities.Plugin.filter({
        owner_type: "user",
        owner_id: user.id
      });
      return plugins.length;
    },
    enabled: !!user,
    initialData: 0,
  });

  const { data: sitesUsed = 0 } = useQuery({
    queryKey: ['my-sites-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const sites = await base44.entities.Site.filter({
        owner_type: "user",
        owner_id: user.id
      });
      return sites.length;
    },
    enabled: !!user,
    initialData: 0,
  });

  const { data: teamsUsed = 0 } = useQuery({
    queryKey: ['my-teams-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const teams = await base44.entities.Team.filter({
        owner_id: user.id
      });
      return teams.length;
    },
    enabled: !!user,
    initialData: 0,
  });

  const { data: projectsUsed = 0 } = useQuery({
    queryKey: ['my-projects-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const allProjects = await base44.entities.Project.list();
      const myTeams = await base44.entities.Team.filter({ owner_id: user.id });
      const myTeamIds = myTeams.map(t => t.id);
      return allProjects.filter(p => myTeamIds.includes(p.team_id)).length;
    },
    enabled: !!user,
    initialData: 0,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['my-invoices', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.Invoice.filter({ user_id: user.id }, "-created_date");
    },
    enabled: !!user,
    initialData: [],
  });

  const downloadInvoiceMutation = useMutation({
    mutationFn: async (invoiceId) => {
      const response = await base44.functions.invoke('generateInvoicePDF', {
        invoice_id: invoiceId
      });
      return { data: response.data, invoiceId };
    },
    onSuccess: ({ data, invoiceId }) => {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Factuur-${invoice?.invoice_number || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij downloaden",
        description: error.message,
      });
    }
  });

  const changeSubscriptionMutation = useMutation({
    mutationFn: async ({ plan_id, action }) => {
      const response = await base44.functions.invoke('changeSubscription', {
        new_plan_id: plan_id,
        action: action
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-plan'] });
      setShowChangeDialog(false);
      setSelectedPlan(null);
      setChangeAction(null);
      setDowngradeViolations([]);
      
      toast({
        title: changeAction === 'upgrade' ? "Upgrade succesvol!" : "Downgrade gepland",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij wijzigen abonnement",
        description: error.response?.data?.error || error.message,
      });
    }
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('cancelSubscription');
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      toast({
        title: "Abonnement opgezegd",
        description: `Je abonnement eindigt op ${format(new Date(data.cancels_at), "d MMMM yyyy", { locale: nl })}`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij annuleren",
        description: error.response?.data?.error || error.message,
      });
    }
  });

  const handlePlanChange = async (targetPlan) => {
    if (!subscription || !plan || !user) return;

    // Determine if it's an upgrade or downgrade
    const currentPrice = subscription.interval === 'year' 
      ? plan.annual_price_amount 
      : plan.monthly_price_amount;
    
    const targetPrice = subscription.interval === 'year'
      ? targetPlan.annual_price_amount
      : targetPlan.monthly_price_amount;

    const action = targetPrice > currentPrice ? 'upgrade' : 'downgrade';

    setSelectedPlan(targetPlan);
    setChangeAction(action);

    // For downgrades, check eligibility
    if (action === 'downgrade') {
      setIsCheckingEligibility(true);
      const eligibility = await checkDowngradeEligibility(user.id, targetPlan);
      setIsCheckingEligibility(false);
      
      if (!eligibility.allowed) {
        setDowngradeViolations(eligibility.violations);
      } else {
        setDowngradeViolations([]);
      }
    } else {
      setDowngradeViolations([]);
    }

    setShowChangeDialog(true);
  };

  const handleConfirmChange = () => {
    if (!selectedPlan || !changeAction) return;
    
    // Don't allow downgrade if there are violations
    if (changeAction === 'downgrade' && downgradeViolations.length > 0) {
      return;
    }

    changeSubscriptionMutation.mutate({
      plan_id: selectedPlan.id,
      action: changeAction
    });
  };

  const formatPrice = (amountInCents, currency = "EUR") => {
    const amount = amountInCents / 100;
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getFeatureLabel = (featureCode) => {
    const labels = {
      plugin_upload: "Eigen plugins uploaden",
      site_health_check: "Site Health Check",
      teams: "Werken in teams",
      projects: "Projecten",
      project_milestones: "Project Mijlpalen",
      project_templates: "Project Templates",
      backups: "Backups",
      sitespeed_analyse: "Sitespeed analyse",
      blogposts_plaatsen: "Blogposts plaatsen",
      woocommerce_shop_beheer: "WooCommerce Shop beheer",
      server_integratie: "Server Integratie",
      klantbeheer_agencies: "Klantbeheer voor Agencies",
      site_monitoring: "Site Monitoring"
    };
    return labels[featureCode] || featureCode;
  };

  const getStatusBadge = (status) => {
    const config = {
      active: { label: "Actief", className: "bg-green-100 text-green-700 border-green-200" },
      trialing: { label: "Trial", className: "bg-blue-100 text-blue-700 border-blue-200" },
      past_due: { label: "Betaling Mislukt", className: "bg-red-100 text-red-700 border-red-200" },
      canceled: { label: "Geannuleerd", className: "bg-gray-100 text-gray-700 border-gray-200" }
    };
    return config[status] || { label: status, className: "bg-gray-100 text-gray-700" };
  };

  const calculateUsagePercentage = (used, max) => {
    if (max === -1) return 0; // Unlimited
    return Math.min((used / max) * 100, 100);
  };

  const isLoading = subLoading || planLoading;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-none shadow-2xl">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Crown className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Nog geen actief abonnement</h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Upgrade naar een premium plan om toegang te krijgen tot alle features en onbeperkte mogelijkheden
              </p>
              <Button asChild size="lg" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg">
                <Link to={createPageUrl("Pricing")}>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Bekijk Abonnementen
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const statusBadge = getStatusBadge(subscription.status);
  const isTrialing = subscription.status === "trialing";
  const isPastDue = subscription.status === "past_due";
  const isManual = subscription.is_manual;

  return (
    <div className="p-6 md:p-8 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mijn Abonnement</h1>
          <p className="text-gray-600">Beheer je abonnement en bekijk je gebruik</p>
        </div>

        {/* Status Alerts */}
        {isTrialing && subscription.trial_end && (
          <Card className="border-blue-200 bg-blue-50 mb-6">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-blue-900">Trial Periode Actief</p>
                <p className="text-sm text-blue-700">
                  Je trial eindigt op {format(new Date(subscription.trial_end), "d MMMM yyyy", { locale: nl })}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isPastDue && (
          <Card className="border-red-200 bg-red-50 mb-6">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-red-900">Betaling Mislukt</p>
                <p className="text-sm text-red-700">
                  Er is een probleem met je betaling. Update je betaalmethode om je abonnement actief te houden.
                </p>
              </div>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                Betaalmethode Bijwerken
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Current Plan Card */}
          <Card className="lg:col-span-2 border-none shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <CardTitle className="text-2xl">{plan?.name || "Premium Plan"}</CardTitle>
                    <Badge className={statusBadge.className}>
                      {statusBadge.label}
                    </Badge>
                    {isManual && (
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                        Handmatig
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-600">{plan?.description}</p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Crown className="w-8 h-8 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Pricing Info */}
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-gray-900">
                  {formatPrice(subscription.amount, subscription.currency)}
                </span>
                <span className="text-gray-500">/ {subscription.interval === "month" ? "maand" : "jaar"}</span>
              </div>

              {/* Billing Period */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Huidige Periode</span>
                  <Calendar className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-sm text-gray-900">
                  {format(new Date(subscription.current_period_start), "d MMM yyyy", { locale: nl })} - {format(new Date(subscription.current_period_end), "d MMM yyyy", { locale: nl })}
                </p>
              </div>

              {/* Features */}
              {plan?.features && plan.features.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Inbegrepen Features</h4>
                  <div className="grid md:grid-cols-2 gap-2">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {getFeatureLabel(feature)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {!isManual && (
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Betaalmethode
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <Download className="w-4 h-4 mr-2" />
                      Facturen
                    </Button>
                  </div>
                  {!subscription.cancel_at_period_end && (
                    <Button
                      variant="outline"
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      onClick={() => {
                        if (confirm('Weet je zeker dat je je abonnement wilt opzeggen? Het blijft actief tot het einde van je huidige facturatieperiode.')) {
                          cancelSubscriptionMutation.mutate();
                        }
                      }}
                      disabled={cancelSubscriptionMutation.isPending}
                    >
                      {cancelSubscriptionMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Bezig met annuleren...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          Abonnement Opzeggen
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="space-y-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-base">Facturatie</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Volgende Betaling</p>
                  <p className="text-lg font-bold text-gray-900">
                    {format(new Date(subscription.current_period_end), "d MMM yyyy", { locale: nl })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Bedrag</p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatPrice(subscription.amount, subscription.currency)}
                  </p>
                </div>
                {subscription.vat_percentage && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">BTW</p>
                    <p className="text-sm text-gray-900">{subscription.vat_percentage}%</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {subscription.cancel_at_period_end && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900 text-sm">Abonnement Geannuleerd</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Je abonnement eindigt op {format(new Date(subscription.current_period_end), "d MMM yyyy", { locale: nl })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Usage Stats */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Gebruik & Limieten
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Plugins */}
              {plan?.features?.plugins && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm font-medium text-gray-700">Plugins</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      {pluginsUsed} / {plan.features.plugins.limit === -1 ? '∞' : plan.features.plugins.limit}
                    </span>
                  </div>
                  <Progress
                    value={calculateUsagePercentage(pluginsUsed, plan.features.plugins.limit)}
                    className="h-2"
                  />
                </div>
              )}

              {/* Sites */}
              {plan?.features?.sites && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-medium text-gray-700">Sites</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      {sitesUsed} / {plan.features.sites.limit === -1 ? '∞' : plan.features.sites.limit}
                    </span>
                  </div>
                  <Progress
                    value={calculateUsagePercentage(sitesUsed, plan.features.sites.limit)}
                    className="h-2"
                  />
                </div>
              )}

              {/* Teams */}
              {plan?.features?.teams && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">Teams</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      {teamsUsed} / {plan.features.teams.limit === -1 ? '∞' : plan.features.teams.limit}
                    </span>
                  </div>
                  <Progress
                    value={calculateUsagePercentage(teamsUsed, plan.features.teams.limit)}
                    className="h-2"
                  />
                </div>
              )}

              {/* Projects */}
              {plan?.features?.projects && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-gray-700">Projecten</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      {projectsUsed} / {plan.features.projects.limit === -1 ? '∞' : plan.features.projects.limit}
                    </span>
                  </div>
                  <Progress
                    value={calculateUsagePercentage(projectsUsed, plan.features.projects.limit)}
                    className="h-2"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invoices - Always visible */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-600" />
              Facturen ({invoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {invoices.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Download className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nog geen facturen beschikbaar</p>
                <p className="text-xs text-gray-400 mt-1">
                  Facturen worden automatisch aangemaakt bij betalingen
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    to={`${createPageUrl("InvoiceDetail")}?id=${invoice.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all cursor-pointer">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center">
                            <Download className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{invoice.invoice_number}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-gray-600">
                                {format(new Date(invoice.created_date), "d MMM yyyy", { locale: nl })}
                              </p>
                              <span className="text-gray-400">•</span>
                              <Badge className={
                                invoice.status === 'paid' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-amber-100 text-amber-700'
                              }>
                                {invoice.status === 'paid' ? 'Betaald' : 'Open'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-gray-900">
                            {formatPrice(invoice.amount, invoice.currency)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {invoice.plan_name}
                          </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upgrade/Downgrade Options */}
        {!isManual && allPlans.length > 0 && (
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Wijzig je Abonnement
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-600 mb-6">
                Upgrade voor meer features of downgrade als je minder nodig hebt.
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                {allPlans
                  .filter(p => p.id !== subscription.plan_id)
                  .map((upgradePlan) => {
                    const targetPrice = subscription.interval === 'year'
                      ? upgradePlan.annual_price_amount
                      : upgradePlan.monthly_price_amount;
                    
                    const currentPrice = subscription.interval === 'year'
                      ? plan.annual_price_amount
                      : plan.monthly_price_amount;
                    
                    const isUpgrade = targetPrice > currentPrice;

                    return (
                      <Card key={upgradePlan.id} className="border-2 border-gray-200 hover:border-indigo-300 transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-gray-900 flex-1">{upgradePlan.name}</h4>
                            {isUpgrade ? (
                              <ArrowUp className="w-4 h-4 text-green-600" />
                            ) : (
                              <ArrowDown className="w-4 h-4 text-amber-600" />
                            )}
                          </div>
                          <div className="flex items-baseline gap-1 mb-3">
                            <span className="text-2xl font-bold text-gray-900">
                              {formatPrice(targetPrice, upgradePlan.currency).split(',')[0]}
                            </span>
                            <span className="text-gray-500 text-sm">/{subscription.interval === 'year' ? 'jaar' : 'maand'}</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handlePlanChange(upgradePlan)}
                            className={`w-full ${
                              isUpgrade
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                                : 'bg-amber-500 hover:bg-amber-600 text-white'
                            }`}
                            disabled={changeSubscriptionMutation.isPending || isCheckingEligibility}
                          >
                            {isUpgrade ? (
                              <>
                                <ArrowUp className="w-4 h-4 mr-1" />
                                Upgrade
                              </>
                            ) : (
                              <>
                                <ArrowDown className="w-4 h-4 mr-1" />
                                Downgrade
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Change Subscription Dialog */}
      <Dialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {changeAction === 'upgrade' ? (
                <>
                  <ArrowUp className="w-5 h-5 text-green-600" />
                  Upgrade naar {selectedPlan?.name}
                </>
              ) : (
                <>
                  <ArrowDown className="w-5 h-5 text-amber-600" />
                  Downgrade naar {selectedPlan?.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {changeAction === 'upgrade' ? (
                'Je abonnement wordt direct geüpgraded. Het prijsverschil wordt nu direct betaald en je huidige betaalcyclus blijft ongewijzigd.'
              ) : (
                'Je downgrade wordt gepland voor het einde van je huidige facturatieperiode.'
              )}
            </DialogDescription>
          </DialogHeader>

          {isCheckingEligibility ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="space-y-4">
              {changeAction === 'downgrade' && downgradeViolations.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-900 text-sm">Downgrade niet mogelijk</p>
                        <p className="text-xs text-red-700 mt-1">
                          Je huidige gebruik overschrijdt de limieten van het nieuwe plan:
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-2 ml-7 list-disc">
                      {downgradeViolations.map((violation, idx) => (
                        <li key={idx} className="text-xs text-red-800">
                          {violation.message}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {changeAction === 'upgrade' && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-900 text-sm">Direct actief</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Je upgrade wordt direct doorgevoerd en je betaalt nu het prijsverschil. Je krijgt direct toegang tot alle nieuwe features.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {changeAction === 'downgrade' && downgradeViolations.length === 0 && (
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900 text-sm">Ingepland voor einde periode</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Je downgrade gaat in op {subscription?.current_period_end && format(new Date(subscription.current_period_end), "d MMMM yyyy", { locale: nl })}. Tot die tijd blijf je toegang houden tot alle features van je huidige plan.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Huidig plan:</span>
                  <span className="font-semibold text-gray-900">{plan?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Nieuw plan:</span>
                  <span className="font-semibold text-gray-900">{selectedPlan?.name}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowChangeDialog(false);
                setSelectedPlan(null);
                setChangeAction(null);
                setDowngradeViolations([]);
              }}
            >
              Annuleren
            </Button>
            <Button
              onClick={handleConfirmChange}
              disabled={
                changeSubscriptionMutation.isPending ||
                isCheckingEligibility ||
                (changeAction === 'downgrade' && downgradeViolations.length > 0)
              }
              className={changeAction === 'upgrade'
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
              }
            >
              {changeSubscriptionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Bezig...
                </>
              ) : (
                <>Bevestigen</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}