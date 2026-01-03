import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import CheckoutForm from "@/components/CheckoutForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useValidateCoupon } from "@/hooks/useStripeElements";
import { ArrowLeft, Package, Gift, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

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
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const validateCouponMutation = useValidateCoupon();

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

  const handleValidateCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }

    try {
      setCouponError(null);
      setIsValidatingCoupon(true);
      const result = await validateCouponMutation.mutateAsync({
        code: couponCode,
        subscription_id: undefined,
        amount: undefined,
      });
      
      if (result.valid) {
        setAppliedCoupon({
          code: couponCode,
          discount: result.discount,
          type: result.type,
        });
        setCouponError(null);
      } else {
        setCouponError(result.message || "Invalid or expired coupon code");
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponError(err.message || "Failed to validate coupon");
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
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
          
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Left Column - Order Summary with Coupon & Date Info */}
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
                        <h3 className="font-semibold text-lg text-gray-900 mb-1">
                          {selectedPlan.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          {selectedPlan.description}
                        </p>
                        
                        {/* Billing Period Toggle */}
                        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                          <span className={`text-sm font-medium ${!isYearly ? 'text-gray-900' : 'text-gray-600'}`}>Monthly</span>
                          <button
                            onClick={() => {
                              const newPriceId = !isYearly 
                                ? selectedPlan.stripe_price_yearly_id 
                                : selectedPlan.stripe_price_monthly_id;
                              if (newPriceId) {
                                setSelectedPriceId(newPriceId);
                              }
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              isYearly ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                isYearly ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <span className={`text-sm font-medium ${isYearly ? 'text-gray-900' : 'text-gray-600'}`}>Yearly</span>
                          {isYearly && <span className="text-xs font-semibold text-green-600 ml-auto">Save 20%</span>}
                        </div>

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

                      {selectedPlan.features && selectedPlan.features.length > 0 && (
                        <div className="border-t pt-4">
                          <h4 className="font-semibold text-sm text-gray-900 mb-3">What's Included</h4>
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
                        </div>
                      )}

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

                      {/* Start & End Date Info */}
                      <div className="border-t pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Start Date:</span>
                          <span className="font-semibold text-gray-900">
                            {new Date().toLocaleDateString('nl-NL', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Next Billing:</span>
                          <span className="font-semibold text-gray-900">
                            {(() => {
                              const startDate = new Date();
                              const trialDays = selectedPlan.trial_days || 0;
                              const nextBilling = new Date(startDate);
                              nextBilling.setDate(nextBilling.getDate() + trialDays);
                              if (!isYearly) {
                                nextBilling.setMonth(nextBilling.getMonth() + 1);
                              } else {
                                nextBilling.setFullYear(nextBilling.getFullYear() + 1);
                              }
                              return nextBilling.toLocaleDateString('nl-NL', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              });
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* Coupon Section in Summary */}
                      <div className="border-t pt-4">
                        <h3 className="font-semibold text-sm text-gray-900 mb-3 flex items-center gap-2">
                          <Gift className="h-4 w-4" />
                          Have a coupon?
                        </h3>
                        
                        {appliedCoupon ? (
                          <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 border border-green-200">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-green-900 text-xs">
                                  {appliedCoupon.code}
                                </p>
                                <p className="text-xs text-green-700 mt-0.5">
                                  {appliedCoupon.type === 'percentage' 
                                    ? `${appliedCoupon.discount}% off` 
                                    : `€${(appliedCoupon.discount / 100).toFixed(2)} off`}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={handleRemoveCoupon}
                              className="text-xs font-medium text-green-600 hover:text-green-700"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <form onSubmit={handleValidateCoupon} className="flex gap-2">
                            <Input
                              type="text"
                              placeholder="Code"
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                              disabled={isValidatingCoupon}
                              className="flex-1 text-sm"
                            />
                            <Button
                              type="submit"
                              disabled={isValidatingCoupon || !couponCode.trim()}
                              size="sm"
                              className="whitespace-nowrap"
                            >
                              {isValidatingCoupon && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                              {isValidatingCoupon ? "..." : "Add"}
                            </Button>
                          </form>
                        )}
                        
                        {couponError && (
                          <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2">
                            <AlertCircle className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-red-600">{couponError}</p>
                          </div>
                        )}
                      </div>

                      {/* Pricing Summary */}
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

            {/* Right Column - Payment Form Only */}
            <div className="lg:col-span-1">
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
                    couponCode={appliedCoupon?.code || null}
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
              <span className="ml-2 inline-block rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                Save 20%
              </span>
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50 text-center mb-8">
            <CardContent className="pt-6">
              <p className="mb-4 text-red-700">{error}</p>
              <Button
                onClick={() => loadPlans()}
                variant="default"
              >
                Try Again
              </Button>
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
                      const priceCents = isMonthly 
                        ? plan.monthly_price_cents 
                        : plan.yearly_price_cents;

                      return (
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold text-gray-900">
                              €{(priceCents / 100).toFixed(2)}
                            </span>
                            <span className="text-gray-600">
                              {isMonthly ? "/month" : "/year"}
                            </span>
                          </div>
                          {plan.trial_days > 0 && (
                            <p className="text-sm text-green-600 font-semibold mt-2">
                              {plan.trial_days} days free trial
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="mb-6 border-t border-b py-6 space-y-3 flex-1">
                    <h4 className="font-semibold text-gray-900">What's Included</h4>
                    {plan.features && plan.features.length > 0 ? (
                      <ul className="space-y-2">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-600">See plan details below</p>
                    )}
                  </div>

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
