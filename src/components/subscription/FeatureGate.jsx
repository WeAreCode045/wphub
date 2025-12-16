import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Crown, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { checkSubscriptionLimit, getPlansWithFeature } from "./LimitChecker";

/**
 * Feature Gate Component - Shows upgrade prompt if feature is not enabled
 * @param {Object} props
 * @param {string} props.userId - User ID
 * @param {string} props.featureType - Feature type (plugins, sites, teams, projects)
 * @param {React.ReactNode} props.children - Content to show if feature is enabled
 */
export default function FeatureGate({ userId, featureType, children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [limitInfo, setLimitInfo] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);

  useEffect(() => {
    if (!userId || !featureType) return;

    async function checkFeature() {
      setIsChecking(true);
      
      const result = await checkSubscriptionLimit(userId, featureType);
      setLimitInfo(result);
      setFeatureEnabled(result.enabled);

      if (!result.enabled) {
        const plans = await getPlansWithFeature(featureType);
        setAvailablePlans(plans);
      }

      setIsChecking(false);
    }

    checkFeature();
  }, [userId, featureType]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!featureEnabled) {
    const featureLabels = {
      plugins: 'Plugins',
      themes: 'Themes',
      sites: 'Sites',
      teams: 'Teams',
      projects: 'Projecten'
    };

    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 text-white text-center">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold mb-2">
                {featureLabels[featureType]} Functie Niet Beschikbaar
              </h2>
              <p className="text-indigo-100 text-lg">
                Deze functie is niet inbegrepen in je huidige {limitInfo?.planName} plan
              </p>
            </div>

            <CardContent className="p-8">
              {availablePlans.length > 0 ? (
                <>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Upgrade naar een plan met {featureLabels[featureType]}
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    {availablePlans.slice(0, 4).map((plan) => {
                      const feature = plan.features[featureType];
                      return (
                        <Card key={plan.id} className="border-2 border-gray-200 hover:border-indigo-500 transition-all">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-bold text-lg text-gray-900">{plan.name}</h4>
                                {plan.description && (
                                  <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                                )}
                              </div>
                              {plan.is_highlighted && (
                                <Badge className="bg-amber-100 text-amber-700">
                                  <Crown className="w-3 h-3 mr-1" />
                                  {plan.highlight_label || 'Popular'}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="mb-4">
                              <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-gray-900">
                                  €{(plan.monthly_price_amount / 100).toFixed(2)}
                                </span>
                                <span className="text-gray-600">/maand</span>
                              </div>
                            </div>

                            <div className="space-y-2 mb-4">
                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                <span className="font-medium text-gray-900">
                                  {feature.limit === -1 
                                    ? `Onbeperkt ${featureLabels[featureType]}`
                                    : `${feature.limit} ${featureLabels[featureType]}`
                                  }
                                </span>
                              </div>
                              {/* Show other features */}
                              {Object.entries(plan.features).map(([key, feat]) => {
                                if (key !== featureType && feat.enabled) {
                                  return (
                                    <div key={key} className="flex items-center gap-2 text-sm text-gray-600">
                                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                                      <span>
                                        {feat.limit === -1 ? 'Onbeperkt' : feat.limit} {featureLabels[key] || key}
                                      </span>
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>

                            <Button 
                              asChild 
                              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                            >
                              <Link to={createPageUrl(`Pricing?highlight=${plan.id}`)}>
                                Kies dit plan
                                <ArrowRight className="w-4 h-4 ml-2" />
                              </Link>
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  <div className="text-center">
                    <Button 
                      asChild 
                      variant="outline"
                      size="lg"
                    >
                      <Link to={createPageUrl('Pricing')}>
                        Bekijk alle plannen
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-6">
                    Er zijn momenteel geen plannen beschikbaar met deze functie.
                  </p>
                  <Button asChild variant="outline">
                    <Link to={createPageUrl('Dashboard')}>
                      Terug naar Dashboard
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}