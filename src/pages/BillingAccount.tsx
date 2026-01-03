/**
 * Billing & Account Page Component
 * 
 * Allows users to:
 * - View current subscription status
 * - Upgrade/downgrade subscription
 * - Cancel subscription
 * - Update payment method
 * - View and download invoices
 * - View upcoming invoice
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { useUserSubscription, useAllSubscriptions } from "../hooks/useSubscriptionFeatures";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface Invoice {
  id: string;
  number: string;
  status: string;
  amount_paid: number;
  amount_due: number;
  currency: string;
  created: number;
  pdf: string;
  hosted_invoice_url: string;
}

interface UpcomingInvoice {
  amount_due: number;
  next_payment_attempt: number;
  period_start: number;
  period_end: number;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
  type?: string;
}

interface PaymentMethodType {
  id: string;
  name: string;
  description: string;
  icon: string;
  verificationSteps: string[];
  supportedCountries: string[];
  processingTime: string;
}

export default function BillingPage() {
  const { user } = useAuth();
  const { data: subscription, isLoading: subscriptionLoading } =
    useUserSubscription();
  const { data: allSubscriptions = [], isLoading: allSubscriptionsLoading } =
    useAllSubscriptions();
  const queryClient = useQueryClient();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [upcomingInvoice, setUpcomingInvoice] = useState<UpcomingInvoice | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<"overview" | "details" | "invoices" | "payment">(
    "overview"
  );

  // Public subscription plans (for upgrade/downgrade)
  const { data: plans = [] } = useQuery({
    queryKey: ["public-subscription-plans"],
    queryFn: async () => {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/subscription_plans?select=*&is_public=eq.true&order=position.asc`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to load plans (${response.status})`);
      }
      const data = await response.json();
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch payment methods from edge function
  const { data: paymentMethods = [], isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-methods`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to load payment methods");
      }

      const data = await response.json();
      return data.payment_methods || [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (user) {
      loadBillingData();
    }
  }, [user, subscription?.subscription_id]);

  async function loadBillingData() {
    try {
      // Load invoices
      const { data: customer } = await supabase
        .from("stripe.customers")
        .select("id")
        .eq("metadata->platform_user_id", user?.id)
        .single();

      if (customer) {
        const { data: invoicesData } = await supabase
          .from("stripe.invoices")
          .select("*")
          .eq("customer_id", customer.id)
          .order("created", { ascending: false });

        if (invoicesData) {
          setInvoices(invoicesData);
        }
      }

      // Load upcoming invoice if subscription is active
      if (subscription?.subscription_id) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/upcoming-invoice`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              }
            );

            if (response.ok) {
              const data = await response.json();
              setUpcomingInvoice(data);
            }
          }
        } catch (error) {
          console.error("Error loading upcoming invoice:", error);
        }
      }
    } catch (error) {
      console.error("Error loading billing data:", error);
    }
  }

  if (subscriptionLoading || paymentMethodsLoading) {
    return <div className="text-center py-12">Loading billing information...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">My Subscription</h1>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-8">
          <TabButton
            label="Overview"
            isActive={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
          />
          <TabButton
            label="Subscription Details"
            isActive={activeTab === "details"}
            onClick={() => setActiveTab("details")}
          />
          <TabButton
            label="Invoices"
            isActive={activeTab === "invoices"}
            onClick={() => setActiveTab("invoices")}
          />
          <TabButton
            label="Payment Method"
            isActive={activeTab === "payment"}
            onClick={() => setActiveTab("payment")}
          />
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <OverviewTab
            subscription={subscription}
            allSubscriptions={allSubscriptions}
            upcomingInvoice={upcomingInvoice}
            onRefresh={() => loadBillingData()}
            paymentMethods={paymentMethods}
            plans={plans}
          />
        )}

        {/* Subscription Details Tab */}
        {activeTab === "details" && (
          <SubscriptionDetailsTab subscription={subscription} upcomingInvoice={upcomingInvoice} />
        )}

        {/* Invoices Tab */}
        {activeTab === "invoices" && (
          <InvoicesTab invoices={invoices} />
        )}

        {/* Payment Method Tab */}
        {activeTab === "payment" && (
          <PaymentMethodTab
            paymentMethods={paymentMethods}
            subscriptionId={subscription?.subscription_id}
            onPaymentMethodUpdated={() => loadBillingData()}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Tab Button Component
 */
interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function TabButton({ label, isActive, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 font-medium text-sm transition-all ${
        isActive
          ? "text-blue-600 border-b-2 border-blue-600"
          : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Overview Tab Component
 */
interface OverviewTabProps {
  subscription: any;
  allSubscriptions: any[];
  upcomingInvoice: UpcomingInvoice | null;
  onRefresh: () => void;
  paymentMethods?: PaymentMethod[];
  plans?: any[];
}

function OverviewTab({ subscription, allSubscriptions, upcomingInvoice, onRefresh, paymentMethods = [], plans = [] }: OverviewTabProps) {
  const navigate = useNavigate();
  const [isCanceling, setIsCanceling] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptingSubscriptionId, setAcceptingSubscriptionId] = useState<string | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [pauseReason, setPauseReason] = useState("");
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  const currentPlan = plans.find((p) => p.name === subscription?.plan_name);
  const currentPriceCents = currentPlan?.monthly_price_cents ?? null;
  const handleSelectPlan = (plan: any) => {
    const priceId = billingPeriod === "monthly" ? plan.stripe_price_monthly_id : plan.stripe_price_yearly_id;
    if (!priceId) return;
    navigate(`/Checkout?price_id=${priceId}`);
  };

  const handleAcceptSubscription = async (pendingSubscription: any) => {
    // Check if user has any payment methods
    if (!paymentMethods || paymentMethods.length === 0) {
      alert("You need to add a payment method before accepting a subscription.");
      // Optionally navigate to payment method tab
      return;
    }

    // Set the subscription for accepting
    setAcceptingSubscriptionId(pendingSubscription.id);
    // Default to first payment method
    setSelectedPaymentMethodId(paymentMethods[0]?.id || null);
    // Show payment selector modal
    setShowPaymentSelector(true);
  };

  const handleConfirmAccept = async () => {
    if (!acceptingSubscriptionId || !selectedPaymentMethodId) {
      alert("Please select a payment method");
      return;
    }

    try {
      setIsAccepting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/accept-subscription`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            subscription_id: acceptingSubscriptionId,
            payment_method_id: selectedPaymentMethodId,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to accept subscription");
      }

      alert("Subscription accepted successfully! Your payment method is being charged.");
      setShowPaymentSelector(false);
      setAcceptingSubscriptionId(null);
      setSelectedPaymentMethodId(null);
      onRefresh();
      // Refresh all subscriptions
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription?.subscription_id) return;

    if (!confirm("Are you sure you want to cancel your subscription?")) {
      return;
    }

    try {
      setIsCanceling(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/cancel-subscription`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            subscription_id: subscription.subscription_id,
            cancel_immediately: false, // Cancel at period end
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel subscription");
      }

      alert("Subscription canceled. Access will end at the end of your billing period.");
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsCanceling(false);
    }
  };

  const handlePauseSubscription = async () => {
    if (!subscription?.subscription_id) return;

    try {
      setIsPausing(true);

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
          body: JSON.stringify({
            subscription_id: subscription.subscription_id,
            pause_reason: pauseReason || null,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to pause subscription");
      }

      alert("Subscription paused successfully. You can resume it anytime.");
      setShowPauseModal(false);
      setPauseReason("");
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsPausing(false);
    }
  };

  const handleResumeSubscription = async () => {
    if (!subscription?.subscription_id) return;

    try {
      setIsPausing(true);

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
          body: JSON.stringify({
            subscription_id: subscription.subscription_id,
            resume: true,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to resume subscription");
      }

      alert("Subscription resumed successfully.");
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsPausing(false);
    }
  };

  const renderPlansSection = () => {
    if (!plans || plans.length === 0) return null;

    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Abonnementen</h3>
            <p className="text-sm text-slate-600">Kies een plan om te upgraden of downgraden</p>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                billingPeriod === "monthly"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              Maandelijks
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                billingPeriod === "yearly"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              Jaarlijks
              <span className="ml-2 text-xs font-semibold text-green-600">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((plan) => {
            const isCurrent = plan.name === subscription?.plan_name;
            const cents = billingPeriod === "monthly" ? plan.monthly_price_cents : plan.yearly_price_cents;
            const priceId = billingPeriod === "monthly" ? plan.stripe_price_monthly_id : plan.stripe_price_yearly_id;
            const label = billingPeriod === "monthly" ? "/maand" : "/jaar";
            const isHigher = currentPriceCents !== null && cents > currentPriceCents;
            const isLower = currentPriceCents !== null && cents < currentPriceCents;
            const buttonLabel = isCurrent
              ? "Jouw huidige plan"
              : isHigher
                ? "Upgrade"
                : isLower
                  ? "Downgrade"
                  : "Selecteer";

            return (
              <div key={plan.id} className={`rounded-lg border ${isCurrent ? "border-blue-500" : "border-slate-200"} bg-white shadow-sm p-6 flex flex-col gap-4`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-xl font-semibold text-slate-900">{plan.name}</h4>
                    <p className="text-sm text-slate-600">{plan.description}</p>
                  </div>
                  {isCurrent && (
                    <span className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">Jouw huidige plan</span>
                  )}
                </div>

                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-900">€{cents ? (cents / 100).toFixed(2) : "0.00"}</span>
                    <span className="text-slate-600">{label}</span>
                  </div>
                  {plan.trial_days > 0 && (
                    <p className="text-sm text-green-600 mt-1">{plan.trial_days} dagen gratis proberen</p>
                  )}
                </div>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={!priceId || isCurrent}
                  className={`w-full rounded-lg px-4 py-3 font-semibold transition-all ${
                    isCurrent
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {buttonLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!subscription?.is_active) {
    // Check if user has pending subscriptions
    const pendingSubscriptions = allSubscriptions.filter(
      (sub) => sub.status === "pending_acceptance"
    );

    if (pendingSubscriptions.length > 0) {
      return (
        <div className="space-y-6">
          {/* Pending Subscriptions */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-8">
            <h2 className="text-xl font-semibold text-blue-900 mb-6">
              Pending Subscriptions
            </h2>
            <div className="space-y-4">
              {pendingSubscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white rounded-lg border border-blue-200 p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-sm text-slate-600">Plan</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {sub.plan_name}
                      </p>
                    </div>
                    <span className="inline-block px-3 py-1 text-sm rounded-full bg-yellow-100 text-yellow-700">
                      Pending Acceptance
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Assigned on{" "}
                    {new Date(sub.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <button
                    onClick={() => handleAcceptSubscription(sub)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
                  >
                    Accept & Choose Payment Method
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            No Active Subscription
          </h2>
          <p className="text-slate-600 mb-6">
            You don't currently have an active subscription. Browse our plans to get started.
          </p>
        </div>
        {renderPlansSection()}
      </div>
    );
  }

  const periodEndDate = new Date(subscription.period_end_date).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">
          Current Subscription
        </h2>

        <div className="grid grid-cols-2 gap-8 mb-6">
          <div>
            <p className="text-sm text-slate-600">Plan</p>
            <p className="text-lg font-semibold text-slate-900">
              {subscription.plan_name}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Status</p>
            <p className="text-lg font-semibold">
              <span className="inline-block px-3 py-1 text-sm rounded-full bg-green-100 text-green-700">
                {subscription.status.charAt(0).toUpperCase() +
                  subscription.status.slice(1)}
              </span>
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Billing Period</p>
            <p className="text-slate-900">
              Until {periodEndDate}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Subscription ID</p>
            <p className="text-sm font-mono text-slate-600">
              {subscription.subscription_id?.slice(0, 20)}...
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 flex-wrap">
          <a
            href="/pricing"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
          >
            Change Plan
          </a>
          {subscription.status === "active" && (
            <button
              onClick={() => setShowPauseModal(true)}
              disabled={isPausing}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-slate-300 transition-all"
            >
              {isPausing ? "Pausing..." : "Pause Subscription"}
            </button>
          )}
          {subscription.status === "paused" && (
            <button
              onClick={handleResumeSubscription}
              disabled={isPausing}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-slate-300 transition-all"
            >
              {isPausing ? "Resuming..." : "Resume Subscription"}
            </button>
          )}
          <button
            onClick={handleCancelSubscription}
            disabled={isCanceling}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-slate-300 transition-all"
          >
            {isCanceling ? "Canceling..." : "Cancel Subscription"}
          </button>
        </div>
      </div>

      {/* Upcoming Invoice */}
      {upcomingInvoice && (
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">
            Upcoming Invoice
          </h2>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-slate-600">Amount Due</p>
              <p className="text-2xl font-semibold text-slate-900">
                ${(upcomingInvoice.amount_due / 100).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Next Payment Date</p>
              <p className="text-lg text-slate-900">
                {new Date(
                  (upcomingInvoice.next_payment_attempt || Date.now()) * 1000
                ).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Available Plans */}
      {renderPlansSection()}

      {/* Payment Method Selector Modal for Subscription Acceptance */}
      {showPaymentSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h3 className="text-xl font-semibold text-slate-900 mb-6">
              Choose Payment Method
            </h3>
            
            <div className="mb-6 max-h-64 overflow-y-auto">
              {paymentMethods.map((method) => (
                <label key={method.id} className="flex items-center p-4 border border-slate-200 rounded-lg mb-3 cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="payment_method"
                    value={method.id}
                    checked={selectedPaymentMethodId === method.id}
                    onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="ml-3 flex-1">
                    <p className="font-medium text-slate-900">
                      {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} ending in {method.last4}
                    </p>
                    <p className="text-sm text-slate-500">
                      Expires {method.exp_month}/{method.exp_year}
                    </p>
                  </span>
                  {method.is_default && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      Default
                    </span>
                  )}
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentSelector(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-900 rounded-lg hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAccept}
                disabled={isAccepting || !selectedPaymentMethodId}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-slate-300 transition-all"
              >
                {isAccepting ? "Accepting..." : "Accept & Pay"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Subscription Modal */}
      {showPauseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">
              Pause Subscription
            </h3>
            <p className="text-slate-600 mb-6">
              Your subscription will be paused immediately. You can resume it anytime without losing your data or plan benefits.
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Reason for pause (optional)
              </label>
              <textarea
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="Tell us why you're pausing..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPauseModal(false);
                  setPauseReason("");
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-900 rounded-lg hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handlePauseSubscription}
                disabled={isPausing}
                className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-slate-300 transition-all"
              >
                {isPausing ? "Pausing..." : "Pause Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Subscription Details Tab Component
 */
interface SubscriptionDetailsTabProps {
  subscription: any;
  upcomingInvoice: UpcomingInvoice | null;
}

function SubscriptionDetailsTab({ subscription, upcomingInvoice }: SubscriptionDetailsTabProps) {
  if (!subscription) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Geen actief abonnement</h2>
        <p className="text-slate-600">Selecteer een plan om te starten.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-8 grid md:grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-slate-600">Plan</p>
          <p className="text-lg font-semibold text-slate-900">{subscription.plan_name}</p>
        </div>
        <div>
          <p className="text-sm text-slate-600">Status</p>
          <p className="text-lg font-semibold">
            <span className="inline-block px-3 py-1 text-sm rounded-full bg-green-100 text-green-700">
              {subscription.status}
            </span>
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-600">Startdatum</p>
          <p className="text-slate-900">
            {subscription.start_date
              ? new Date(subscription.start_date).toLocaleDateString()
              : "-"}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-600">Volgende facturering</p>
          <p className="text-slate-900">
            {subscription.period_end_date
              ? new Date(subscription.period_end_date).toLocaleDateString()
              : "-"}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-600">Subscription ID</p>
          <p className="text-sm font-mono text-slate-600">
            {subscription.subscription_id?.slice(0, 24)}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-600">Klant</p>
          <p className="text-sm font-mono text-slate-600">
            {subscription.customer_id || "-"}
          </p>
        </div>
      </div>

      {upcomingInvoice && (
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Volgende factuur</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-600">Bedrag</p>
              <p className="text-2xl font-semibold text-slate-900">€{(upcomingInvoice.amount_due / 100).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Datum</p>
              <p className="text-slate-900">
                {new Date((upcomingInvoice.next_payment_attempt || Date.now()) * 1000).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Invoices Tab Component
 */
interface InvoicesTabProps {
  invoices: Invoice[];
}

function InvoicesTab({ invoices }: InvoicesTabProps) {
  if (invoices.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <p className="text-slate-600">No invoices yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
              Invoice
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
              Date
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
              Amount
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
              Status
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-slate-50">
              <td className="px-6 py-4 text-sm text-slate-900 font-mono">
                {invoice.number}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {new Date(invoice.created * 1000).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </td>
              <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                ${(invoice.amount_paid / 100).toFixed(2)}
              </td>
              <td className="px-6 py-4 text-sm">
                <span
                  className={`inline-block px-2 py-1 text-xs rounded-full ${
                    invoice.status === "paid"
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {invoice.status.charAt(0).toUpperCase() +
                    invoice.status.slice(1)}
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                {invoice.pdf && (
                  <a
                    href={invoice.pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 text-sm font-medium"
                  >
                    Download PDF
                  </a>
                )}
                {invoice.hosted_invoice_url && (
                  <>
                    {invoice.pdf && <span className="text-slate-300 mx-2">•</span>}
                    <a
                      href={invoice.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 text-sm font-medium"
                    >
                      View
                    </a>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Payment Method Tab Component
 */
interface PaymentMethodTabProps {
  paymentMethods: PaymentMethod[];
  subscriptionId: string | undefined;
  onPaymentMethodUpdated: () => void;
}

function PaymentMethodTab({
  paymentMethods,
  subscriptionId,
  onPaymentMethodUpdated,
}: PaymentMethodTabProps) {
  const queryClient = useQueryClient();
  const [showCardForm, setShowCardForm] = useState(false);
  const [showPaymentTypeSelector, setShowPaymentTypeSelector] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentMethodType | null>(null);
  const [cardholderName, setCardholderName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const stripeRef = React.useRef<any>(null);
  const cardElementRef = React.useRef<any>(null);
  const clientSecretRef = React.useRef<string | null>(null);

  // Available payment method types
  const availablePaymentMethods: PaymentMethodType[] = [
    {
      id: 'card',
      name: 'Credit or Debit Card',
      description: 'Visa, Mastercard, American Express',
      icon: '💳',
      verificationSteps: [
        'Enter your card details (number, expiry, CVC)',
        'Provide cardholder name matching the card',
        'Card will be verified with a small authorization (released immediately)',
        'Ready to use instantly after verification'
      ],
      supportedCountries: ['Worldwide'],
      processingTime: 'Instant'
    },
    {
      id: 'sepa_debit',
      name: 'SEPA Direct Debit',
      description: 'Bank account debit for EU customers',
      icon: '🏦',
      verificationSteps: [
        'Provide your IBAN (International Bank Account Number)',
        'Confirm account holder name',
        'Accept SEPA Direct Debit mandate',
        'Verification takes 1-3 business days',
        'First payment may be delayed until verification completes'
      ],
      supportedCountries: ['EU countries'],
      processingTime: '1-3 business days'
    },
    {
      id: 'ideal',
      name: 'iDEAL',
      description: 'Popular payment method in the Netherlands',
      icon: '🇳🇱',
      verificationSteps: [
        'Select your bank from the list',
        'You will be redirected to your bank\'s website',
        'Log in and authorize the payment',
        'Return to complete setup',
        'Ready to use immediately after authorization'
      ],
      supportedCountries: ['Netherlands'],
      processingTime: 'Instant'
    },
    {
      id: 'bancontact',
      name: 'Bancontact',
      description: 'Popular payment method in Belgium',
      icon: '🇧🇪',
      verificationSteps: [
        'You will be redirected to Bancontact',
        'Log in with your Bancontact credentials',
        'Authorize the payment setup',
        'Return to complete setup',
        'Ready to use immediately'
      ],
      supportedCountries: ['Belgium'],
      processingTime: 'Instant'
    },
    {
      id: 'us_bank_account',
      name: 'US Bank Account (ACH)',
      description: 'Direct debit from US bank account',
      icon: '🇺🇸',
      verificationSteps: [
        'Provide your bank account and routing number',
        'Confirm account holder name',
        'Verify ownership via micro-deposits (1-2 small deposits)',
        'Enter micro-deposit amounts to confirm',
        'Verification takes 1-3 business days'
      ],
      supportedCountries: ['United States'],
      processingTime: '1-3 business days'
    },
    {
      id: 'paypal',
      name: 'PayPal',
      description: 'Pay with your PayPal account',
      icon: '🅿️',
      verificationSteps: [
        'You will be redirected to PayPal',
        'Log in to your PayPal account',
        'Authorize recurring payments',
        'Return to complete setup',
        'Ready to use immediately'
      ],
      supportedCountries: ['Worldwide (varies by region)'],
      processingTime: 'Instant'
    }
  ];

  // Mutation for setting default payment method
  const setDefaultMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/set-default-payment-method`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            payment_method_id: paymentMethodId,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update payment method");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      alert("Default payment method updated successfully!");
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : "An error occurred");
    },
  });

  // Initialize Stripe and card element when form is shown
  React.useEffect(() => {
    if (!showCardForm) return;

    const initializeStripe = async () => {
      try {
        // Load Stripe.js if not already loaded
        if (!(window as any).Stripe) {
          const script = document.createElement("script");
          script.src = "https://js.stripe.com/v3/";
          script.async = true;
          script.onload = () => {
            setupCardElement();
          };
          document.body.appendChild(script);
        } else {
          setupCardElement();
        }
      } catch (err) {
        console.error('[CARD] Error loading Stripe:', err);
        setError("Failed to load payment form");
      }
    };

    const setupCardElement = async () => {
      try {
        // Create setup intent first
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        console.log('[CARD] Creating setup intent');
        const setupResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/create-setup-intent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!setupResponse.ok) {
          const data = await setupResponse.json();
          throw new Error(data.error || "Failed to create setup intent");
        }

        const setupData = await setupResponse.json();
        const { client_secret } = setupData;
        clientSecretRef.current = client_secret;

        console.log('[CARD] Setup intent created');

        // Initialize Stripe
        const Stripe = (window as any).Stripe;
        const stripe = Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");
        stripeRef.current = stripe;

        // Create elements
        const elements = stripe.elements({
          clientSecret: client_secret,
        });

        // Create card element
        const cardElement = elements.create("card", {
          hidePostalCode: true,
          style: {
            base: {
              fontSize: "16px",
              color: "#1f2937",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              "::placeholder": {
                color: "#9ca3af",
              },
            },
            invalid: {
              color: "#ef4444",
            },
          },
        });

        cardElementRef.current = cardElement;

        // Mount card element
        const cardContainer = document.getElementById("card-element");
        if (cardContainer) {
          cardElement.mount("#card-element");
          setStripeReady(true);
          console.log('[CARD] Card element mounted');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to initialize card form";
        setError(errorMessage);
        console.error('[CARD] Error:', err);
      }
    };

    initializeStripe();

    // Cleanup
    return () => {
      if (cardElementRef.current) {
        try {
          cardElementRef.current.unmount();
          cardElementRef.current = null;
        } catch (e) {
          console.warn('[CARD] Error unmounting card element:', e);
        }
      }
    };
  }, [showCardForm]);

  const handleAddPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!stripeRef.current || !cardElementRef.current || !clientSecretRef.current) {
        throw new Error("Payment form not initialized");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const stripe = stripeRef.current;
      const cardElement = cardElementRef.current;

      // Confirm the setup intent with the card element
      console.log('[CARD] Confirming setup intent');
      const confirmResult = await stripe.confirmCardSetup(clientSecretRef.current, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: cardholderName,
          },
        },
      });

      if (confirmResult.error) {
        throw new Error(confirmResult.error.message);
      }

      console.log('[CARD] Setup intent confirmed');

      // Confirm with backend
      const confirmResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/confirm-setup-intent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            setup_intent_id: confirmResult.setupIntent.id,
          }),
        }
      );

      if (!confirmResponse.ok) {
        const data = await confirmResponse.json();
        throw new Error(data.error || "Failed to confirm payment method");
      }

      console.log('[CARD] Payment method added successfully');

      // Reset form and refresh
      setShowCardForm(false);
      setCardholderName("");
      setError(null);
      
      // Refresh payment methods
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      onPaymentMethodUpdated();
      
      alert("Payment method added successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to add payment method";
      setError(errorMessage);
      console.error('[CARD] Error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (paymentMethods.length === 0 && !showCardForm && !showPaymentTypeSelector) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <p className="text-slate-600 mb-4">No payment methods on file.</p>
        <button
          onClick={() => setShowPaymentTypeSelector(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
        >
          Add Payment Method
        </button>
      </div>
    );
  }

  // Show payment type selector
  if (showPaymentTypeSelector && !selectedPaymentType) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Select Payment Method Type
            </h2>
            <button
              onClick={() => setShowPaymentTypeSelector(false)}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {availablePaymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedPaymentType(method)}
                className="text-left p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{method.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">
                      {method.name}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {method.description}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <span>⏱️ {method.processingTime}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show verification steps for selected payment type
  if (selectedPaymentType && !showCardForm) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedPaymentType(null)}
                className="text-slate-600 hover:text-slate-900"
              >
                ← Back
              </button>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedPaymentType.icon}</span>
                <h2 className="text-lg font-semibold text-slate-900">
                  {selectedPaymentType.name}
                </h2>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Method Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">About This Payment Method</h3>
              <p className="text-sm text-blue-700 mb-3">{selectedPaymentType.description}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-900">Processing Time:</span>
                  <p className="text-blue-700">{selectedPaymentType.processingTime}</p>
                </div>
                <div>
                  <span className="font-medium text-blue-900">Supported Regions:</span>
                  <p className="text-blue-700">{selectedPaymentType.supportedCountries.join(', ')}</p>
                </div>
              </div>
            </div>

            {/* Verification Steps */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Verification Steps</h3>
              <ol className="space-y-3">
                {selectedPaymentType.verificationSteps.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </span>
                    <span className="text-slate-700 pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Action Button */}
            <div className="pt-4 border-t">
              <button
                onClick={() => {
                  if (selectedPaymentType.id === 'card') {
                    setShowCardForm(true);
                  } else {
                    alert(`${selectedPaymentType.name} setup will be implemented. For now, please use Credit/Debit Card.`);
                    setSelectedPaymentType(null);
                  }
                }}
                className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-medium"
              >
                Continue with {selectedPaymentType.name}
              </button>
              <p className="text-xs text-center text-slate-500 mt-3">
                By continuing, you agree to authorize recurring payments using this method
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showCardForm) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 max-w-md">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Add Payment Method</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleAddPaymentMethod} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Cardholder Name
            </label>
            <input
              type="text"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder="John Doe"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Card Details
            </label>
            <div 
              id="card-element" 
              className="px-4 py-3 border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-white"
            ></div>
            {!stripeReady && (
              <p className="text-xs text-slate-500 mt-2">Loading card form...</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowCardForm(false);
                setError(null);
                setCardholderName("");
              }}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-900 rounded-lg hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !cardholderName || !stripeReady}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? "Processing..." : "Add Card"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                Saved Payment Methods
              </h2>
              <p className="text-sm text-slate-600">
                Select a default payment method for your subscription.
              </p>
            </div>
            <button
              onClick={() => setShowPaymentTypeSelector(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-sm font-medium"
            >
              + Add Payment Method
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {paymentMethods.map((method) => (
            <div key={method.id} className="p-6 hover:bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {method.brand.toUpperCase()} •••• {method.last4}
                      </p>
                      {method.is_default && (
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      Expires {method.exp_month}/{method.exp_year}
                    </p>
                  </div>
                </div>
                {!method.is_default && (
                  <button
                    onClick={() => setDefaultMutation.mutate(method.id)}
                    disabled={setDefaultMutation.isPending}
                    className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {setDefaultMutation.isPending ? "Updating..." : "Set as Default"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => setShowCardForm(true)}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
      >
        Add Another Payment Method
      </button>
    </div>
  );
}
