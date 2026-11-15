import { useState } from "react";
import type { CheckoutCustomer } from "./types";

/**
 * The delivery details from the customer's last order on this device, so a
 * second order is one tap. Kept in this browser only; storage may be blocked
 * (private mode), in which case the form simply starts empty.
 */
const KEY = "bayan-customer-v1";

function read(): Partial<CheckoutCustomer> | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : undefined;
  } catch {
    return undefined;
  }
}

export function useSavedCustomer() {
  const [value] = useState(read);
  return {
    value,
    remember(c: CheckoutCustomer) {
      try {
        localStorage.setItem(KEY, JSON.stringify(c));
      } catch {
        /* storage blocked — nothing to remember */
      }
    },
  };
}
