import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Check if user can perform an action based on their subscription limits
 * @param {string} userId - User ID
 * @param {string} featureType - Type of feature to check: 'plugins', 'sites', 'teams', 'projects'
 * @returns {Promise<{allowed: boolean, enabled: boolean, message: string, currentUsage: number, limit: number, planName: string}>}
 */
export async function checkSubscriptionLimit(userId, featureType) {
  try {
    // Check if user is admin - admins have unlimited access
    let currentUser = null;
    try {
      currentUser = await base44.auth.me();
    } catch (error) {
      // User not authenticated or session expired, continue with subscription check
    }
    
    if (currentUser && currentUser.id === userId && currentUser.role === "admin") {
      const currentUsage = await getCurrentUsage(userId, featureType);
      return {
        allowed: true,
        enabled: true,
        message: `Onbeperkt (Admin)`,
        currentUsage,
        limit: -1,
        planName: "Admin"
      };
    }

    // Get user's active subscription
    const subscriptions = await base44.entities.UserSubscription.filter({
      user_id: userId,
      status: ['active', 'trialing']
    });

    // If no active subscription, apply free tier limits
    if (subscriptions.length === 0) {
      const freeLimits = {
        plugins: { enabled: true, limit: 3 },
        themes: { enabled: true, limit: 3 },
        sites: { enabled: true, limit: 2 },
        teams: { enabled: true, limit: 1 },
        projects: { enabled: true, limit: 3 }
      };
      
      const currentUsage = await getCurrentUsage(userId, featureType);
      const feature = freeLimits[featureType] || { enabled: false, limit: 0 };
      
      return {
        allowed: feature.enabled && currentUsage < feature.limit,
        enabled: feature.enabled,
        message: !feature.enabled
          ? `${getFeatureLabel(featureType)} is niet beschikbaar in het gratis plan`
          : currentUsage >= feature.limit 
            ? `Je hebt de gratis limiet bereikt (${feature.limit} ${getFeatureLabel(featureType)}). Upgrade naar een premium plan voor meer.`
            : `Je gebruikt ${currentUsage} van ${feature.limit} ${getFeatureLabel(featureType)} (gratis plan)`,
        currentUsage,
        limit: feature.limit,
        planName: "Gratis"
      };
    }

    const subscription = subscriptions[0];
    
    // Check if manual subscription has expired
    if (subscription.is_manual && subscription.manual_end_date) {
      const endDate = new Date(subscription.manual_end_date);
      if (endDate < new Date()) {
        return {
          allowed: false,
          enabled: false,
          message: "Je abonnement is verlopen. Neem contact op met de beheerder.",
          currentUsage: 0,
          limit: 0,
          planName: "Verlopen"
        };
      }
    }
    
    // Get the plan details
    const plan = await base44.entities.SubscriptionPlan.get(subscription.plan_id);
    
    if (!plan || !plan.features) {
      return {
        allowed: false,
        enabled: false,
        message: "Plan configuratie niet gevonden",
        currentUsage: 0,
        limit: 0,
        planName: plan?.name || "Onbekend"
      };
    }

    // Get feature configuration
    const feature = plan.features[featureType];
    if (!feature) {
      return {
        allowed: false,
        enabled: false,
        message: `${getFeatureLabel(featureType)} is niet geconfigureerd in je plan`,
        currentUsage: 0,
        limit: 0,
        planName: plan.name
      };
    }

    // Check if feature is enabled
    if (!feature.enabled) {
      return {
        allowed: false,
        enabled: false,
        message: `${getFeatureLabel(featureType)} is niet inbegrepen in je ${plan.name} plan`,
        currentUsage: 0,
        limit: 0,
        planName: plan.name
      };
    }

    // Get current usage
    const currentUsage = await getCurrentUsage(userId, featureType);
    
    // -1 means unlimited
    if (feature.limit === -1) {
      return {
        allowed: true,
        enabled: true,
        message: `Onbeperkt (${plan.name} plan)`,
        currentUsage,
        limit: -1,
        planName: plan.name
      };
    }
    
    const allowed = currentUsage < feature.limit;
    
    return {
      allowed,
      enabled: true,
      message: allowed 
        ? `Je gebruikt ${currentUsage} van ${feature.limit} ${getFeatureLabel(featureType)}`
        : `Je hebt de limiet bereikt (${feature.limit} ${getFeatureLabel(featureType)}). Upgrade je plan voor meer.`,
      currentUsage,
      limit: feature.limit,
      planName: plan.name
    };
    
  } catch (error) {
    console.error('Error checking subscription limit:', error);
    return {
      allowed: false,
      enabled: false,
      message: "Fout bij controleren van limieten",
      currentUsage: 0,
      limit: 0,
      planName: "Onbekend"
    };
  }
}

