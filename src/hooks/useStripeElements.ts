import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from '../api/supabaseClient';

/**
 * useSubscriptionPause Hook
 * Manage subscription pause/resume functionality
 */
export function useSubscriptionPause() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      pause_reason,
    }: {
      action: "pause" | "resume";
      pause_reason?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pause-subscription`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action, pause_reason }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to pause/resume subscription");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}

/**
 * useDeletePaymentMethod Hook
 * Delete a saved payment method
 */
export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment_method_id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-payment-method`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ payment_method_id }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete payment method");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
    },
  });
}

/**
 * useValidateCoupon Hook
 * Validate a coupon code
 */
export function useValidateCoupon() {
  return useMutation({
    mutationFn: async ({
      code,
      subscription_id,
      amount,
    }: {
      code: string;
      subscription_id?: string;
      amount?: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-coupon`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code, subscription_id, amount }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Invalid coupon code");
      }

      return response.json();
    },
  });
}

/**
 * useSubscriptionEvents Hook
 * Get subscription event history
 */
export function useSubscriptionEvents(subscriptionId?: string) {
  return useQuery({
    queryKey: ["subscription-events", subscriptionId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const query = supabase
        .from("public.subscription_events")
        .select("*")
        .order("created_at", { ascending: false });

      if (subscriptionId) {
        query.eq("subscription_id", subscriptionId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!subscriptionId,
  });
}

/**
 * usePaymentFailures Hook (Admin)
 * Get payment failure records
 */
export function usePaymentFailures(filters?: { status?: string; days?: number }) {
  return useQuery({
    queryKey: ["payment-failures", filters],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      let query = supabase
        .from("public.payment_failures")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query.eq("status", filters.status);
      }

      if (filters?.days) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - filters.days);
        query.gte("created_at", daysAgo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });
}

/**
 * useAdminManageDunning Hook (Admin)
 * Manage payment failures (retry, forgive, cancel)
 */
export function useAdminManageDunning() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      payment_failure_id,
      note,
    }: {
      action: "retry" | "forgive" | "cancel" | "notify";
      payment_failure_id: string;
      note?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-dunning`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action, payment_failure_id, note }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to manage dunning");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-failures"] });
    },
  });
}

/**
 * useAdminCreateCoupon Hook (Admin)
 * Create a new coupon code
 */
export function useAdminCreateCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (couponData: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-coupon`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(couponData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create coupon");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
    },
  });
}

/**
 * usePaymentFailureStats Hook (Admin)
 * Get payment failure statistics
 */
export function usePaymentFailureStats() {
  return useQuery({
    queryKey: ["payment-failure-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public.payment_failure_stats")
        .select("*")
        .order("date", { ascending: false })
        .limit(30);

      if (error) throw error;
      return data || [];
    },
  });
}

/**
 * useChurnAnalysis Hook (Admin)
 * Get subscription churn analysis
 */
export function useChurnAnalysis() {
  return useQuery({
    queryKey: ["churn-analysis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public.subscription_churn_analysis")
        .select("*")
        .order("month", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}
