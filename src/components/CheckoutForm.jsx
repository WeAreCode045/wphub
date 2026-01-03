import React, { useEffect, useState, useCallback, useMemo } from "react";
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
 * @param {boolean} summaryOnly - If true, only show coupon section (for sidebar)
 */
export default function CheckoutForm({
  priceId,
  quantity = 1,
  selectedPlan = null,
  billingPeriod = "monthly",
  metadata = {},
  onSuccess,
  onCancel,
  summaryOnly = false,
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

  const options = useMemo(() => 
    clientSecret ? { clientSecret } : undefined, 
    [clientSecret]
  );

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-900">Checkout Error</h3>
            <p className="text-red-700 mt-1">{error}</p>
            {onCancel && (
              <Button
                onClick={onCancel}
                variant="outline"
                className="mt-4"
              >
                Go Back
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* SUMMARY ONLY MODE - Just show coupon section for sidebar */}
      {summaryOnly ? (
        <>
          {/* Coupon Section in Summary */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Have a coupon?
            </h3>
            
            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 border border-green-200">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-900 text-sm">
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
        </>
      ) : (
        <>
          {/* FULL MODE - Show payment form only */}
          {/* Checkout Section */}
          {isLoading ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-3" />
              <span className="text-blue-700 font-medium">Preparing payment form...</span>
            </div>
          ) : !options ? (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                Unable to load payment form. Please select a plan.
              </p>
            </div>
          ) : stripePromise && options ? (
            <EmbeddedCheckoutProvider stripe={stripePromise} options={options} key={`checkout-${clientSecret}`}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : null}
        </>
      )}
    </div>
  );
}
