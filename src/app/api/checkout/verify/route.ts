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
    console.error("[api/checkout/verify] Stripe is not configured:", error);
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
      experienceName,
      startDate,
      endDate,
      location,
      roles,
      estimatedGuestCount,
      theme,
    } = metadata;

    if (!experienceName || !startDate || !endDate || !roles || !estimatedGuestCount) {
      return NextResponse.json(
        { error: "Checkout session is missing experience details." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      name: experienceName,
      // coverImage isn't part of Checkout Session metadata (see
      // /api/checkout) — the success page reattaches it from
      // sessionStorage instead.
      startDate,
      endDate,
      location: location ?? "",
      roles: JSON.parse(roles) as string[],
      estimatedGuestCount: Number(estimatedGuestCount),
      theme: theme ?? "editorial-classic",
    });
  } catch (error) {
    console.error("[api/checkout/verify] Failed to verify session:", error);
    return NextResponse.json(
      { error: "Could not verify payment. Please contact support." },
      { status: 500 }
    );
  }
}
