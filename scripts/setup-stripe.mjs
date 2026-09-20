// One-time (idempotent) setup script: creates the "YHTBT Platform Fee"
// Product and a one-time $50 test Price in Stripe, if they don't already
// exist. Re-running it is safe — it reuses what's already there instead
// of creating duplicates.
//
// Usage: node --env-file=.env.local scripts/setup-stripe.mjs

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error(
    "STRIPE_SECRET_KEY is not set. Run with: node --env-file=.env.local scripts/setup-stripe.mjs"
  );
  process.exit(1);
}

const stripe = new Stripe(secretKey);

const PRODUCT_NAME = "YHTBT Platform Fee";
const PRICE_AMOUNT_CENTS = 5000; // $50.00 placeholder — real pricing not finalized

async function main() {
  const existingProducts = await stripe.products.list({ limit: 100 });
  let product = existingProducts.data.find(
    (item) => item.name === PRODUCT_NAME && item.active
  );

  if (!product) {
    product = await stripe.products.create({
      name: PRODUCT_NAME,
      description:
        "One-time platform fee for hosting an Experience on YHTBT (placeholder pricing, not finalized).",
    });
    console.log(`Created product: ${product.id}`);
  } else {
    console.log(`Reusing existing product: ${product.id}`);
  }

  const existingPrices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });
  let price = existingPrices.data.find(
    (item) =>
      item.unit_amount === PRICE_AMOUNT_CENTS &&
      item.currency === "usd" &&
      item.type === "one_time"
  );

  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: PRICE_AMOUNT_CENTS,
      currency: "usd",
      // No `recurring` field — this makes it a one-time price.
    });
    console.log(`Created price: ${price.id}`);
  } else {
    console.log(`Reusing existing price: ${price.id}`);
  }

  console.log("\nAdd this to .env.local:");
  console.log(`STRIPE_PLATFORM_FEE_PRICE_ID=${price.id}`);
}

main().catch((error) => {
  console.error("Failed to set up Stripe product/price:", error);
  process.exit(1);
});
