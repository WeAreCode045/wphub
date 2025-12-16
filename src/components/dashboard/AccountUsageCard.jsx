import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UsageDisplay from "../subscription/UsageDisplay";
import { 
  Crown, 
  Calendar, 
  DollarSign, 
  ArrowRight, 
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function AccountUsageCard({ userId }) {
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['current-subscription', userId],
    queryFn: async () => {
      if (!userId) return null;
      const subs = await base44.entities.UserSubscription.filter({
        user_id: userId,
        status: ['active', 'trialing']
      }, "-created_date", 1);
      return subs.length > 0 ? subs[0] : null;
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: plan } = useQuery({
    queryKey: ['subscription-plan', subscription?.plan_id],
    queryFn: async () => {
      if (!subscription?.plan_id) return null;
      return base44.entities.SubscriptionPlan.get(subscription.plan_id);
    },
    enabled: !!subscription?.plan_id,
    staleTime: 0,
  });

  const formatPrice = (amount, currency = "EUR") => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currency
    }).format(amount / 100);
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: { bg: "bg-white/20", text: "text-white", label: "Actief", icon: CheckCircle },
      trialing: { bg: "bg-white/20", text: "text-white", label: "Proefperiode", icon: Calendar },
      past_due: { bg: "bg-amber-100/20", text: "text-white", label: "Achterstallig", icon: AlertCircle },
      canceled: { bg: "bg-red-100/20", text: "text-white", label: "Geannuleerd", icon: XCircle }
    };
    const style = styles[status] || styles.active;
    const Icon = style.icon;
    return (
      <Badge className={`${style.bg} ${style.text} border-white/30 text-xs`}>
        <Icon className="w-3 h-3 mr-1" />
        {style.label}
      </Badge>
    );
  };

  if (!userId) return null;

  return (
    <Card className="border-none shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600">
      <CardContent className="p-5">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Subscription Section */}
          <div>
            <h3 className="text-xs font-semibold text-white/80 mb-3 uppercase tracking-wider">
              Huidige Abonnement
            </h3>

            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              </div>
            ) : !subscription ? (
              <div className="text-center py-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold text-sm text-white mb-1">Gratis Plan</h4>
                <p className="text-xs text-white/70 mb-3">Upgrade voor meer mogelijkheden</p>
                <Button asChild size="sm" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border-white/30 h-8 text-xs">
                  <Link to={createPageUrl("Pricing")}>
                    Bekijk Plannen
                    <ArrowRight className="w-3 h-3 ml-1.5" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-base text-white mb-1">
                      {plan?.name || "Plan wordt geladen..."}
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getStatusBadge(subscription.status)}
                      {subscription.is_manual && (
                        <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 text-xs">
                          Handmatig
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {plan?.description && (
                  <p className="text-xs text-white/80 line-clamp-2">{plan.description}</p>
                )}

                <div className="space-y-2 pt-2">
                  <div className="p-2.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                    <div className="flex items-center gap-1.5 text-xs text-white/70 mb-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Prijs</span>
                    </div>
                    <span className="font-semibold text-sm text-white">
                      {subscription.amount ? formatPrice(subscription.amount, subscription.currency) : "€0,00"}
                      <span className="text-xs text-white/70 ml-1">
                        /{subscription.interval === "year" ? "jaar" : "maand"}
                      </span>
                    </span>
                  </div>

                  {subscription.current_period_end && (
                    <div className="p-2.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                      <div className="flex items-center gap-1.5 text-xs text-white/70 mb-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Verlengt op</span>
                      </div>
                      <span className="font-semibold text-sm text-white">
                        {format(new Date(subscription.current_period_end), "d MMM yyyy", { locale: nl })}
                      </span>
                    </div>
                  )}
                </div>

                {subscription.cancel_at_period_end && (
                  <div className="p-2 bg-amber-100/20 backdrop-blur-sm border border-amber-200/30 rounded-lg">
                    <p className="text-xs text-white font-medium">
                      ⚠️ Wordt geannuleerd aan het einde van de periode
                    </p>
                  </div>
                )}

                <Button asChild size="sm" variant="outline" className="w-full mt-3 h-8 text-xs bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border-white/30">
                  <Link to={createPageUrl("MySubscription")}>
                    Beheer Abonnement
                    <ArrowRight className="w-3 h-3 ml-1.5" />
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Usage Section */}
          <div>
            <h3 className="text-xs font-semibold text-white/80 mb-4 uppercase tracking-wider">
              Gebruik
            </h3>
            <div className="space-y-3">
              <UsageDisplay userId={userId} featureType="plugins" showLabel whiteTheme />
              <UsageDisplay userId={userId} featureType="sites" showLabel whiteTheme />
              <UsageDisplay userId={userId} featureType="teams" showLabel whiteTheme />
              <UsageDisplay userId={userId} featureType="projects" showLabel whiteTheme />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}