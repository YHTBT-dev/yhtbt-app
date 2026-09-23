import { NextResponse } from "next/server";
import { getAppUrl, getPlatformFeePriceId, getStripeClient } from "@/lib/stripe";

type CheckoutRequestBody = {
  experienceId?: string;
};

// Starts the same platform-fee Checkout used at Experience creation for
// the "more than 20 guests" tier, but for an EXISTING Experience that's
// hit the free-tier guest cap (see the "Guest limit reached" modal in
// /experiences/[id]/page.tsx). Unlike creation, the Experience already
// exists here — this only needs to round-trip its id through metadata,
// not the whole record, and the success page (guest-cap/success) just
// flips its paid flag rather than constructing a new record.
export async function POST(request: Request) {
  let body: CheckoutRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { experienceId } = body;
  if (!experienceId) {
    return NextResponse.json(
      { error: "Missing experienceId." },
      { status: 400 }
    );
  }

  let stripe;
  let priceId: string;
  try {
    stripe = getStripeClient();
    priceId = getPlatformFeePriceId();
  } catch (error) {
    console.error("[api/checkout/guest-cap] Stripe is not configured:", error);
    return NextResponse.json(
      { error: "Payments are not configured on the server yet." },
      { status: 500 }
    );
  }

  const appUrl = getAppUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { experienceId },
      success_url: `${appUrl}/experiences/${experienceId}/guest-cap/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/experiences/${experienceId}`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error(
      "[api/checkout/guest-cap] Failed to create checkout session:",
      error
    );
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}
