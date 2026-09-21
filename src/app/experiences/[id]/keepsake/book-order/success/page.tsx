"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  addBookOrder,
  getBookOrderByStripeSessionId,
} from "@/data/bookOrdersStore";

type Status = "verifying" | "error";

function BookOrderSuccessContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<Status>("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setError("Missing checkout session.");
      return;
    }

    let cancelled = false;

    async function finalizeBookOrder() {
      try {
        const response = await fetch(
          `/api/checkout/book-order/verify?session_id=${encodeURIComponent(sessionId!)}`
        );
        const data = await response.json();

        if (!response.ok) {
          if (!cancelled) {
            setStatus("error");
            setError(data.error || "Could not verify payment.");
          }
          return;
        }

        if (cancelled) return;

        // Idempotency guard, same reasoning as the experience-creation
        // success page: this effect can legitimately run more than once
        // for the same session (React Strict Mode dev double-invoke, or a
        // revisit/refresh of this URL). If a session already produced an
        // order, don't create another one.
        const existing = getBookOrderByStripeSessionId(sessionId!);
        if (!existing) {
          addBookOrder({
            experienceId: data.experienceId,
            recipientName: data.recipientName,
            shippingAddress: data.shippingAddress,
            stripeSessionId: sessionId,
          });
        }

        if (!cancelled) {
          router.push(`/experiences/${params.id}/keepsake`);
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setError("Could not verify payment. Please try again.");
        }
      }
    }

    finalizeBookOrder();

    return () => {
      cancelled = true;
    };
  }, [sessionId, router, params.id]);

  if (status === "error") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
          <p className="font-serif text-lg text-foreground/70 italic">
            {error}
          </p>
          <Link
            href={`/experiences/${params.id}/keepsake`}
            className="border border-accent px-5 py-2 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
          >
            Back to Keepsake
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-8 sm:py-14">
      <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-foreground/50 italic">
        Confirming your payment…
      </div>
    </main>
  );
}

export default function BookOrderSuccessPage() {
  return (
    <Suspense fallback={null}>
      <BookOrderSuccessContent />
    </Suspense>
  );
}
