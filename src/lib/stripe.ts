import Stripe from "stripe";

// Server-only. Never import this from a Client Component — the secret key
// must never reach the browser.
let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (see .env.local.example) and restart the dev server."
    );
  }

  stripeClient = new Stripe(secretKey);
  return stripeClient;
}

// The "YHTBT Platform Fee" one-time test Price, created by
// scripts/setup-stripe.mjs. Pricing is a $50 placeholder — not finalized.
export function getPlatformFeePriceId() {
  const priceId = process.env.STRIPE_PLATFORM_FEE_PRICE_ID;
  if (!priceId) {
    throw new Error(
      "STRIPE_PLATFORM_FEE_PRICE_ID is not set. Run `node --env-file=.env.local scripts/setup-stripe.mjs` and add the printed price ID to .env.local."
    );
  }
  return priceId;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