/**
 * Check if user can downgrade to a specific plan based on current usage
 * @param {string} userId - User ID
 * @param {object} targetPlan - The plan to check against
 * @returns {Promise<{allowed: boolean, violations: Array}>}
 */
export async function checkDowngradeEligibility(userId, targetPlan) {
  const violations = [];

  try {
    // Check each feature type
    const featureTypes = ['plugins', 'themes', 'sites', 'teams', 'projects'];
    
    for (const featureType of featureTypes) {
      const feature = targetPlan.features?.[featureType];
      
      if (feature === undefined) continue; // If feature is not explicitly defined in the plan, assume unlimited/no change from current if enabled

      const currentUsage = await getCurrentUsage(userId, featureType);

      // If feature is disabled in target plan and user has usage
      if (!feature.enabled && currentUsage > 0) {
        violations.push({
          feature: featureType,
          current: currentUsage,
          limit: 0,
          message: `Het nieuwe plan ondersteunt geen ${getFeatureLabel(featureType)}. Verwijder eerst al je ${getFeatureLabel(featureType)}.`
        });
      }
      // If feature is enabled but usage exceeds limit (and limit is not unlimited)
      else if (feature.enabled && feature.limit !== -1 && currentUsage > feature.limit) {
        violations.push({
          feature: featureType,
          current: currentUsage,
          limit: feature.limit,
          message: `Je hebt ${currentUsage} ${getFeatureLabel(featureType)}, maar het nieuwe plan staat maximaal ${feature.limit} toe.`
        });
      }
    }

    return {
      allowed: violations.length === 0,
      violations
    };
  } catch (error) {
    console.error('Error checking downgrade eligibility:', error);
    return {
      allowed: false,
      violations: [{
        feature: 'unknown',
        message: 'Fout bij controleren van downgrade mogelijkheid'
      }]
    };
  }
}

/**
 * Get plans that have a specific feature enabled
 * @param {string} featureType - Type of feature
 * @returns {Promise<Array>} Array of plans with the feature enabled
 */
export async function getPlansWithFeature(featureType) {
  try {
    const allPlans = await base44.entities.SubscriptionPlan.filter({ is_active: true });
    
    return allPlans.filter(plan => {
      const feature = plan.features?.[featureType];
      return feature && feature.enabled;
    }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  } catch (error) {
    console.error('Error getting plans with feature:', error);
    return [];
  }
}

/**
 * Get current usage count for a specific feature type
 */
async function getCurrentUsage(userId, featureType) {
  try {
    switch (featureType) {
      case 'plugins': {
        const plugins = await base44.entities.Plugin.filter({
          owner_type: "user",
          owner_id: userId
        });
        return plugins.length;
      }
      
      case 'themes': {
        const themes = await base44.entities.Theme.filter({
          owner_type: "user",
          owner_id: userId
        });
        return themes.length;
      }
      
      case 'sites': {
        const sites = await base44.entities.Site.filter({
          owner_type: "user",
          owner_id: userId
        });
        return sites.length;
      }
      
      case 'teams': {
        const teams = await base44.entities.Team.filter({
          owner_id: userId
        });
        return teams.length;
      }
      
      case 'projects': {
        // Projects are team-based, so count projects in teams the user owns
        const teams = await base44.entities.Team.filter({
          owner_id: userId
        });
        const teamIds = teams.map(t => t.id);
        
        const allProjects = await base44.entities.Project.list();
        return allProjects.filter(p => teamIds.includes(p.team_id)).length;
      }
      
      default:
        return 0;
    }
  } catch (error) {
    console.error('Error getting current usage:', error);
    return 0;
  }
}

/**
 * Get human-readable label for feature type
 */
function getFeatureLabel(featureType) {
  const labels = {
    plugins: 'plugins',
    themes: 'themes',
    sites: 'sites',
    teams: 'teams',
    projects: 'projecten'
  };
  return labels[featureType] || featureType;
}

/**
 * React hook for checking limits with loading state
 */
export function useSubscriptionLimit(userId, featureType) {
  const [limitCheck, setLimitCheck] = useState({
    allowed: true,
    enabled: true,
    message: "Laden...",
    currentUsage: 0,
    limit: 0,
    planName: "",
    isLoading: true
  });

  useEffect(() => {
    if (!userId || !featureType) return;
    
    checkSubscriptionLimit(userId, featureType).then((result) => {
      setLimitCheck({ ...result, isLoading: false });
    });
  }, [userId, featureType]);

  return limitCheck;
}