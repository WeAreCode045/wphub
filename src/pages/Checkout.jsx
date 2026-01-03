import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAllSubscriptions } from "../hooks/useSubscriptionFeatures";
import CheckoutForm from "@/components/CheckoutForm";

/**
 * Checkout Page
 * Displays available subscription plans and allows users to
 * select a plan and proceed to Stripe Checkout
 */
export default function Checkout() {
  const navigate = useNavigate();
  const { data: subscriptions = [], isLoading } = useAllSubscriptions();
  const [selectedPriceId, setSelectedPriceId] = useState(null);

  const handleSelectPlan = (priceId) => {
    setSelectedPriceId(priceId);
  };

  const handleCancel = () => {
    setSelectedPriceId(null);
    navigate("/billing-account");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-300 border-t-blue-600 mx-auto"></div>
          <p className="text-gray-600">Loading available plans...</p>
        </div>
      </div>
    );
  }

  // If a plan is selected, show the checkout form
  if (selectedPriceId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => setSelectedPriceId(null)}
            className="mb-6 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to Plans
          </button>
          <div className="rounded-lg bg-white p-8 shadow-lg">
            <h1 className="mb-8 text-3xl font-bold text-gray-900">
              Complete Your Purchase
            </h1>
            <CheckoutForm
              priceId={selectedPriceId}
              quantity={1}
              onCancel={() => setSelectedPriceId(null)}
            />
          </div>
        </div>
      </div>
    );
  }

  // Show available plans for selection
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            Choose Your Plan
          </h1>
          <p className="text-lg text-gray-600">
            Select a subscription plan to get started
          </p>
        </div>

        {subscriptions.length === 0 ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-8 text-center">
            <p className="mb-4 text-yellow-700">
              No subscription plans available at the moment.
            </p>
            <button
              onClick={() => navigate("/billing-account")}
              className="rounded bg-yellow-600 px-6 py-2 font-semibold text-white hover:bg-yellow-700"
            >
              Back to Billing
            </button>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {subscriptions.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-col rounded-lg bg-white shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="flex-1 px-6 py-8">
                  <h3 className="mb-2 text-2xl font-bold text-gray-900">
                    {plan.name}
                  </h3>
                  <p className="mb-6 text-sm text-gray-600">
                    {plan.description}
                  </p>

                  <div className="mb-6">
                    <div className="mb-2 flex items-baseline">
                      <span className="text-4xl font-bold text-gray-900">
                        ${(plan.price / 100).toFixed(2)}
                      </span>
                      <span className="ml-2 text-gray-600">/month</span>
                    </div>
                    {plan.trial_days > 0 && (
                      <p className="text-sm text-green-600">
                        {plan.trial_days}-day free trial
                      </p>
                    )}
                  </div>

                  {plan.features && plan.features.length > 0 && (
                    <ul className="mb-6 space-y-2">
                      {plan.features.map((feature, idx) => (
                        <li
                          key={idx}
                          className="flex items-center text-sm text-gray-700"
                        >
                          <svg
                            className="mr-2 h-4 w-4 text-green-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t px-6 py-6">
                  <button
                    onClick={() => handleSelectPlan(plan.stripe_price_id)}
                    className="w-full rounded bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    Get Started
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate("/billing-account")}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to Billing
          </button>
        </div>
      </div>
    </div>
  );
}
