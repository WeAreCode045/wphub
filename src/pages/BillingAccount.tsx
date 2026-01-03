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
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { useUserSubscription, useAllSubscriptions } from "../hooks/useSubscriptionFeatures";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "payment">(
    "overview"
  );

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
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Billing & Account</h1>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-8">
          <TabButton
            label="Overview"
            isActive={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
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
          />
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
}

function OverviewTab({ subscription, allSubscriptions, upcomingInvoice, onRefresh, paymentMethods = [] }: OverviewTabProps) {
  const [isCanceling, setIsCanceling] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptingSubscriptionId, setAcceptingSubscriptionId] = useState<string | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);

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
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          No Active Subscription
        </h2>
        <p className="text-slate-600 mb-6">
          You don't currently have an active subscription. Browse our plans to get started.
        </p>
        <a
          href="/pricing"
          className="inline-block px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          View Plans
        </a>
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
        <div className="flex gap-4">
          <a
            href="/pricing"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
          >
            Change Plan
          </a>
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
  const [cardholderName, setCardholderName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const stripeRef = React.useRef<any>(null);
  const cardElementRef = React.useRef<any>(null);
  const clientSecretRef = React.useRef<string | null>(null);

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

  if (paymentMethods.length === 0 && !showCardForm) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <p className="text-slate-600 mb-4">No payment methods on file.</p>
        <button
          onClick={() => setShowCardForm(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
        >
          Add Payment Method
        </button>
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
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Saved Payment Methods
          </h2>
          <p className="text-sm text-slate-600">
            Select a payment method to use for your subscription.
          </p>
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
