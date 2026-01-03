/**
 * Feature Gating and Subscription Utilities
 * 
 * Provides reusable hooks and helpers for checking user feature access
 * based on their active Stripe subscription and plan metadata.
 * 
 * All feature checks are derived from stripe.products.metadata
 * which is the single source of truth.
 */

import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { supabase } from '../api/supabaseClient';

/**
 * Type definitions for subscription and features
 */
export interface UserSubscription {
  subscription_id: string;
  plan_name: string;
  status: "active" | "past_due" | "canceled" | "unpaid" | "trialing";
  period_end_date: string;
  plan_features: {
    limits_sites: number;
    feature_projects: boolean;
    feature_local_plugins: boolean;
    feature_local_themes: boolean;
    feature_team_invites: boolean;
  };
  is_active: boolean;
}

export interface PlanFeatures {
  limits_sites: number;
  feature_projects: boolean;
  feature_local_plugins: boolean;
  feature_local_themes: boolean;
  feature_team_invites: boolean;
}

/**
 * Hook: Get user's active subscription
 * 
 * Returns subscription data with plan features derived from Stripe metadata
 */
export function useUserSubscription() {
  return useQuery({
    queryKey: ["user-subscription"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_subscriptions")
        .select(
          `
          subscription_id,
          plan_name,
          status,
          period_end_date,
          plan_features,
          is_active
        `
        )
        .eq("user_id", user.id)
        .single();

      if (error) {
        // No subscription found is not an error state
        if (error.code === "PGRST116") {
          return null;
        }
        throw error;
      }

      return data as UserSubscription | null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

/**
 * Hook: Check if user can create sites
 * 
 * Derives from plan_features.limits_sites
 * Optionally checks current site count against limit
 */
export function useCanCreateSite(currentSiteCount: number = 0) {
  const { data: subscription } = useUserSubscription();

  return {
    can_create: Boolean(
      subscription?.is_active &&
        subscription.plan_features.limits_sites > currentSiteCount
    ),
    sites_limit: subscription?.plan_features.limits_sites || 0,
    sites_used: currentSiteCount,
    sites_remaining: subscription
      ? Math.max(
          0,
          subscription.plan_features.limits_sites - currentSiteCount
        )
      : 0,
  };
}

/**
 * Hook: Check if user can use projects feature
 */
export function useCanUseProjects() {
  const { data: subscription } = useUserSubscription();

  return {
    can_use: Boolean(subscription?.is_active && subscription.plan_features.feature_projects),
    has_access: subscription?.plan_features.feature_projects || false,
    subscription_required: !subscription?.is_active,
  };
}

/**
 * Hook: Check if user can upload local plugins
 */
export function useCanUploadLocalPlugins() {
  const { data: subscription } = useUserSubscription();

  return {
    can_upload: Boolean(
      subscription?.is_active && subscription.plan_features.feature_local_plugins
    ),
    has_access: subscription?.plan_features.feature_local_plugins || false,
    subscription_required: !subscription?.is_active,
  };
}

/**
 * Hook: Check if user can upload local themes
 */
export function useCanUploadLocalThemes() {
  const { data: subscription } = useUserSubscription();

  return {
    can_upload: Boolean(
      subscription?.is_active && subscription.plan_features.feature_local_themes
    ),
    has_access: subscription?.plan_features.feature_local_themes || false,
    subscription_required: !subscription?.is_active,
  };
}

/**
 * Hook: Check if user can invite team members
 */
export function useCanInviteTeamMembers() {
  const { data: subscription } = useUserSubscription();

  return {
    can_invite: Boolean(
      subscription?.is_active && subscription.plan_features.feature_team_invites
    ),
    has_access: subscription?.plan_features.feature_team_invites || false,
    subscription_required: !subscription?.is_active,
  };
}

/**
 * Hook: Get all user features summary
 */
export function useUserFeatures() {
  const { data: subscription, isLoading } = useUserSubscription();

  if (!subscription?.is_active) {
    return {
      isLoading,
      has_subscription: false,
      features: {
        can_create_sites: false,
        sites_limit: 0,
        can_use_projects: false,
        can_upload_local_plugins: false,
        can_upload_local_themes: false,
        can_invite_team_members: false,
      },
      subscription: null,
    };
  }

  return {
    isLoading,
    has_subscription: true,
    features: {
      can_create_sites: subscription.plan_features.limits_sites > 0,
      sites_limit: subscription.plan_features.limits_sites,
      can_use_projects: subscription.plan_features.feature_projects,
      can_upload_local_plugins: subscription.plan_features.feature_local_plugins,
      can_upload_local_themes: subscription.plan_features.feature_local_themes,
      can_invite_team_members: subscription.plan_features.feature_team_invites,
    },
    subscription,
  };
}

/**
 * Standalone function: Check feature access (for non-React code)
 * 
 * Usage in components/middleware:
 * const hasAccess = await checkFeatureAccess(userId, 'feature_projects')
 */
export async function checkFeatureAccess(
  userId: string,
  featureKey: keyof PlanFeatures
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc(
      "get_user_active_subscription",
      { user_id: userId }
    );

    if (error || !data?.[0]) {
      return false;
    }

    const planMetadata = data[0].plan_metadata as PlanFeatures | null;
    if (!planMetadata) {
      return false;
    }

    const value = planMetadata[featureKey];
    
    // For boolean features, return the value directly
    if (typeof value === "boolean") {
      return value;
    }

    // For numeric features (like limits_sites), return true if > 0
    if (typeof value === "number") {
      return value > 0;
    }

    return false;
  } catch (error) {
    console.error("Error checking feature access:", error);
    return false;
  }
}

/**
 * Standalone function: Get subscription status
 */
export async function getSubscriptionStatus(userId: string) {
  try {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select(
        `
        subscription_id,
        plan_name,
        status,
        period_end_date,
        plan_features,
        is_active
      `
      )
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // No subscription
      }
      throw error;
    }

    return data as UserSubscription | null;
  } catch (error) {
    console.error("Error getting subscription status:", error);
    return null;
  }
}

/**
 * Standalone function: Check if user can perform action
 * 
 * Returns detailed reason if access is denied
 */
export async function canUserPerformAction(
  userId: string,
  action: "create_site" | "use_projects" | "upload_local_plugins" | "upload_local_themes" | "invite_team_members"
): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const subscription = await getSubscriptionStatus(userId);

  if (!subscription) {
    return {
      allowed: false,
      reason: "No active subscription",
    };
  }

  if (!subscription.is_active) {
    return {
      allowed: false,
      reason: `Subscription is ${subscription.status}`,
    };
  }

  const featureMap: Record<string, keyof PlanFeatures> = {
    create_site: "limits_sites",
    use_projects: "feature_projects",
    upload_local_plugins: "feature_local_plugins",
    upload_local_themes: "feature_local_themes",
    invite_team_members: "feature_team_invites",
  };

  const featureKey = featureMap[action];
  const featureValue = subscription.plan_features[featureKey];

  if (typeof featureValue === "number" && featureValue > 0) {
    return { allowed: true };
  }

  if (typeof featureValue === "boolean" && featureValue) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Your ${subscription.plan_name} plan does not include ${action.replace(/_/g, " ")}`,
  };
}

/**
 * Component HOC: withFeatureGating
 * 
 * Wraps a component and checks feature access
 * Shows fallback if user doesn't have access
 */
export function withFeatureGating(
  Component: React.ComponentType<any>,
  featureKey: keyof PlanFeatures,
  fallback?: React.ReactNode
) {
  return function FeatureGatedComponent(props: any) {
    const { data: subscription, isLoading } = useUserSubscription();

    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!subscription?.is_active) {
      return fallback || <div>This feature requires an active subscription</div>;
    }

    const hasAccess = subscription.plan_features[featureKey];

    if (!hasAccess) {
      return (
        fallback || (
          <div>
            This feature is not available in your {subscription.plan_name} plan
          </div>
        )
      );
    }

    return <Component {...props} />;
  };
}

/**
 * Custom hook: useSubscriptionUpgrade
 * 
 * Helps track when a user should upgrade
 */
export function useSubscriptionUpgrade() {
  const { data: subscription } = useUserSubscription();

  return {
    current_plan: subscription?.plan_name || null,
    needs_upgrade: !subscription?.is_active,
    upgrade_url: "/pricing", // Link to pricing/upgrade page
    can_upgrade: subscription?.status !== "canceled",
  };
}
