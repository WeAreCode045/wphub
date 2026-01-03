import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import CheckoutForm from "@/components/CheckoutForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package } from "lucide-react";

/**
 * Checkout Page
 * Displays available subscription plans and allows users to
 * select a plan and proceed to Stripe Checkout
 */
export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedPriceId, setSelectedPriceId] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPlans();
  }, []);

  // Pick up preselected price from querystring if provided
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const priceId = params.get("price_id");
    if (priceId) {
      setSelectedPriceId(priceId);
    }
  }, [location.search]);

  async function loadPlans() {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch public subscription plans
      const { data: plansData, error: plansError } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_public", true)
        .order("position", { ascending: true });

      if (plansError) throw plansError;
      setSubscriptions(plansData || []);
    } catch (err) {
      console.error("Error loading plans:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSelectPlan = (priceId) => {
    setSelectedPriceId(priceId);
  };

  const handleCancel = () => {
    setSelectedPriceId(null);
    navigate("/BillingAccount");
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
    // Find the selected plan details
    const selectedPlan = subscriptions.find(plan => 
      plan.stripe_price_monthly_id === selectedPriceId || 
      plan.stripe_price_yearly_id === selectedPriceId
    );
    const isYearly = selectedPlan?.stripe_price_yearly_id === selectedPriceId;

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
        <div className="mx-auto max-w-6xl">
          <Button 
            variant="ghost" 
            onClick={() => setSelectedPriceId(null)}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Plans
          </Button>
          
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left Column - Plan Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {selectedPlan && (
                    <>
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900 mb-2">
                          {selectedPlan.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          {selectedPlan.description}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-gray-900">
                            €{isYearly 
                              ? (selectedPlan.yearly_price_cents / 100).toFixed(2) 
                              : (selectedPlan.monthly_price_cents / 100).toFixed(2)}
                          </span>
                          <span className="text-gray-600">
                            {isYearly ? "/year" : "/month"}
                          </span>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-sm text-gray-900 mb-3">What's Included</h4>
                        {selectedPlan.features && selectedPlan.features.length > 0 ? (
                          <ul className="space-y-2">
                            {selectedPlan.features.map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                {feature}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-600">See plan details above</p>
                        )}
                      </div>

                      {selectedPlan.trial_days > 0 && (
                        <div className="rounded-lg bg-green-50 p-4 border border-green-200">
                          <p className="text-sm font-semibold text-green-900">
                            ✓ {selectedPlan.trial_days} days free trial
                          </p>
                          <p className="text-xs text-green-700 mt-1">
                            No payment required during trial period
                          </p>
                        </div>
                      )}

                      <div className="border-t pt-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="font-semibold text-gray-900">
                            €{isYearly 
                              ? (selectedPlan.yearly_price_cents / 100).toFixed(2) 
                              : (selectedPlan.monthly_price_cents / 100).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-lg font-bold pt-2 border-t">
                          <span>Total:</span>
                          <span className="text-blue-600">
                            €{isYearly 
                              ? (selectedPlan.yearly_price_cents / 100).toFixed(2) 
                              : (selectedPlan.monthly_price_cents / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Checkout Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Complete Your Purchase</CardTitle>
                </CardHeader>
                <CardContent>
                  <CheckoutForm
                    priceId={selectedPriceId}
                    quantity={1}
                    selectedPlan={selectedPlan}
                    billingPeriod={isYearly ? "yearly" : "monthly"}
                    onCancel={() => setSelectedPriceId(null)}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show available plans for selection
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Choose Your Plan
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Select a subscription plan to get started
          </p>
          
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <Button
              onClick={() => setBillingPeriod("monthly")}
              variant={billingPeriod === "monthly" ? "default" : "ghost"}
              className="rounded-md"
            >
              Monthly
            </Button>
            <Button
              onClick={() => setBillingPeriod("yearly")}
              variant={billingPeriod === "yearly" ? "default" : "ghost"}
              className="rounded-md"
            >
              Yearly
              <span className="ml-2 text-xs font-semibold text-green-600">Save 20%</span>
            </Button>
          </div>
        </div>

        {error && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {subscriptions.length === 0 ? (
          <Card className="border-yellow-200 bg-yellow-50 text-center">
            <CardContent className="pt-6">
              <p className="mb-4 text-yellow-700">
                No subscription plans available at the moment.
              </p>
              <Button
                onClick={() => navigate("/BillingAccount")}
                variant="default"
              >
                Back to Billing
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {subscriptions.map((plan) => (
              <Card key={plan.id} className="flex flex-col hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <p className="text-sm text-gray-600 mt-2">
                    {plan.description}
                  </p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="mb-6">
                    {(() => {
                      const isMonthly = billingPeriod === "monthly";
                      const priceId = isMonthly
                        ? plan.stripe_price_monthly_id
                        : plan.stripe_price_yearly_id;
                      const cents = isMonthly
                        ? plan.monthly_price_cents
                        : plan.yearly_price_cents;
                      const label = isMonthly ? "/maand" : "/jaar";

                      if (!priceId && !cents) {
                        return <p className="text-sm text-gray-500">Price not available</p>;
                      }

                      return (
                        <>
                          <div className="flex items-baseline">
                            <span className="text-5xl font-bold text-gray-900">
                              €{cents ? (cents / 100).toFixed(2) : "0.00"}
                            </span>
                            <span className="ml-2 text-gray-600">{label}</span>
                          </div>
                          {plan.trial_days > 0 && (
                            <p className="text-sm text-green-600 mt-2">
                              {plan.trial_days} dagen gratis proberen
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {plan.features && plan.features.length > 0 && (
                    <ul className="mb-6 space-y-2 flex-1">
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

                  {(() => {
                    const priceId = billingPeriod === "monthly"
                      ? plan.stripe_price_monthly_id
                      : plan.stripe_price_yearly_id;
                    return (
                      <Button
                        onClick={() => handleSelectPlan(priceId)}
                        className="w-full"
                        disabled={!priceId}
                      >
                        {billingPeriod === "monthly" ? "Select Monthly" : "Select Yearly"}
                      </Button>
                    );
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <Button
            onClick={() => navigate("/BillingAccount")}
            variant="ghost"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Billing
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Checkout Page
 * Displays available subscription plans and allows users to
 * select a plan and proceed to Stripe Checkout
 */
export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedPriceId, setSelectedPriceId] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPlans();
  }, []);

  // Pick up preselected price from querystring if provided
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const priceId = params.get("price_id");
    if (priceId) {
      setSelectedPriceId(priceId);
    }
  }, [location.search]);

  async function loadPlans() {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch public subscription plans
      const { data: plansData, error: plansError } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_public", true)
        .order("position", { ascending: true });

      if (plansError) throw plansError;
      setSubscriptions(plansData || []);
    } catch (err) {
      console.error("Error loading plans:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSelectPlan = (priceId) => {
    setSelectedPriceId(priceId);
  };

  const handleCancel = () => {
    setSelectedPriceId(null);
    navigate("/BillingAccount");
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
    // Find the selected plan details
    const selectedPlan = subscriptions.find(plan => 
      plan.stripe_price_monthly_id === selectedPriceId || 
      plan.stripe_price_yearly_id === selectedPriceId
    );
    const isYearly = selectedPlan?.stripe_price_yearly_id === selectedPriceId;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
        <div className="mx-auto max-w-6xl">
          <button
            onClick={() => setSelectedPriceId(null)}
            className="mb-6 text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            ← Back to Plans
          </button>
          
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left Column - Plan Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-12 rounded-lg bg-white p-8 shadow-lg">
                <h2 className="mb-6 text-2xl font-bold text-gray-900">Order Summary</h2>
                
                {selectedPlan && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="mb-2 text-lg font-semibold text-gray-900">
                        {selectedPlan.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        {selectedPlan.description}
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-gray-900">
                          €{isYearly 
                            ? (selectedPlan.yearly_price_cents / 100).toFixed(2) 
                            : (selectedPlan.monthly_price_cents / 100).toFixed(2)}
                        </span>
                        <span className="text-gray-600">
                          {isYearly ? "/year" : "/month"}
                        </span>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h4 className="mb-3 font-semibold text-gray-900">What's Included</h4>
                      {selectedPlan.features && selectedPlan.features.length > 0 ? (
                        <ul className="space-y-2">
                          {selectedPlan.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-600">See plan details above</p>
                      )}
                    </div>

                    {selectedPlan.trial_days > 0 && (
                      <div className="rounded-lg bg-green-50 p-4 border border-green-200">
                        <p className="text-sm font-semibold text-green-900">
                          ✓ {selectedPlan.trial_days} days free trial
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          No payment required during trial period
                        </p>
                      </div>
                    )}

                    <div className="border-t pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-semibold text-gray-900">
                          €{isYearly 
                            ? (selectedPlan.yearly_price_cents / 100).toFixed(2) 
                            : (selectedPlan.monthly_price_cents / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-blue-600">
                          €{isYearly 
                            ? (selectedPlan.yearly_price_cents / 100).toFixed(2) 
                            : (selectedPlan.monthly_price_cents / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Checkout Form */}
            <div className="lg:col-span-2">
              <div className="rounded-lg bg-white p-8 shadow-lg">
                <h1 className="mb-8 text-3xl font-bold text-gray-900">
                  Complete Your Purchase
                </h1>
                <CheckoutForm
                  priceId={selectedPriceId}
                  quantity={1}
                  selectedPlan={selectedPlan}
                  billingPeriod={isYearly ? "yearly" : "monthly"}
                  onCancel={() => setSelectedPriceId(null)}
                />
              </div>
            </div>
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
          <div className="mt-6 inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
                billingPeriod === "monthly"
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-700 hover:text-gray-900"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
                billingPeriod === "yearly"
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-700 hover:text-gray-900"
              }`}
            >
              Yearly
              <span className="ml-2 text-xs font-semibold text-green-600">Save 20%</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {subscriptions.length === 0 ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-8 text-center">
            <p className="mb-4 text-yellow-700">
              No subscription plans available at the moment.
            </p>
            <button
              onClick={() => navigate("/BillingAccount")}
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
                    {(() => {
                      const isMonthly = billingPeriod === "monthly";
                      const priceId = isMonthly
                        ? plan.stripe_price_monthly_id
                        : plan.stripe_price_yearly_id;
                      const cents = isMonthly
                        ? plan.monthly_price_cents
                        : plan.yearly_price_cents;
                      const label = isMonthly ? "/maand" : "/jaar";

                      if (!priceId && !cents) {
                        return <p className="text-sm text-gray-500">Price not available</p>;
                      }

                      return (
                        <>
                          <div className="mb-2 flex items-baseline">
                            <span className="text-4xl font-bold text-gray-900">
                              €{cents ? (cents / 100).toFixed(2) : "0.00"}
                            </span>
                            <span className="ml-2 text-gray-600">{label}</span>
                          </div>
                          {plan.trial_days > 0 && (
                            <p className="text-sm text-green-600">
                              {plan.trial_days} dagen gratis proberen
                            </p>
                          )}
                        </>
                      );
                    })()}
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
                  {(() => {
                    const priceId = billingPeriod === "monthly"
                      ? plan.stripe_price_monthly_id
                      : plan.stripe_price_yearly_id;
                    return (
                      <button
                        onClick={() => handleSelectPlan(priceId)}
                        className="w-full rounded bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                        disabled={!priceId}
                      >
                        {billingPeriod === "monthly" ? "Select Monthly" : "Select Yearly"}
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate("/BillingAccount")}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to Billing
          </button>
        </div>
      </div>
    </div>
  );
}
