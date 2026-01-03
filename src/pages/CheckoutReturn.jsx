import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";

/**
 * CheckoutReturn Component
 * Displays the payment result after user completes Stripe Checkout
 * - If status is 'complete': shows success message
 * - If status is 'open': redirects back to checkout
 * - Otherwise: shows error or loading state
 */
export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [customerEmail, setCustomerEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchSessionStatus() {
      try {
        const sessionId = searchParams.get("session_id");

        if (!sessionId) {
          setError("No session ID provided");
          setIsLoading(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("Not authenticated");
          setIsLoading(false);
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/checkout-session-status?session_id=${sessionId}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Failed to retrieve session status"
          );
        }

        const data = await response.json();
        setStatus(data.status);
        setCustomerEmail(data.customer_email || "");

        // If payment is still open/incomplete, redirect back to checkout
        if (data.status === "open") {
          setTimeout(() => {
            navigate("/checkout");
          }, 2000);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("Session status error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSessionStatus();
  }, [searchParams, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-300 border-t-blue-600"></div>
            <span className="ml-3 text-lg font-semibold text-gray-700">
              Processing your payment...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-red-900">
            Payment Error
          </h2>
          <p className="mb-6 text-red-700">{error}</p>
          <button
            onClick={() => navigate("/checkout")}
            className="w-full rounded bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (status === "open") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-100">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <svg
              className="h-6 w-6 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-yellow-900">
            Payment Not Complete
          </h2>
          <p className="mb-6 text-yellow-700">
            Your payment was not completed. Redirecting you back to checkout...
          </p>
          <button
            onClick={() => navigate("/checkout")}
            className="w-full rounded bg-yellow-600 px-4 py-2 font-semibold text-white hover:bg-yellow-700"
          >
            Return to Checkout
          </button>
        </div>
      </div>
    );
  }

  if (status === "complete") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-green-900">
            Payment Successful!
          </h2>
          <p className="mb-6 text-gray-700">
            Thank you for your purchase! A confirmation email will be sent to{" "}
            <strong>{customerEmail || "your email address"}</strong>.
          </p>
          <p className="mb-6 text-sm text-gray-600">
            If you have any questions, please contact our support team.
          </p>
          <button
            onClick={() => navigate("/billing-account")}
            className="w-full rounded bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700"
          >
            Go to Billing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="rounded-lg bg-white p-8 shadow-lg">
        <p className="text-gray-700">
          Payment status: <strong>{status || "Unknown"}</strong>
        </p>
      </div>
    </div>
  );
}
