"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  addExperience,
  getExperienceByCheckoutSessionId,
} from "@/data/experiencesStore";

type Status = "verifying" | "error";

function CheckoutSuccessContent() {
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

    async function finalizeExperience() {
      try {
        const response = await fetch(
          `/api/checkout/verify?session_id=${encodeURIComponent(sessionId!)}`
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

        // Idempotency guard: this effect can legitimately run more than
        // once for the same session — React Strict Mode double-invokes
        // effects in dev, and a user could revisit or refresh this URL.
        // If a session already produced an experience, don't create
        // another one.
        const existing = getExperienceByCheckoutSessionId(sessionId!);
        const finalizedExperience =
          existing ??
          addExperience({
            name: data.name,
            coverImage: data.coverImage,
            startDate: data.startDate,
            endDate: data.endDate,
            location: data.location,
            roles: data.roles,
            estimatedGuestCount: data.estimatedGuestCount,
            checkoutSessionId: sessionId,
            paid: true,
          });

        if (!cancelled) {
          sessionStorage.setItem("justCreated", String(finalizedExperience.id));
          router.push(`/experiences/${finalizedExperience.id}`);
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setError("Could not verify payment. Please try again.");
        }
      }
    }

    finalizeExperience();

    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  if (status === "error") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
          <p className="font-serif text-lg text-foreground/70 italic">
            {error}
          </p>
          <Link
            href="/experiences/new"
            className="border border-accent px-5 py-2 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
          >
            Back to New Experience
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

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
