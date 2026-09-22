"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

// TEMPORARY internal-testing gate — see the comment at the top of
// proxy.ts. Not real authentication; just a shared password so this app
// isn't wide open while it's being tested pre-launch.
function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Incorrect password.");
        setIsSubmitting(false);
        return;
      }

      // A full navigation (not router.push) so the browser sends the
      // just-set cookie along with the next request — proxy.ts checks it
      // server-side before this route even renders.
      window.location.href = next;
    } catch {
      setError("Something went wrong. Try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-3xl text-foreground">YHTBT</h1>
        <p className="mt-2 text-sm text-muted">
          This app is in private testing — enter the password to continue.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 flex flex-col gap-6 text-left"
        >
          <label className="block">
            <span className="text-sm tracking-wide text-muted uppercase">
              Password
            </span>
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground focus:border-accent focus:outline-none"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="self-center border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
