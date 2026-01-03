/**
 * Pricing Page Component
 * 
 * Displays all available subscription plans and handles subscription creation
 * Uses Stripe Elements for secure payment method collection
 * 
 * @typedef {Object} SubscriptionPlan
 * @property {number} id
 * @property {string} name
 * @property {string} description
 * @property {string} stripe_product_id
 * @property {string} stripe_price_monthly_id
 * @property {string} stripe_price_yearly_id
 * @property {number} position
 * 
 * @typedef {Object} Price
 * @property {string} id
 * @property {string} product_id
 * @property {number} unit_amount
 * @property {string} currency
 * @property {Object} recurring
 * @property {string} recurring.interval
 * @property {number} recurring.interval_count
 */

import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useUserSubscription } from "@/hooks/useSubscriptionFeatures";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLIC_KEY || ""
);

/**
 * Main Pricing Page Component
 */
export default function PricingPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [prices, setPrices] = useState<Map<string, Price>>(new Map());
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [isLoading, setIsLoading] = useState(true);

  const { data: userSubscription } = useUserSubscription();

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setIsLoading(true);

      // Fetch plans
      const { data: plansData, error: plansError } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_public", true)
        .order("position", { ascending: true });

      if (plansError) throw plansError;
      setPlans(plansData || []);

      // Collect all price IDs
      const priceIds = new Set<string>();
      plansData?.forEach((plan) => {
        priceIds.add(plan.stripe_price_monthly_id);
        priceIds.add(plan.stripe_price_yearly_id);
      });

      // Fetch prices from Stripe sync
      const { data: pricesData, error: pricesError } = await supabase
        .from("stripe.prices")
        .select("*")
        .in("id", Array.from(priceIds));

      if (pricesError) throw pricesError;

      // Create price map
      const priceMap = new Map<string, Price>();
      pricesData?.forEach((price) => {
        priceMap.set(price.id, price);
      });
      setPrices(priceMap);
    } catch (error) {
      console.error("Error loading plans:", error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading pricing plans...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-slate-600 mb-8">
            Choose the perfect plan for your needs
          </p>

          {/* Billing Period Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-6 py-2 rounded-md transition-all ${
                billingPeriod === "monthly"
                  ? "bg-blue-500 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-6 py-2 rounded-md transition-all ${
                billingPeriod === "yearly"
                  ? "bg-blue-500 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Yearly
              <span className="ml-2 text-xs font-semibold text-green-600">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* User's Current Plan Badge */}
        {userSubscription?.is_active && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-900">
              ✓ You're currently on the <strong>{userSubscription.plan_name}</strong> plan
            </p>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const priceId =
              billingPeriod === "monthly"
                ? plan.stripe_price_monthly_id
                : plan.stripe_price_yearly_id;
            const price = prices.get(priceId);

            const isCurrentPlan =
              userSubscription?.is_active &&
              userSubscription.plan_name === plan.name;

            return (
              <PricingCard
                key={plan.id}
                plan={plan}
                price={price}
                billingPeriod={billingPeriod}
                isCurrentPlan={isCurrentPlan}
                onSelectPlan={() => {
                  // Scroll to checkout
                  document.getElementById("checkout")?.scrollIntoView({
                    behavior: "smooth",
                  });
                  // Store selected plan for checkout
                  sessionStorage.setItem(
                    "selectedPriceId",
                    priceId
                  );
                }}
              />
            );
          })}
        </div>

        {/* Checkout Section */}
        <div id="checkout" className="mt-16">
          <Elements stripe={stripePromise}>
            <CheckoutForm />
          </Elements>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            <FAQItem
              question="Can I change my plan anytime?"
              answer="Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the next billing cycle."
            />
            <FAQItem
              question="What payment methods do you accept?"
              answer="We accept all major credit cards (Visa, Mastercard, American Express) via Stripe."
            />
            <FAQItem
              question="Is there a free trial?"
              answer="Most plans include a 14-day free trial so you can test all features before being charged."
            />
            <FAQItem
              question="Do you offer refunds?"
              answer="We offer a 30-day money-back guarantee if you're not satisfied with our service."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Pricing Card Component
 */
interface PricingCardProps {
  plan: SubscriptionPlan;
  price: Price | undefined;
  billingPeriod: "monthly" | "yearly";
  isCurrentPlan: boolean;
  onSelectPlan: () => void;
}

