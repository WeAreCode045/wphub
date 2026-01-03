import React, { useEffect, useState, useMemo, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { supabase } from "@/api/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

/**
 * CheckoutForm Component
 * 
 * Features:
 * - Stripe Embedded Checkout
 * - Simple payment form focused on checkout capture
 * 
 * @param {string} priceId - Stripe Price ID for the product
 * @param {number} quantity - Quantity of items (default: 1)
 * @param {Object} selectedPlan - Selected subscription plan details
 * @param {string} billingPeriod - "monthly" or "yearly"
 * @param {string} couponCode - Applied coupon code
 * @param {Object} metadata - Additional metadata to pass to Stripe
 * @param {Function} onSuccess - Callback when checkout session is created
 * @param {Function} onCancel - Callback when user cancels
 */
export default function CheckoutForm({
  priceId,
  quantity = 1,
  selectedPlan = null,
  billingPeriod = "monthly",
  couponCode = null,
  metadata = null,
  onSuccess,
  onCancel,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [user, setUser] = useState(null);
  const lastRequestKeyRef = useRef(null);

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

  const metadataPayload = useMemo(() => ({
    ...(metadata || {}),
    plan_name: selectedPlan?.name,
    billing_period: billingPeriod,
  }), [metadata, selectedPlan?.name, billingPeriod]);

  const metadataKey = useMemo(() => JSON.stringify(metadataPayload || {}), [metadataPayload]);

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
            coupon_code: couponCode || null,
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
            metadata: metadataPayload,
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
      const requestKey = `${priceId || ""}::${couponCode || ""}::${billingPeriod}::${metadataKey}`;

      // Avoid creating multiple Embedded Checkout instances for the same state
      if (clientSecret && lastRequestKeyRef.current === requestKey) {
        return;
      }

      lastRequestKeyRef.current = requestKey;

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
  }, [priceId, quantity, metadataPayload, metadataKey, onSuccess, couponCode, billingPeriod, clientSecret]);

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
    </div>
  );
}
