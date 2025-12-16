import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Globe,
  Users,
  Zap,
  Shield,
  Rocket,
  CheckCircle,
  ArrowRight,
  Star,
  Sparkles,
  Code,
  TrendingUp,
  Clock,
  Settings
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Info() {
  const [user, setUser] = useState(null);

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

  const { data: plans = [] } = useQuery({
    queryKey: ['public-subscription-plans'],
    queryFn: async () => {
      const allPlans = await base44.entities.SubscriptionPlan.filter({
        is_active: true
      }, "sort_order");
      return allPlans;
    },
    initialData: [],
  });

  const highlightedPlan = plans.find(p => p.is_highlighted);
  const otherPlans = plans.filter(p => !p.is_highlighted);

  const formatPrice = (amountInCents, currency) => {
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

  const features = [
    {
      icon: Package,
      title: "Plugin Beheer",
      description: "Upload en beheer je eigen WordPress plugins of kies uit de WordPress library"
    },
    {
      icon: Globe,
      title: "Multi-Site Management",
      description: "Beheer al je WordPress sites vanaf één centraal dashboard"
    },
    {
      icon: Users,
      title: "Team Samenwerking",
      description: "Werk samen met je team en deel resources eenvoudig"
    },
    {
      icon: Zap,
      title: "Real-time Updates",
      description: "Installeer, activeer en update plugins direct vanuit het platform"
    },
    {
      icon: Shield,
      title: "Veilig & Betrouwbaar",
      description: "Jouw data is veilig met end-to-end encryptie en regelmatige backups"
    },
    {
      icon: Rocket,
      title: "Snelle Deployment",
      description: "Deploy plugins naar meerdere sites met één klik"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">WP Cloud Hub</h1>
              <p className="text-xs text-gray-500">by Code045</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Button asChild className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg">
                <Link to={createPageUrl("Dashboard")}>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Ga naar Dashboard
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <a href="/login">Inloggen</a>
                </Button>
                <Button asChild className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg">
                  <a href="/register">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Start Gratis
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 mb-6">
              <Sparkles className="w-3 h-3 mr-1" />
              Het Complete WordPress Management Platform
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Beheer al je WordPress sites
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> vanaf één plek</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
              WP Cloud Hub centraliseert je WordPress plugin- en sitebeheer. Upload eigen plugins, beheer meerdere sites en werk samen met je team - alles in één krachtig platform.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              {user ? (
                <Button asChild size="lg" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-xl text-lg px-8">
                  <Link to={createPageUrl("Dashboard")}>
                    <Rocket className="w-5 h-5 mr-2" />
                    Open Dashboard
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-xl text-lg px-8">
                    <a href="/register">
                      <Sparkles className="w-5 h-5 mr-2" />
                      Gratis Starten
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="text-lg px-8">
                    <Link to={createPageUrl("Pricing")}>
                      Bekijk Prijzen
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 mb-4">
              <TrendingUp className="w-3 h-3 mr-1" />
              Krachtige Features
            </Badge>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Alles wat je nodig hebt voor WordPress beheer
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Van plugin management tot team samenwerking - WP Cloud Hub heeft alle tools die je nodig hebt
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <Card key={idx} className="border-none shadow-lg hover:shadow-2xl transition-all duration-300 group">
                <CardHeader>
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section with Highlighted Plan */}
      {plans.length > 0 && (
        <section className="py-20 px-6 bg-gradient-to-br from-gray-50 to-indigo-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 mb-4">
                <Sparkles className="w-3 h-3 mr-1" />
                Kies je Plan
              </Badge>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Eenvoudige, transparante prijzen
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Start gratis of kies een plan dat past bij jouw behoeften
              </p>
            </div>

            {/* Highlighted Plan */}
            {highlightedPlan && (
              <div className="max-w-4xl mx-auto mb-12">
                <Card className="border-4 border-indigo-500 shadow-2xl rounded-3xl overflow-hidden relative">
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-indigo-500 to-purple-600 py-3 text-center">
                    <Badge className="bg-white text-indigo-700 font-semibold px-4 py-1">
                      <Star className="w-4 h-4 mr-1" fill="currentColor" />
                      {highlightedPlan.highlight_label || "Meest Populair"}
                    </Badge>
                  </div>
                  <CardHeader className="pt-16 pb-8 text-center bg-gradient-to-br from-indigo-50 to-purple-50">
                    <CardTitle className="text-3xl mb-4">{highlightedPlan.name}</CardTitle>
                    <p className="text-gray-600 mb-6">{highlightedPlan.description}</p>
                    <div className="flex items-baseline justify-center gap-2 mb-4">
                      <span className="text-5xl font-bold text-gray-900">
                        {formatPrice(highlightedPlan.monthly_price_amount, highlightedPlan.currency)}
                      </span>
                      <span className="text-xl text-gray-500">/maand</span>
                    </div>
                    {highlightedPlan.trial_days > 0 && (
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        <Clock className="w-3 h-3 mr-1" />
                        {highlightedPlan.trial_days} dagen gratis proberen
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="p-8">
                    {highlightedPlan.features && highlightedPlan.features.length > 0 && (
                      <div className="mb-8">
                        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          Inbegrepen Features
                        </h4>
                        <ul className="space-y-3">
                          {highlightedPlan.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-700">{getFeatureLabel(feature)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {highlightedPlan.limits && Object.keys(highlightedPlan.limits).length > 0 && (
                      <div className="mb-8 pb-8 border-b border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Settings className="w-5 h-5 text-indigo-500" />
                          Limieten
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          {highlightedPlan.limits.max_personal_sites && (
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="text-sm text-gray-600">Sites</span>
                              <span className="font-semibold text-gray-900">
                                {highlightedPlan.limits.max_personal_sites === -1 ? 'Onbeperkt' : highlightedPlan.limits.max_personal_sites}
                              </span>
                            </div>
                          )}
                          {highlightedPlan.limits.max_personal_plugins && (
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="text-sm text-gray-600">Plugins</span>
                              <span className="font-semibold text-gray-900">
                                {highlightedPlan.limits.max_personal_plugins === -1 ? 'Onbeperkt' : highlightedPlan.limits.max_personal_plugins}
                              </span>
                            </div>
                          )}
                          {highlightedPlan.limits.max_teams && (
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="text-sm text-gray-600">Teams</span>
                              <span className="font-semibold text-gray-900">
                                {highlightedPlan.limits.max_teams === -1 ? 'Onbeperkt' : highlightedPlan.limits.max_teams}
                              </span>
                            </div>
                          )}
                          {highlightedPlan.limits.max_projects && (
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="text-sm text-gray-600">Projecten</span>
                              <span className="font-semibold text-gray-900">
                                {highlightedPlan.limits.max_projects === -1 ? 'Onbeperkt' : highlightedPlan.limits.max_projects}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <Button asChild size="lg" className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg text-lg">
                      <Link to={createPageUrl("Pricing")}>
                        <Rocket className="w-5 h-5 mr-2" />
                        Start Nu
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Other Plans */}
            {otherPlans.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">Andere Plannen</h3>
                <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                  {otherPlans.map((plan) => (
                    <Card key={plan.id} className="border-2 border-gray-200 hover:border-indigo-300 hover:shadow-xl transition-all duration-300 rounded-2xl">
                      <CardHeader className="text-center pb-6">
                        <CardTitle className="text-xl mb-2">{plan.name}</CardTitle>
                        <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-3xl font-bold text-gray-900">
                            {formatPrice(plan.monthly_price_amount, plan.currency).split(',')[0]}
                          </span>
                          <span className="text-gray-500">/maand</span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {plan.features && plan.features.length > 0 && (
                          <ul className="space-y-2">
                            {plan.features.slice(0, 4).map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                <span className="text-gray-700">{getFeatureLabel(feature)}</span>
                              </li>
                            ))}
                            {plan.features.length > 4 && (
                              <li className="text-sm text-gray-500 pl-6">
                                +{plan.features.length - 4} meer...
                              </li>
                            )}
                          </ul>
                        )}
                        <Button asChild className="w-full" variant="outline">
                          <Link to={createPageUrl("Pricing")}>
                            Meer Info
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center mt-12">
              <Button asChild size="lg" variant="outline">
                <Link to={createPageUrl("Pricing")}>
                  Bekijk Alle Plannen & Prijzen
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-indigo-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl font-bold mb-6">
            Klaar om te starten?
          </h2>
          <p className="text-xl mb-10 text-indigo-100">
            Join honderden tevreden gebruikers die hun WordPress sites beheren met WP Cloud Hub
          </p>
          {user ? (
            <Button asChild size="lg" className="bg-white text-indigo-600 hover:bg-gray-100 shadow-xl text-lg px-8">
              <Link to={createPageUrl("Dashboard")}>
                <Rocket className="w-5 h-5 mr-2" />
                Ga naar Dashboard
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="bg-white text-indigo-600 hover:bg-gray-100 shadow-xl text-lg px-8">
              <a href="/register">
                <Sparkles className="w-5 h-5 mr-2" />
                Gratis Account Aanmaken
              </a>
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">WP Cloud Hub</h3>
              <p className="text-xs">by Code045</p>
            </div>
          </div>
          <p className="text-sm">
            © {new Date().getFullYear()} WP Cloud Hub. Alle rechten voorbehouden.
          </p>
        </div>
      </footer>
    </div>
  );
}