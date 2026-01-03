import React, { useState } from "react";
import { LinkAuthenticationElement, useStripe } from "@stripe/react-stripe-js";

/**
 * FastCheckoutElement Component
 * Uses Stripe Link to prefill payment and shipping details for returning customers
 * Speeds up checkout by auto-filling saved information
 * 
 * @param {Function} onEmailChange - Callback when email changes
 * @param {Function} onComplete - Callback when Link authentication completes
 */
export default function FastCheckoutElement({ onEmailChange, onComplete }) {
  const stripe = useStripe();
  const [email, setEmail] = useState("");

  const handleEmailChange = (event) => {
    const newEmail = event.value.email;
    setEmail(newEmail);
    if (onEmailChange) {
      onEmailChange(newEmail);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <div className="flex-1 border-t border-gray-300"></div>
        <span className="mx-4 text-sm text-gray-500">or continue with Link</span>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>

      <LinkAuthenticationElement
        onChange={handleEmailChange}
        options={{
          fields: {
            email: "always",
          },
        }}
      />

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <p className="text-sm text-blue-900">
          💡 <strong>Faster Checkout:</strong> Link automatically fills in your saved payment and address information for future purchases.
        </p>
      </div>
    </div>
  );
}
