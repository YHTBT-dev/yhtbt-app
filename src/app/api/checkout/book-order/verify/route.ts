import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id." },
      { status: 400 }
    );
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch (error) {
    console.error(
      "[api/checkout/book-order/verify] Stripe is not configured:",
      error
    );
    return NextResponse.json(
      { error: "Payments are not configured on the server yet." },
      { status: 500 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "This checkout session has not been paid." },
        { status: 402 }
      );
    }

    const metadata = session.metadata ?? {};
    const {
      experienceId,
      recipientName,
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
      country,
    } = metadata;

    if (
      !experienceId ||
      !recipientName ||
      !addressLine1 ||
      !city ||
      !state ||
      !zip ||
      !country
    ) {
      return NextResponse.json(
        { error: "Checkout session is missing order details." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      experienceId,
      recipientName,
      shippingAddress: {
        line1: addressLine1,
        line2: addressLine2 ?? "",
        city,
        state,
        zip,
        country,
      },
    });
  } catch (error) {
    console.error(
      "[api/checkout/book-order/verify] Failed to verify session:",
      error
    );
    return NextResponse.json(
      { error: "Could not verify payment. Please contact support." },
      { status: 500 }
    );
  }
}
