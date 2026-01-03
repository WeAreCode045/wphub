import React, { useCallback, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { supabase } from "@/api/supabaseClient";
import { useValidateCoupon } from "@/hooks/useStripeElements";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLIC_KEY
);

/**
 * CheckoutForm Component
 * 
 * Features:
 * - Stripe Embedded Checkout
 * - Coupon code validation and discount display
 * - Real-time discount calculation
 * 
 * @param {string} priceId - Stripe Price ID for the product
 * @param {number} quantity - Quantity of items (default: 1)
 * @param {Object} metadata - Additional metadata to pass to Stripe
 * @param {Function} onSuccess - Callback when checkout session is created
 * @param {Function} onCancel - Callback when user cancels
 */
export default function CheckoutForm({
  priceId,
  quantity = 1,
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
  const validateCouponMutation = useValidateCoupon();

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

  const fetchClientSecret = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            price_id: priceId,
            quantity,
            coupon_code: appliedCoupon?.code || null,
            metadata,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create checkout session");
      }

      const { clientSecret, sessionId } = await response.json();
      
      // Call onSuccess callback if provided
      if (onSuccess && sessionId) {
        onSuccess(sessionId);
      }

      return clientSecret;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("Checkout error:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [priceId, quantity, metadata, onSuccess, appliedCoupon]);

  const options = {
    fetchClientSecret,
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h3 className="mb-2 font-semibold text-red-900">
          Checkout Error
        </h3>
        <p className="text-red-700">{error}</p>
        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Coupon Section */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-semibold text-slate-900">Have a coupon?</h3>
        
        {appliedCoupon ? (
          <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 border border-green-200">
            <div>
              <p className="font-medium text-green-900">
                ✓ Coupon applied: <span className="text-green-700">{appliedCoupon.code}</span>
              </p>
              <p className="text-sm text-green-700">
                Discount: {appliedCoupon.type === 'percentage' 
                  ? `${appliedCoupon.discount}%` 
                  : `$${(appliedCoupon.discount / 100).toFixed(2)}`}
              </p>
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
            <input
              type="text"
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              disabled={isValidatingCoupon}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
            />
            <button
              type="submit"
              disabled={isValidatingCoupon || !couponCode.trim()}
              className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {isValidatingCoupon ? "Validating..." : "Apply"}
            </button>
          </form>
        )}
        
        {couponError && (
          <p className="mt-2 text-sm text-red-600">{couponError}</p>
        )}
      </div>

      {/* Checkout Section */}
      {isLoading && (
        <div className="mb-4 flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-300 border-t-blue-600"></div>
          <span className="ml-2 text-blue-700">Loading checkout...</span>
        </div>
      )}
      <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
