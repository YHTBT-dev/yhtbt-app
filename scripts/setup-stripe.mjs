// One-time (idempotent) setup script: creates each YHTBT test Product and
// its one-time test Price in Stripe, if they don't already exist.
// Re-running it is safe — it reuses what's already there instead of
// creating duplicates.
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

const PRODUCTS = [
  {
    productName: "YHTBT Platform Fee",
    description:
      "One-time platform fee for hosting an Experience on YHTBT (placeholder pricing, not finalized).",
    priceAmountCents: 5000, // $50.00 placeholder — real pricing not finalized
    envVarName: "STRIPE_PLATFORM_FEE_PRICE_ID",
  },
  {
    productName: "YHTBT Keepsake Book",
    description:
      "One-time order of a printed, human-curated Experience keepsake book (placeholder pricing, not finalized).",
    priceAmountCents: 7500, // $75.00 placeholder — real pricing not finalized
    envVarName: "STRIPE_KEEPSAKE_BOOK_PRICE_ID",
  },
];

async function setUpProduct({ productName, description, priceAmountCents, envVarName }) {
  const existingProducts = await stripe.products.list({ limit: 100 });
  let product = existingProducts.data.find(
    (item) => item.name === productName && item.active
  );

  if (!product) {
    product = await stripe.products.create({
      name: productName,
      description,
    });
    console.log(`Created product: ${product.id} (${productName})`);
  } else {
    console.log(`Reusing existing product: ${product.id} (${productName})`);
  }

  const existingPrices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });
  let price = existingPrices.data.find(
    (item) =>
      item.unit_amount === priceAmountCents &&
      item.currency === "usd" &&
      item.type === "one_time"
  );

  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: priceAmountCents,
      currency: "usd",
      // No `recurring` field — this makes it a one-time price.
    });
    console.log(`Created price: ${price.id}`);
  } else {
    console.log(`Reusing existing price: ${price.id}`);
  }

  return { envVarName, priceId: price.id };
}

async function main() {
  const results = [];
  for (const product of PRODUCTS) {
    results.push(await setUpProduct(product));
  }

  console.log("\nAdd these to .env.local:");
  for (const { envVarName, priceId } of results) {
    console.log(`${envVarName}=${priceId}`);
  }
}

main().catch((error) => {
  console.error("Failed to set up Stripe products/prices:", error);
  process.exit(1);
});
