import React from "react";
import { AddressElement, useElements } from "@stripe/react-stripe-js";

/**
 * BillingAddressElement Component
 * Collects billing address using Stripe Address Element
 * Displays stored address from Link if available
 * 
 * @param {boolean} required - Whether address is required
 * @param {Function} onChange - Callback when address changes
 */
export default function BillingAddressElement({ required = true, onChange }) {
  const elements = useElements();

  const handleAddressChange = (event) => {
    if (onChange) {
      onChange({
        complete: event.complete,
        value: event.value,
      });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Billing Address</h3>
      <AddressElement
        type="billing"
        options={{
          mode: "short",
          displayMode: "accordion",
          autocomplete: {
            enabled: true,
          },
        }}
        onChange={handleAddressChange}
      />
    </div>
  );
}
