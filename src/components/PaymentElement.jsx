import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { supabase } from "@/api/supabaseClient";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

/**
 * PaymentElementForm Component
 * Renders Stripe Payment Element for flexible multi-method payment collection
 * Supports: Cards, Apple Pay, Google Pay, PayPal, Bank Transfers, and more
 * 
 * @param {string} clientSecret - Payment Intent client secret
 * @param {string} paymentIntentId - Payment Intent ID
 * @param {Function} onSuccess - Callback on successful payment
 * @param {Function} onError - Callback on payment error
 * @param {string} returnUrl - URL to return after payment
 */
function PaymentElementInnerForm({
  clientSecret,
  paymentIntentId,
  onSuccess,
  onError,
  returnUrl,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage("Stripe is not ready. Please refresh the page.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Confirm the payment with the Payment Element
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: returnUrl || `${window.location.origin}/billing-account`,
        },
        redirect: "if_required",
      });

      if (error) {
        // Handle errors
        setErrorMessage(error.message || "Payment failed. Please try again.");
        if (onError) {
          onError(error);
        }
      } else if (paymentIntent.status === "succeeded") {
        // Payment successful
        setErrorMessage(null);
        if (onSuccess) {
          onSuccess(paymentIntent);
        }
      }
    } catch (err) {
      setErrorMessage(err.message || "An unexpected error occurred.");
      if (onError) {
        onError(err);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
          terms: {
            card: "always",
            applePay: "always",
            googlePay: "always",
          },
        }}
      />

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-900">{errorMessage}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center">
            <svg
              className="mr-2 h-5 w-5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Processing...
          </span>
        ) : (
          "Complete Payment"
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Your payment is secure and encrypted by Stripe.
      </p>
    </form>
  );
}

/**
 * PaymentElementForm Wrapper with Stripe Elements Provider
 * Handles Payment Intent creation on the backend
 * 
 * @param {string} priceId - Stripe Price ID (for subscriptions)
 * @param {string} amount - Amount in cents (for one-time payments)
 * @param {string} mode - "payment" or "subscription"
 * @param {Function} onSuccess - Callback on successful payment
 * @param {Function} onError - Callback on payment error
 * @param {string} returnUrl - URL to return after payment
 */
export default function PaymentElementForm({
  priceId,
  amount,
  mode = "subscription",
  onSuccess,
  onError,
  returnUrl,
}) {
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function createPaymentIntent() {
      try {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("Not authenticated");
        }

        const endpoint =
          mode === "subscription"
            ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent-subscription`
            : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            ...(mode === "subscription" && { price_id: priceId }),
            ...(mode === "payment" && { amount }),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create payment intent");
        }

        const { client_secret, payment_intent_id } = await response.json();
        setClientSecret(client_secret);
        setPaymentIntentId(payment_intent_id);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("Payment intent creation error:", err);
        if (onError) {
          onError(err);
        }
      } finally {
        setIsLoading(false);
      }
    }

    createPaymentIntent();
  }, [priceId, amount, mode, onError]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <svg
              className="h-8 w-8 animate-spin text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
          <p className="text-gray-600">Loading payment form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h3 className="mb-2 font-semibold text-red-900">Payment Setup Error</h3>
        <p className="mb-4 text-red-700">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <p className="text-yellow-700">Unable to load payment form. Please refresh and try again.</p>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentElementInnerForm
        clientSecret={clientSecret}
        paymentIntentId={paymentIntentId}
        onSuccess={onSuccess}
        onError={onError}
        returnUrl={returnUrl}
      />
    </Elements>
  );
}
