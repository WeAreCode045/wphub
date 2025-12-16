import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Package, Globe, Users, Briefcase, Loader2 } from "lucide-react";
import { checkSubscriptionLimit } from "./LimitChecker";

export default function UsageDisplay({ userId, featureType, showLabel = false, whiteTheme = false }) {
  const [limitInfo, setLimitInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId || !featureType) return;

    async function fetchLimit() {
      setIsLoading(true);
      const result = await checkSubscriptionLimit(userId, featureType);
      setLimitInfo(result);
      setIsLoading(false);
    }

    fetchLimit();
  }, [userId, featureType]);

  const getFeatureIcon = () => {
    const icons = {
      plugins: Package,
      sites: Globe,
      teams: Users,
      projects: Briefcase
    };
    const Icon = icons[featureType] || Package;
    return <Icon className={`w-5 h-5 ${whiteTheme ? 'text-white' : 'text-indigo-600'}`} />;
  };

  const getFeatureLabel = () => {
    const labels = {
      plugins: 'Plugins',
      sites: 'Sites',
      teams: 'Teams',
      projects: 'Projecten'
    };
    return labels[featureType] || featureType;
  };

  const getStatusBadge = () => {
    if (!limitInfo.enabled) {
      return <Badge className={whiteTheme ? "bg-white/20 text-white text-xs" : "bg-red-100 text-red-700 text-xs"}>Niet beschikbaar</Badge>;
    }
    
    if (limitInfo.limit === -1) {
      return <Badge className={whiteTheme ? "bg-white/20 text-white text-xs" : "bg-green-100 text-green-700 text-xs"}>Onbeperkt</Badge>;
    }

    const percentage = (limitInfo.currentUsage / limitInfo.limit) * 100;
    
    if (limitInfo.currentUsage >= limitInfo.limit) {
      return <Badge className={whiteTheme ? "bg-red-100/20 text-white text-xs" : "bg-red-100 text-red-700 text-xs"}>Limiet bereikt</Badge>;
    } else if (percentage >= 80) {
      return <Badge className={whiteTheme ? "bg-amber-100/20 text-white text-xs" : "bg-amber-100 text-amber-700 text-xs"}>Bijna vol</Badge>;
    } else {
      return <Badge className={whiteTheme ? "bg-white/20 text-white text-xs" : "bg-green-100 text-green-700 text-xs"}>Beschikbaar</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 ${whiteTheme ? 'bg-white/10' : 'bg-indigo-100'} rounded-lg flex items-center justify-center`}>
          <Loader2 className={`w-5 h-5 animate-spin ${whiteTheme ? 'text-white' : 'text-indigo-600'}`} />
        </div>
        <div className="flex-1">
          {showLabel && <p className={`text-xs ${whiteTheme ? 'text-white/70' : 'text-gray-500'} mb-0.5`}>{getFeatureLabel()}</p>}
          <p className={`text-sm font-semibold ${whiteTheme ? 'text-white' : 'text-gray-900'}`}>Laden...</p>
        </div>
      </div>
    );
  }

  if (!limitInfo || !limitInfo.enabled) {
    return null;
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-9 h-9 ${whiteTheme ? 'bg-white/10 backdrop-blur-sm' : 'bg-indigo-100'} rounded-lg flex items-center justify-center`}>
        {getFeatureIcon()}
      </div>
      <div className="flex-1">
        {showLabel && <p className={`text-xs ${whiteTheme ? 'text-white/70' : 'text-gray-500'} mb-0.5`}>{getFeatureLabel()}</p>}
        <p className={`text-sm font-semibold ${whiteTheme ? 'text-white' : 'text-gray-900'}`}>
          {limitInfo.currentUsage} van {limitInfo.limit === -1 ? 'onbeperkt' : limitInfo.limit}
        </p>
        {limitInfo.limit !== -1 && getStatusBadge()}
      </div>
    </div>
  );
}