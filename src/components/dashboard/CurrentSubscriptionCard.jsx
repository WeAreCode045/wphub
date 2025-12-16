import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, Calendar, DollarSign, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function CurrentSubscriptionCard({ userId }) {
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
      active: { bg: "bg-green-100", text: "text-green-700", label: "Actief" },
      trialing: { bg: "bg-blue-100", text: "text-blue-700", label: "Proefperiode" },
      past_due: { bg: "bg-amber-100", text: "text-amber-700", label: "Achterstallig" },
      canceled: { bg: "bg-red-100", text: "text-red-700", label: "Geannuleerd" }
    };
    const style = styles[status] || styles.active;
    return <Badge className={`${style.bg} ${style.text} text-xs`}>{style.label}</Badge>;
  };

  if (isLoading) {
    return (
      <Card className="border-none shadow-md">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card className="border-none shadow-md">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">
            Huidige Abonnement
          </h3>
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Gratis Plan</h4>
            <p className="text-sm text-gray-600 mb-4">Upgrade voor meer mogelijkheden</p>
            <Button asChild size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
              <Link to={createPageUrl("Pricing")}>
                Bekijk Plannen
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-md">
      <CardContent className="p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">
          Huidige Abonnement
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-bold text-lg text-gray-900 mb-1">
                {plan?.name || "Plan wordt geladen..."}
              </h4>
              {getStatusBadge(subscription.status)}
            </div>
            {subscription.is_manual && (
              <Badge className="bg-purple-100 text-purple-700 text-xs">
                Handmatig
              </Badge>
            )}
          </div>

          {plan?.description && (
            <p className="text-sm text-gray-600">{plan.description}</p>
          )}

          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <DollarSign className="w-4 h-4" />
                <span>Prijs</span>
              </div>
              <span className="font-semibold text-gray-900">
                {subscription.amount ? formatPrice(subscription.amount, subscription.currency) : "€0,00"}
                <span className="text-sm text-gray-500 ml-1">
                  /{subscription.interval === "year" ? "jaar" : "maand"}
                </span>
              </span>
            </div>

            {subscription.current_period_end && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>Verlengt op</span>
                </div>
                <span className="font-semibold text-gray-900">
                  {format(new Date(subscription.current_period_end), "d MMMM yyyy", { locale: nl })}
                </span>
              </div>
            )}

            {subscription.cancel_at_period_end && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700 font-medium">
                  ⚠️ Je abonnement wordt geannuleerd aan het einde van de huidige periode
                </p>
              </div>
            )}
          </div>

          <Button asChild size="sm" variant="outline" className="w-full mt-4">
            <Link to={createPageUrl("MySubscription")}>
              Beheer Abonnement
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}