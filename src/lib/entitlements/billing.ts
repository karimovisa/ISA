// ISA — Billing interface. STRIPE IS NOT INTEGRATED. This is the seam a future
// provider implements; no call site changes when it's swapped in.
export type CheckoutResult = { ok: boolean; url?: string; message: string };

export interface BillingProvider {
  createCheckout(plan: string): Promise<CheckoutResult>;
  openPortal(): Promise<CheckoutResult>;
  cancel(): Promise<CheckoutResult>;
}

export const noopBilling: BillingProvider = {
  async createCheckout(plan) {
    return { ok: false, message: `Billing isn't connected yet (requested: ${plan}).` };
  },
  async openPortal() {
    return { ok: false, message: "Billing portal isn't available yet." };
  },
  async cancel() {
    return { ok: false, message: "Billing isn't connected yet." };
  },
};

/** Swap for a Stripe-backed implementation later — call sites stay the same. */
export const billing: BillingProvider = noopBilling;
