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
  TrendingUp,
  Clock,
  Briefcase,
  Layers,
  Crown,
  Infinity
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Home() {
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

  const { data: planGroups = [] } = useQuery({
    queryKey: ['public-plan-groups'],
    queryFn: async () => {
      const groups = await base44.entities.PlanGroup.filter({
        is_active: true
      }, "sort_order");
      return groups;
    },
    staleTime: 0,
    initialData: [],
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['public-subscription-plans'],
    queryFn: async () => {
      const allPlans = await base44.entities.SubscriptionPlan.filter({
        is_active: true
      }, "sort_order");
      return allPlans;
    },
    staleTime: 0,
    initialData: [],
  });

  const formatPrice = (amountInCents, currency) => {
    const amount = amountInCents / 100;
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getFeatureIcon = (featureKey) => {
    const icons = {
      plugins: Package,
      sites: Globe,
      projects: Briefcase,
      teams: Users
    };
    return icons[featureKey] || Package;
  };

  const getFeatureLabel = (featureKey) => {
    const labels = {
      plugins: 'Plugins',
      sites: 'Sites',
      projects: 'Projecten',
      teams: 'Teams'
    };
    return labels[featureKey] || featureKey;
  };

  const plansGrouped = plans.reduce((acc, plan) => {
    const groupId = plan.group_id || 'ungrouped';
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(plan);
    return acc;
  }, {});

  const getGroupIcon = (iconName) => {
    const icons = {
      users: Users,
      building: Briefcase,
      package: Package,
      crown: Crown,
      layers: Layers
    };
    return icons[iconName] || Layers;
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

      {/* Pricing Section - Grouped by Plan Groups */}
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

            <div className="space-y-16">
              {/* Plans grouped by PlanGroup */}
              {planGroups.map((group) => {
                const groupPlans = plansGrouped[group.id] || [];
                if (groupPlans.length === 0) return null;

                const GroupIcon = getGroupIcon(group.icon);

                return (
                  <div key={group.id}>
                    <div className="flex items-center justify-center gap-3 mb-8">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md"
                        style={{ backgroundColor: `${group.color}20` }}
                      >
                        <GroupIcon className="w-6 h-6" style={{ color: group.color }} />
                      </div>
                      <div className="text-center">
                        <h3 className="text-2xl font-bold text-gray-900">{group.name}</h3>
                        {group.description && (
                          <p className="text-gray-600">{group.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                      {groupPlans.map((plan) => (
                        <Card 
                          key={plan.id} 
                          className={`border-2 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl ${
                            plan.is_highlighted 
                              ? 'border-indigo-500 ring-2 ring-indigo-200' 
                              : 'border-gray-200 hover:border-indigo-300'
                          }`}
                        >
                          {plan.is_highlighted && (
                            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 py-2 text-center">
                              <Badge className="bg-white text-indigo-700 font-semibold px-3">
                                <Star className="w-3 h-3 mr-1" fill="currentColor" />
                                {plan.highlight_label || "Meest Populair"}
                              </Badge>
                            </div>
                          )}
                          
                          <CardHeader className={`text-center ${plan.is_highlighted ? 'pt-6' : 'pt-8'} pb-6`}>
                            <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                            {plan.description && (
                              <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                            )}
                            <div className="flex items-baseline justify-center gap-1 mb-2">
                              <span className="text-4xl font-bold text-gray-900">
                                {formatPrice(plan.monthly_price_amount, plan.currency)}
                              </span>
                              <span className="text-gray-500">/maand</span>
                            </div>
                            {plan.annual_discount_percentage > 0 && (
                              <p className="text-xs text-green-600 font-medium">
                                Bespaar {plan.annual_discount_percentage}% bij jaarlijkse betaling
                              </p>
                            )}
                            {plan.trial_days > 0 && (
                              <Badge className="bg-green-100 text-green-700 border-green-200 mt-2">
                                <Clock className="w-3 h-3 mr-1" />
                                {plan.trial_days} dagen gratis proberen
                              </Badge>
                            )}
                          </CardHeader>
                          
                          <CardContent className="p-6 pt-0">
                            <div className="space-y-3 mb-6">
                              <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                                Inbegrepen Features:
                              </h4>
                              {Object.entries(plan.features || {}).map(([key, feature]) => {
                                if (!feature.enabled) return null;
                                const FeatureIcon = getFeatureIcon(key);
                                return (
                                  <div key={key} className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <FeatureIcon className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-900">
                                        {feature.limit === -1 ? (
                                          <>
                                            <Infinity className="w-4 h-4 inline mr-1" />
                                            Onbeperkt {getFeatureLabel(key)}
                                          </>
                                        ) : (
                                          <>{feature.limit} {getFeatureLabel(key)}</>
                                        )}
                                      </p>
                                    </div>
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  </div>
                                );
                              })}
                            </div>

                            <Button 
                              asChild 
                              className={`w-full ${
                                plan.is_highlighted
                                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg'
                                  : 'bg-white hover:bg-gray-50 border-2 border-gray-200'
                              }`}
                            >
                              <Link to={createPageUrl(`Pricing?highlight=${plan.id}`)}>
                                {plan.is_highlighted ? (
                                  <>
                                    <Rocket className="w-4 h-4 mr-2" />
                                    Start Nu
                                  </>
                                ) : (
                                  <>
                                    Meer Info
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                  </>
                                )}
                              </Link>
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Plans without group */}
              {plansGrouped['ungrouped'] && plansGrouped['ungrouped'].length > 0 && (
                <div>
                  <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md bg-gray-100">
                      <Package className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-gray-900">Andere Plannen</h3>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {plansGrouped['ungrouped'].map((plan) => (
                      <Card 
                        key={plan.id} 
                        className={`border-2 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl ${
                          plan.is_highlighted 
                            ? 'border-indigo-500 ring-2 ring-indigo-200' 
                            : 'border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        {plan.is_highlighted && (
                          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 py-2 text-center">
                            <Badge className="bg-white text-indigo-700 font-semibold px-3">
                              <Star className="w-3 h-3 mr-1" fill="currentColor" />
                              {plan.highlight_label || "Meest Populair"}
                            </Badge>
                          </div>
                        )}
                        
                        <CardHeader className={`text-center ${plan.is_highlighted ? 'pt-6' : 'pt-8'} pb-6`}>
                          <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                          {plan.description && (
                            <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                          )}
                          <div className="flex items-baseline justify-center gap-1 mb-2">
                            <span className="text-4xl font-bold text-gray-900">
                              {formatPrice(plan.monthly_price_amount, plan.currency)}
                            </span>
                            <span className="text-gray-500">/maand</span>
                          </div>
                          {plan.trial_days > 0 && (
                            <Badge className="bg-green-100 text-green-700 border-green-200 mt-2">
                              <Clock className="w-3 h-3 mr-1" />
                              {plan.trial_days} dagen gratis proberen
                            </Badge>
                          )}
                        </CardHeader>
                        
                        <CardContent className="p-6 pt-0">
                          <div className="space-y-3 mb-6">
                            <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                              Inbegrepen Features:
                            </h4>
                            {Object.entries(plan.features || {}).map(([key, feature]) => {
                              if (!feature.enabled) return null;
                              const FeatureIcon = getFeatureIcon(key);
                              return (
                                <div key={key} className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FeatureIcon className="w-4 h-4 text-indigo-600" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">
                                      {feature.limit === -1 ? (
                                        <>
                                          <Infinity className="w-4 h-4 inline mr-1" />
                                          Onbeperkt {getFeatureLabel(key)}
                                        </>
                                      ) : (
                                        <>{feature.limit} {getFeatureLabel(key)}</>
                                      )}
                                    </p>
                                  </div>
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                </div>
                              );
                            })}
                          </div>

                          <Button 
                            asChild 
                            className={`w-full ${
                              plan.is_highlighted
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg'
                                : 'bg-white hover:bg-gray-50 border-2 border-gray-200'
                            }`}
                          >
                            <Link to={createPageUrl(`Pricing?highlight=${plan.id}`)}>
                              {plan.is_highlighted ? (
                                <>
                                  <Rocket className="w-4 h-4 mr-2" />
                                  Start Nu
                                </>
                              ) : (
                                <>
                                  Meer Info
                                  <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                              )}
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

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