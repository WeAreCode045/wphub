import React, { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { supabase } from "@/api/supabaseClient";
import { useValidateCoupon } from "@/hooks/useStripeElements";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Gift, Loader2 } from "lucide-react";

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

/**
 * CheckoutForm Component
 * 
 * Features:
 * - Stripe Embedded Checkout
 * - Coupon code validation and discount display
 * - Real-time discount calculation
 * - Plan details overview
 * 
 * @param {string} priceId - Stripe Price ID for the product
 * @param {number} quantity - Quantity of items (default: 1)
 * @param {Object} selectedPlan - Selected subscription plan details
 * @param {string} billingPeriod - "monthly" or "yearly"
 * @param {Object} metadata - Additional metadata to pass to Stripe
 * @param {Function} onSuccess - Callback when checkout session is created
 * @param {Function} onCancel - Callback when user cancels
 */
export default function CheckoutForm({
  priceId,
  quantity = 1,
  selectedPlan = null,
  billingPeriod = "monthly",
  metadata = {},
  onSuccess,
  onCancel,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [user, setUser] = useState(null);
  const validateCouponMutation = useValidateCoupon();

  useEffect(() => {
    async function loadUserData() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data, error } = await supabase
            .from('users')
            .select('billing_address, billing_city, billing_postal_code, billing_country, vat_number')
            .eq('id', authUser.id)
            .single();
          if (!error && data) {
            setUser(data);
          }
        }
      } catch (err) {
        console.error('Error loading user data:', err);
      }
    }
    loadUserData();
  }, []);

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

  useEffect(() => {
    let isMounted = true;
    let hasRetriedCustomer = false;

    const createStripeCustomer = async (accessToken) => {
      try {
        await supabase.functions.invoke('create-stripe-customer', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch (err) {
        console.error('Failed to create Stripe customer on retry:', err);
        throw err;
      }
    };

    const createCheckoutSession = async (accessToken) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            price_id: priceId,
            quantity,
            coupon_code: appliedCoupon?.code || null,
            billing_details: user ? {
              address: {
                line1: user.billing_address || undefined,
                city: user.billing_city || undefined,
                postal_code: user.billing_postal_code || undefined,
                country: user.billing_country || undefined,
              },
              tax_id: user.vat_number ? {
                type: 'eu_vat',
                value: user.vat_number,
              } : undefined,
            } : undefined,
            metadata: {
              ...metadata,
              plan_name: selectedPlan?.name,
              billing_period: billingPeriod,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create checkout session");
      }

      const payload = await response.json();
      const secret = payload.clientSecret;
      const sessionId = payload.sessionId;

      if (!secret) {
        throw new Error("Checkout session did not return a client secret.");
      }

      if (!isMounted) return;
      setClientSecret(secret);

      if (onSuccess && sessionId) {
        onSuccess(sessionId);
      }
    };

    async function loadClientSecret() {
      if (!priceId) {
        setError("Select a plan to continue to checkout.");
        return;
      }

      if (!stripePublicKey) {
        setError("Stripe public key is missing. Add VITE_STRIPE_PUBLIC_KEY to your environment.");
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Not authenticated");
        }
        try {
          await createCheckoutSession(session.access_token);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          const needsCustomer = message.toLowerCase().includes('stripe customer');

          if (needsCustomer && !hasRetriedCustomer) {
            hasRetriedCustomer = true;
            await createStripeCustomer(session.access_token);
            await createCheckoutSession(session.access_token);
          } else {
            throw err;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (!isMounted) return;
        setError(message);
        console.error("Checkout error:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadClientSecret();

    return () => {
      isMounted = false;
    };
  }, [priceId, quantity, metadata, onSuccess, appliedCoupon]);

  const options = clientSecret ? { clientSecret } : undefined;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="ml-2">
          <h3 className="font-semibold mb-2">Checkout Error</h3>
          <p className="text-sm">{error}</p>
          {onCancel && (
            <Button
              onClick={onCancel}
              variant="outline"
              className="mt-4"
            >
              Go Back
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Plan Details Overview */}
      {selectedPlan && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-blue-900 mb-4">Plan Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-700">Plan:</span>
                <span className="font-semibold text-slate-900">{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Billing Period:</span>
                <span className="font-semibold text-slate-900">
                  {billingPeriod === "monthly" ? "Monthly" : "Yearly"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Price:</span>
                <span className="text-xl font-bold text-slate-900">
                  €{billingPeriod === "monthly" 
                    ? (selectedPlan.monthly_price_cents / 100).toFixed(2)
                    : (selectedPlan.yearly_price_cents / 100).toFixed(2)}
                  <span className="text-sm font-normal text-slate-600">
                    /{billingPeriod === "monthly" ? "month" : "year"}
                  </span>
                </span>
              </div>
              {selectedPlan.trial_days > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-700">Trial Period:</span>
                  <span className="font-semibold text-green-700">
                    {selectedPlan.trial_days} days free
                  </span>
                </div>
              )}
              <div className="pt-3 border-t border-blue-300 mt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700">Start Date:</span>
                  <span className="font-semibold text-slate-900">
                    {new Date().toLocaleDateString('nl-NL', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-slate-700">Next Billing Date:</span>
                  <span className="font-semibold text-slate-900">
                    {(() => {
                      const startDate = new Date();
                      const trialDays = selectedPlan.trial_days || 0;
                      const nextBilling = new Date(startDate);
                      nextBilling.setDate(nextBilling.getDate() + trialDays);
                      if (billingPeriod === "monthly") {
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coupon Section */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Have a coupon?
          </h3>
          
          {appliedCoupon ? (
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-4 border border-green-200">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900">
                    Coupon applied: <span className="text-green-700">{appliedCoupon.code}</span>
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    Discount: {appliedCoupon.type === 'percentage' 
                      ? `${appliedCoupon.discount}%` 
                      : `€${(appliedCoupon.discount / 100).toFixed(2)}`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemoveCoupon}
                className="text-sm font-medium text-green-600 hover:text-green-700 underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <form onSubmit={handleValidateCoupon} className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                disabled={isValidatingCoupon}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={isValidatingCoupon || !couponCode.trim()}
                size="sm"
              >
                {isValidatingCoupon && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isValidatingCoupon ? "Validating..." : "Apply"}
              </Button>
            </form>
          )}
          
          {couponError && (
            <Alert variant="destructive" className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{couponError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Checkout Section */}
      {isLoading ? (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6 flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-3" />
            <span className="text-blue-700 font-medium">Preparing payment form...</span>
          </CardContent>
        </Card>
      ) : !options ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to load payment form. Please double-check your Stripe key and select a plan.
          </AlertDescription>
        </Alert>
      ) : (
        options && stripePromise && (
          <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )
      )}
    </div>
  );
}