function PricingCard({
  plan,
  price,
  billingPeriod,
  isCurrentPlan,
  onSelectPlan,
}: PricingCardProps) {
  const displayPrice = price
    ? (price.unit_amount / 100).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
    : "TBD";

  const periodLabel =
    billingPeriod === "monthly"
      ? "month"
      : "year";

  return (
    <div
      className={`rounded-lg border transition-all ${
        isCurrentPlan
          ? "border-blue-500 bg-blue-50 shadow-lg"
          : "border-slate-200 bg-white hover:shadow-lg"
      }`}
    >
      <div className="p-8">
        {isCurrentPlan && (
          <div className="mb-4 inline-block px-3 py-1 text-sm font-semibold text-blue-600 bg-blue-100 rounded-full">
            Current Plan
          </div>
        )}

        <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
        <p className="text-slate-600 text-sm mb-6">{plan.description}</p>

        {/* Price */}
        <div className="mb-6">
          <div className="flex items-baseline">
            <span className="text-4xl font-bold text-slate-900">
              ${displayPrice}
            </span>
            <span className="text-slate-600 ml-2">/{periodLabel}</span>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={onSelectPlan}
          disabled={isCurrentPlan}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-all mb-6 ${
            isCurrentPlan
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          {isCurrentPlan ? "Your Current Plan" : "Select Plan"}
        </button>

        {/* Features */}
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-900 text-sm">Features:</h4>
          <ul className="space-y-2 text-sm text-slate-700">
            <FeatureItem
              enabled={plan.stripe_product_id !== ""}
              label="Get started"
            />
            <FeatureItem
              enabled={true}
              label={`Priority support`}
            />
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Feature Item Component
 */
interface FeatureItemProps {
  enabled: boolean;
  label: string;
}

function FeatureItem({ enabled, label }: FeatureItemProps) {
  return (
    <li className="flex items-center">
      <span
        className={`mr-3 inline-flex items-center justify-center h-5 w-5 rounded-full ${
          enabled ? "bg-green-100" : "bg-slate-100"
        }`}
      >
        {enabled ? (
          <svg
            className="h-3 w-3 text-green-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            className="h-3 w-3 text-slate-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </span>
      {label}
    </li>
  );
}

/**
 * FAQ Item Component
 */
interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 text-left font-semibold text-slate-900 hover:bg-slate-50 flex items-center justify-between"
      >
        {question}
        <svg
          className={`h-5 w-5 text-slate-500 transition-transform ${
            isOpen ? "transform rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="px-6 py-4 border-t border-slate-200 text-slate-600">
          {answer}
        </div>
      )}
    </div>
  );
}

/**
 * Checkout Form Component
 */
function CheckoutForm() {
  const { user } = useAuth();
  const stripe = useStripe();
  const elements = useElements();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !user) {
      return;
    }

    const selectedPriceId = sessionStorage.getItem("selectedPriceId");
    if (!selectedPriceId) {
      setError("Please select a plan");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Create payment method
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      const { error: pmError, paymentMethod } =
        await stripe.createPaymentMethod({
          type: "card",
          card: cardElement,
        });

      if (pmError) {
        throw new Error(pmError.message);
      }

      if (!paymentMethod) {
        throw new Error("Failed to create payment method");
      }

      // Get auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Call Edge Function to create subscription
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-subscription`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            price_id: selectedPriceId,
            payment_method_id: paymentMethod.id,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create subscription");
      }

      setSuccess(true);
      sessionStorage.removeItem("selectedPriceId");

      // Redirect to billing or dashboard
      setTimeout(() => {
        window.location.href = "/account/billing";
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Checkout error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <p className="text-slate-600">
          Please sign in to subscribe to a plan.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-8 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">
        Complete Your Subscription
      </h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          ✓ Subscription created successfully! Redirecting...
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-900 mb-2">
          Card Details
        </label>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#1e293b",
                "::placeholder": {
                  color: "#cbd5e1",
                },
              },
              invalid: {
                color: "#dc2626",
              },
            },
          }}
          className="border border-slate-200 rounded-lg p-3"
        />
      </div>

      <button
        type="submit"
        disabled={isProcessing || !stripe || success}
        className="w-full py-3 px-4 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
      >
        {isProcessing
          ? "Processing..."
          : success
            ? "Subscription Created"
            : "Subscribe Now"}
      </button>

      <p className="text-xs text-slate-600 text-center mt-4">
        Your payment is secure and encrypted.
      </p>
    </form>
  );
}
