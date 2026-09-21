import { NextResponse } from "next/server";
import {
  getAppUrl,
  getKeepsakeBookPriceId,
  getStripeClient,
} from "@/lib/stripe";

type ShippingAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
};

type BookOrderCheckoutRequestBody = {
  experienceId?: string;
  recipientName?: string;
  shippingAddress?: ShippingAddress;
};

export async function POST(request: Request) {
  let body: BookOrderCheckoutRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { experienceId, recipientName, shippingAddress } = body;

  if (
    !experienceId ||
    !recipientName ||
    !shippingAddress?.line1 ||
    !shippingAddress?.city ||
    !shippingAddress?.state ||
    !shippingAddress?.zip ||
    !shippingAddress?.country
  ) {
    return NextResponse.json(
      { error: "Missing required recipient/shipping details." },
      { status: 400 }
    );
  }

  let stripe;
  let priceId: string;
  try {
    stripe = getStripeClient();
    priceId = getKeepsakeBookPriceId();
  } catch (error) {
    console.error("[api/checkout/book-order] Stripe is not configured:", error);
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
      // The order isn't saved anywhere yet (this app's storage is
      // client-side localStorage, not a server database), so we
      // round-trip the form fields through Checkout Session metadata and
      // create the book order record on the success page once payment is
      // confirmed — same pattern as the platform fee checkout.
      metadata: {
        experienceId,
        recipientName,
        addressLine1: shippingAddress.line1,
        addressLine2: shippingAddress.line2 ?? "",
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zip,
        country: shippingAddress.country,
      },
      success_url: `${appUrl}/experiences/${experienceId}/keepsake/book-order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/experiences/${experienceId}/keepsake`,
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
      "[api/checkout/book-order] Failed to create checkout session:",
      error
    );
    // TEMPORARY: `detail` exposes the raw error message in the response so
    // it's visible directly in the browser's Network tab. Remove this field
    // once the underlying issue is actually diagnosed and fixed — it isn't
    // meant to ship long-term.
    return NextResponse.json(
      {
        error: "Could not start checkout. Please try again.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
