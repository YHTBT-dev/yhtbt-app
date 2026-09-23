"use client";

import { FormEvent, useState } from "react";

// TEMPORARY internal-testing gate — see the comment at the top of
// proxy.ts. Not real authentication; just a shared password so this app
// isn't wide open while it's being tested pre-launch.
export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // TEMPORARY diagnostic logging — added to track down a report that
    // this form does nothing on mobile Safari (no error, no navigation).
    // Remove once that's confirmed fixed. Open the console on the mobile
    // device (e.g. via Safari's Web Inspector over USB, or a remote
    // console tool) to see how far submission actually gets.
    console.log("[LoginForm] submit event fired");
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      console.log("[LoginForm] posting to /api/login...");
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      console.log("[LoginForm] response received, status:", response.status);
      const data = await response.json();

      if (!response.ok) {
        console.log("[LoginForm] login rejected:", data);
        setError(data.error || "Incorrect password.");
        setIsSubmitting(false);
        return;
      }

      console.log("[LoginForm] login succeeded, navigating to /experiences");
      // Always /experiences regardless of what page triggered the gate —
      // landing on whatever in-progress page (e.g. a draft Experience
      // creation form) the visitor happened to be on/heading to before
      // hitting the gate was confusing, not helpful. A full navigation
      // (not router.push) so the browser sends the just-set cookie along
      // with the next request — proxy.ts checks it server-side before
      // that route even renders.
      window.location.href = "/experiences";
    } catch (err) {
      console.log("[LoginForm] submit threw:", err);
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
          method="post"
          onSubmit={handleSubmit}
          className="mt-10 flex flex-col gap-6 text-left"
        >
          <label className="block">
            <span className="text-sm tracking-wide text-muted uppercase">
              Password
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              enterKeyHint="go"
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
