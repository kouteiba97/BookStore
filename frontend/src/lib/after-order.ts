import { useQueryClient } from "@tanstack/react-query";
import { updateMe, useAccount, ME_KEY } from "./account";
import type { CheckoutCustomer } from "./types";

/**
 * After an order goes through: refresh «طلباتي», and — for a logged-in
 * customer whose profile has no delivery address yet — keep the one they just
 * typed, so the next order is pre-filled.
 */
export function useAfterOrder() {
  const qc = useQueryClient();
  const account = useAccount();
  return (values: CheckoutCustomer) => {
    if (!account.loggedIn) return;
    qc.invalidateQueries({ queryKey: ["account", "orders"] });
    const c = account.customer;
    if (c && (!c.wilaya || !c.address)) {
      updateMe({ wilaya: c.wilaya || values.wilaya, address: c.address || values.address })
        .then((updated) => qc.setQueriesData({ queryKey: ME_KEY }, updated))
        .catch(() => undefined);
    }
  };
}
