"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { updateExperience } from "@/data/experiencesStore";

type Status = "verifying" | "error";

function GuestCapSuccessContent() {
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

    async function finalizeUpgrade() {
      try {
        const response = await fetch(
          `/api/checkout/guest-cap/verify?session_id=${encodeURIComponent(sessionId!)}`
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

        // No idempotency guard needed here the way the book-order and
        // experience-creation success pages need one — setting paid:
        // true is naturally idempotent, so this effect running more than
        // once for the same session (React Strict Mode dev
        // double-invoke, or a revisit/refresh of this URL) is harmless.
        const updated = await updateExperience(Number(params.id), {
          paid: true,
        });

        if (!updated) {
          if (!cancelled) {
            setStatus("error");
            setError("Payment succeeded, but the Experience could not be updated. Please contact support.");
          }
          return;
        }

        if (!cancelled) {
          router.push(`/experiences/${params.id}`);
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setError("Could not verify payment. Please try again.");
        }
      }
    }

    finalizeUpgrade();

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
            href={`/experiences/${params.id}`}
            className="border border-accent px-5 py-2 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
          >
            Back to Experience
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

export default function GuestCapSuccessPage() {
  return (
    <Suspense fallback={null}>
      <GuestCapSuccessContent />
    </Suspense>
  );
}
