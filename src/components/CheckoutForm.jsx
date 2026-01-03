import React, { useCallback, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { supabase } from "@/api/supabaseClient";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLIC_KEY
);

/**
 * CheckoutForm Component
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
  }, [priceId, quantity, metadata, onSuccess]);

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
    <div className="w-full max-w-2xl">
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
