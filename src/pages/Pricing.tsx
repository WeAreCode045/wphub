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
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useUserSubscription } from "@/hooks/useSubscriptionFeatures";

/**
 * Main Pricing Page Component
 */
export default function PricingPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [isLoading, setIsLoading] = useState(true);

  const { data: userSubscription } = useUserSubscription();

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setIsLoading(true);

      // Fetch plans with all data from subscription_plans table
      const { data: plansData, error: plansError } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_public", true)
        .order("position", { ascending: true });

      if (plansError) throw plansError;
      setPlans(plansData || []);
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
            Eenvoudige, Transparante Prijzen
          </h1>
          <p className="text-xl text-slate-600 mb-8">
            Kies het perfecte plan voor jouw behoeften
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
              Maandelijks
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-6 py-2 rounded-md transition-all ${
                billingPeriod === "yearly"
                  ? "bg-blue-500 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Jaarlijks
              <span className="ml-2 text-xs font-semibold text-green-600">
                Bespaar 20%
              </span>
            </button>
          </div>
        </div>

        {/* User's Current Plan Badge */}
        {userSubscription?.is_active && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-900">
              ✓ Je hebt momenteel het <strong>{userSubscription.plan_name}</strong> abonnement
            </p>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const isCurrentPlan =
              userSubscription?.is_active &&
              userSubscription.plan_name === plan.name;

            return (
              <PricingCard
                key={plan.id}
                plan={plan}
                billingPeriod={billingPeriod}
                isCurrentPlan={isCurrentPlan}
                onSelectPlan={() => {
                  // Navigate to checkout with selected plan
                  navigate('/Checkout');
                }}
              />
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">
            Veelgestelde Vragen
          </h2>
          <div className="space-y-4">
            <FAQItem
              question="Kan ik mijn plan op elk moment wijzigen?"
              answer="Ja! Je kunt je plan op elk moment upgraden of downgraden. Wijzigingen gaan in bij de volgende factuurcyclus."
            />
            <FAQItem
              question="Welke betaalmethoden accepteren jullie?"
              answer="We accepteren alle grote creditcards (Visa, Mastercard, American Express) via Stripe."
            />
            <FAQItem
              question="Is er een gratis proefperiode?"
              answer="De meeste plannen hebben een gratis proefperiode van 14 dagen, zodat je alle functies kunt testen voordat je betaalt."
            />
            <FAQItem
              question="Bieden jullie terugbetalingen aan?"
              answer="We bieden een 30 dagen niet-goed-geld-terug-garantie als je niet tevreden bent met onze dienst."
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
  plan: any;
  billingPeriod: "monthly" | "yearly";
  isCurrentPlan: boolean;
  onSelectPlan: () => void;
}

function PricingCard({
  plan,
  billingPeriod,
  isCurrentPlan,
  onSelectPlan,
}: PricingCardProps) {
  const priceInCents = billingPeriod === "monthly" 
    ? plan.monthly_price_cents 
    : plan.yearly_price_cents;
  
  const displayPrice = priceInCents
    ? (priceInCents / 100).toFixed(2)
    : "TBD";

  const periodLabel =
    billingPeriod === "monthly"
      ? "maand"
      : "jaar";

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
            Huidig Plan
          </div>
        )}

        <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
        <p className="text-slate-600 text-sm mb-6">{plan.description}</p>

        {/* Price */}
        <div className="mb-6">
          <div className="flex items-baseline">
            <span className="text-4xl font-bold text-slate-900">
              €{displayPrice}
            </span>
            <span className="text-slate-600 ml-2">/{periodLabel}</span>
          </div>
          {plan.trial_days > 0 && (
            <p className="text-sm text-green-600 mt-2">
              {plan.trial_days} dagen gratis proberen
            </p>
          )}
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
          {isCurrentPlan ? "Je Huidige Plan" : "Selecteer Plan"}
        </button>

        {/* Features */}
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-900 text-sm">Kenmerken:</h4>
          <ul className="space-y-2 text-sm text-slate-700">
            <FeatureItem
              enabled={plan.stripe_product_id !== ""}
              label="Aan de slag"
            />
            <FeatureItem
              enabled={true}
              label="Prioriteitsondersteuning"
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


