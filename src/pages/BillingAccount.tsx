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
import { useUserSubscription } from "@/hooks/useSubscriptionFeatures";

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
  type: string;
  card?: {
    last4: string;
    brand: string;
    exp_month: number;
    exp_year: number;
  };
}

export default function BillingPage() {
  const { user } = useAuth();
  const { data: subscription, isLoading: subscriptionLoading } =
    useUserSubscription();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [upcomingInvoice, setUpcomingInvoice] = useState<UpcomingInvoice | null>(
    null
  );
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "payment">(
    "overview"
  );

  useEffect(() => {
    if (user) {
      loadBillingData();
    }
  }, [user, subscription?.subscription_id]);

  async function loadBillingData() {
    try {
      setIsLoading(true);

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

        // Load payment methods
        const { data: paymentMethodsData } = await supabase
          .from("stripe.payment_methods")
          .select("*")
          .eq("customer_id", customer.id)
          .order("created", { ascending: false });

        if (paymentMethodsData) {
          setPaymentMethods(paymentMethodsData);
        }
      }

      // Load upcoming invoice if subscription is active
      if (subscription?.subscription_id) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upcoming-invoice`,
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
    } finally {
      setIsLoading(false);
    }
  }

  if (subscriptionLoading || isLoading) {
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
            upcomingInvoice={upcomingInvoice}
            onRefresh={() => loadBillingData()}
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
  upcomingInvoice: UpcomingInvoice | null;
  onRefresh: () => void;
}

function OverviewTab({ subscription, upcomingInvoice, onRefresh }: OverviewTabProps) {
  const [isCanceling, setIsCanceling] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`,
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
  const [isAdding, setIsAdding] = useState(false);

  if (paymentMethods.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <p className="text-slate-600 mb-4">No payment methods on file.</p>
        <button
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Add Payment Method
        </button>
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
            These payment methods are saved with your Stripe account.
          </p>
        </div>

        <div className="divide-y divide-slate-200">
          {paymentMethods.map((method) => (
            <div key={method.id} className="p-6 hover:bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    {method.card?.brand.toUpperCase()} •••• {method.card?.last4}
                  </p>
                  <p className="text-sm text-slate-600">
                    Expires {method.card?.exp_month}/{method.card?.exp_year}
                  </p>
                </div>
                {subscriptionId && (
                  <button
                    onClick={() => handleSetDefault(method.id, subscriptionId)}
                    className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                  >
                    Set as Default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => setIsAdding(true)}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        Add Payment Method
      </button>
    </div>
  );
}

async function handleSetDefault(paymentMethodId: string, subscriptionId: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-payment-method`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subscription_id: subscriptionId,
          payment_method_id: paymentMethodId,
        }),
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to update payment method");
    }

    alert("Payment method updated successfully");
    window.location.reload();
  } catch (error) {
    alert(error instanceof Error ? error.message : "An error occurred");
  }
}
