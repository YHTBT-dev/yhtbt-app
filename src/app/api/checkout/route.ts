import { NextResponse } from "next/server";
import { getAppUrl, getPlatformFeePriceId, getStripeClient } from "@/lib/stripe";

type CheckoutRequestBody = {
  name?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  roles?: string[];
  estimatedGuestCount?: number;
  theme?: string;
};

export async function POST(request: Request) {
  let body: CheckoutRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, startDate, endDate, location, roles, estimatedGuestCount, theme } =
    body;

  if (
    !name ||
    !startDate ||
    !endDate ||
    !roles ||
    roles.length === 0 ||
    !Number.isInteger(estimatedGuestCount) ||
    (estimatedGuestCount as number) < 1
  ) {
    return NextResponse.json(
      { error: "Missing required experience details." },
      { status: 400 }
    );
  }

  let stripe;
  let priceId: string;
  try {
    stripe = getStripeClient();
    priceId = getPlatformFeePriceId();
  } catch (error) {
    console.error("[api/checkout] Stripe is not configured:", error);
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
      // The experience isn't saved anywhere yet (this app's storage is
      // client-side localStorage, not a server database), so we round-trip
      // the form fields through Checkout Session metadata and reconstruct
      // the experience on the success page once payment is confirmed.
      metadata: {
        experienceName: name,
        // coverImage isn't included here — it's a base64 data URL that can
        // be far larger than Stripe's 500-character metadata value limit.
        // The client stashes it in sessionStorage instead (see
        // /experiences/new) and reattaches it after payment.
        startDate,
        endDate,
        location: location ?? "",
        roles: JSON.stringify(roles),
        estimatedGuestCount: String(estimatedGuestCount),
        theme: theme ?? "editorial-classic",
      },
      success_url: `${appUrl}/experiences/new/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/experiences/new`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    // @stripe/stripe-js's redirectToCheckout() was removed in the
    // installed SDK version — the current supported flow is to navigate
    // the browser directly to the Checkout Session's own url.
    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("[api/checkout] Failed to create checkout session:", error);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}
