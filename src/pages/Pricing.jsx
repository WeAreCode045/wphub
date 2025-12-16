import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  X,
  Star,
  Loader2,
  ArrowRight,
  Sparkles,
  Package,
  Globe,
  Users,
  Briefcase,
  Zap
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Pricing() {
  const [user, setUser] = useState(null);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [discountCode, setDiscountCode] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.log("User not logged in");
    }
  };

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const allPlans = await base44.entities.SubscriptionPlan.filter({
        is_active: true
      }, "sort_order");
      return allPlans;
    },
    initialData: [],
  });

  const { data: mySubscription } = useQuery({
    queryKey: ['my-subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const subs = await base44.entities.UserSubscription.filter({
        user_id: user.id,
        status: ['active', 'trialing']
      });
      return subs.length > 0 ? subs[0] : null;
    },
    enabled: !!user,
  });

  const handleCheckout = async (plan) => {
    if (!user) {
      // Redirect to login/register
      window.location.href = '/login'; // Adjust based on your auth setup
      return;
    }

    setIsCheckingOut(true);
    try {
      const response = await base44.functions.invoke('createCheckoutSession', {
        plan_id: plan.id,
        billing_cycle: billingCycle === "monthly" ? "month" : "year",
        discount_code: discountCode || null,
        success_url: `${window.location.origin}${createPageUrl('Dashboard')}?subscription=success`,
        cancel_url: `${window.location.origin}${createPageUrl('Pricing')}`
      });

      if (response.data.success && response.data.url) {
        // Redirect to Stripe Checkout
        window.location.href = response.data.url;
      } else {
        alert('❌ Fout bij het starten van checkout: ' + response.data.error);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('❌ Fout bij het starten van checkout');
    }
    setIsCheckingOut(false);
  };

  const getFeatureIcon = (featureCode) => {
    const icons = {
      plugin_upload: Package,
      site_health_check: Zap,
      teams: Users,
      projects: Briefcase,
      site_monitoring: Globe
    };
    return icons[featureCode] || Check;
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
      sitespeed_analyse: "Sitespeed analyse (binnenkort)",
      blogposts_plaatsen: "Blogposts plaatsen (binnenkort)",
      woocommerce_shop_beheer: "WooCommerce Shop beheer (binnenkort)",
      server_integratie: "Server Integratie (binnenkort)",
      klantbeheer_agencies: "Klantbeheer voor Agencies (binnenkort)",
      site_monitoring: "Site Monitoring"
    };
    return labels[featureCode] || featureCode;
  };

  const formatPrice = (amountInCents, currency) => {
    const amount = amountInCents / 100;
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const calculateAnnualSavings = (plan) => {
    if (!plan.annual_discount_percentage) return null;
    const monthlyCost = plan.monthly_price_amount * 12;
    const annualCost = plan.annual_price_amount;
    const savings = monthlyCost - annualCost;
    return formatPrice(savings, plan.currency);
  };

  const highlightedPlan = plans.find(p => p.is_highlighted);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">WP Cloud Hub</h1>
              <p className="text-xs text-gray-500">by Code045</p>
            </div>
          </Link>
          {user ? (
            <Button asChild variant="outline">
              <Link to={createPageUrl("Dashboard")}>
                <ArrowRight className="w-4 h-4 mr-2" />
                Ga naar Dashboard
              </Link>
            </Button>
          ) : (
            <Button asChild className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
              <a href="/login">
                Inloggen
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-12 text-center">
        <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 mb-4">
          <Sparkles className="w-3 h-3 mr-1" />
          Kies het perfecte plan voor jouw WordPress beheer
        </Badge>
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Eenvoudige, transparante prijzen
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Beheer al je WordPress sites, plugins en teams vanaf één centraal platform. Geen verborgen kosten, annuleer wanneer je wilt.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
            Maandelijks
          </span>
          <Switch
            checked={billingCycle === "annual"}
            onCheckedChange={(checked) => setBillingCycle(checked ? "annual" : "monthly")}
            className="data-[state=checked]:bg-indigo-600"
          />
          <span className={`text-sm font-medium ${billingCycle === 'annual' ? 'text-gray-900' : 'text-gray-500'}`}>
            Jaarlijks
          </span>
          {billingCycle === "annual" && (
            <Badge className="bg-green-100 text-green-700 border-green-200">
              Bespaar tot 20%
            </Badge>
          )}
        </div>

        {/* Discount Code Input */}
        <div className="max-w-md mx-auto mb-12">
          <Label htmlFor="discount-code" className="text-sm text-gray-600 mb-2 block">
            Heb je een kortingscode?
          </Label>
          <div className="flex gap-2">
            <Input
              id="discount-code"
              placeholder="Voer kortingscode in"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              className="text-center"
            />
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const price = billingCycle === "monthly" 
              ? plan.monthly_price_amount 
              : plan.annual_price_amount;
            const isHighlighted = plan.is_highlighted;
            const hasSubscription = mySubscription && mySubscription.plan_id === plan.id;
            const savings = billingCycle === "annual" ? calculateAnnualSavings(plan) : null;

            return (
              <Card
                key={plan.id}
                className={`relative border-2 transition-all duration-300 hover:shadow-2xl ${
                  isHighlighted
                    ? 'border-indigo-500 shadow-2xl scale-105'
                    : 'border-gray-200 hover:border-indigo-300'
                }`}
              >
                {isHighlighted && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-1 shadow-lg">
                      <Star className="w-3 h-3 mr-1" fill="currentColor" />
                      {plan.highlight_label || "Meest Populair"}
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4 pt-8">
                  <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </CardTitle>
                  <p className="text-sm text-gray-600 mb-6">
                    {plan.description}
                  </p>
                  <div className="mb-6">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold text-gray-900">
                        {formatPrice(price, plan.currency).split(',')[0]}
                      </span>
                      <span className="text-2xl text-gray-600">
                        ,{formatPrice(price, plan.currency).split(',')[1]?.substring(0, 2) || '00'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      per {billingCycle === "monthly" ? "maand" : "jaar"}
                    </p>
                    {savings && (
                      <p className="text-xs text-green-600 font-medium mt-1">
                        Bespaar {savings} per jaar
                      </p>
                    )}
                  </div>

                  {hasSubscription ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 w-full py-2">
                      <Check className="w-4 h-4 mr-1" />
                      Huidig Abonnement
                    </Badge>
                  ) : (
                    <Button
                      onClick={() => handleCheckout(plan)}
                      disabled={isCheckingOut}
                      className={`w-full ${
                        isHighlighted
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg'
                          : 'bg-gray-900 hover:bg-gray-800 text-white'
                      }`}
                    >
                      {isCheckingOut ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Bezig...
                        </>
                      ) : (
                        <>
                          Start {plan.trial_days > 0 ? `${plan.trial_days} dagen gratis` : 'Nu'}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  )}
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Limits */}
                  {plan.limits && Object.keys(plan.limits).length > 0 && (
                    <div className="border-t border-gray-100 pt-6">
                      <h4 className="font-semibold text-sm text-gray-900 mb-3">Limieten</h4>
                      <div className="space-y-2">
                        {plan.limits.max_personal_plugins && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Eigen plugins</span>
                            <span className="font-semibold text-gray-900">
                              {plan.limits.max_personal_plugins === -1 ? 'Onbeperkt' : plan.limits.max_personal_plugins}
                            </span>
                          </div>
                        )}
                        {plan.limits.max_personal_sites && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Sites</span>
                            <span className="font-semibold text-gray-900">
                              {plan.limits.max_personal_sites === -1 ? 'Onbeperkt' : plan.limits.max_personal_sites}
                            </span>
                          </div>
                        )}
                        {plan.limits.max_teams && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Teams</span>
                            <span className="font-semibold text-gray-900">
                              {plan.limits.max_teams === -1 ? 'Onbeperkt' : plan.limits.max_teams}
                            </span>
                          </div>
                        )}
                        {plan.limits.max_projects && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Projecten</span>
                            <span className="font-semibold text-gray-900">
                              {plan.limits.max_projects === -1 ? 'Onbeperkt' : plan.limits.max_projects}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Features */}
                  {plan.features && plan.features.length > 0 && (
                    <div className="border-t border-gray-100 pt-6">
                      <h4 className="font-semibold text-sm text-gray-900 mb-3">Features</h4>
                      <ul className="space-y-3">
                        {plan.features.map((feature, idx) => {
                          const FeatureIcon = getFeatureIcon(feature);
                          return (
                            <li key={idx} className="flex items-start gap-3">
                              <FeatureIcon className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                              <span className="text-sm text-gray-700">
                                {getFeatureLabel(feature)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-4">
            Alle plannen bevatten basis WordPress beheer, plugin updates en 24/7 support
          </p>
          <p className="text-sm text-gray-500">
            BTW wordt automatisch berekend tijdens checkout
          </p>
        </div>
      </div>
    </div>
  );
}