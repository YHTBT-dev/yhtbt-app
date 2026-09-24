"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { getExperiences } from "@/data/experiencesStore";

// This app has no server-side data store (everything lives in the
// browser's localStorage), so the experience's actual theme can only be
// known client-side — same as every other piece of per-experience data
// (see page.tsx's own load-on-mount pattern). Falls back to the app's
// default look until that loads, and again if the experience has no
// theme of its own (e.g. it predates theming, though normalizeExperience
// already defaults that case too).
const DEFAULT_THEME = "editorial-classic";

export default function ExperienceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  // This layout doesn't remount when navigating between routes it wraps
  // (e.g. /experiences/[id]/edit back to /experiences/[id]) — Next.js
  // keeps a shared layout mounted across its own child routes, and
  // params.id is unchanged by that navigation anyway. Re-reading only on
  // [params.id] therefore missed exactly the case that matters most: right
  // after editing a theme and saving, the effect never re-ran, so the
  // stale theme from first mount stuck around until a manual refresh
  // remounted everything. pathname changes on every one of those
  // navigations (/experiences/1 vs /experiences/1/edit are different
  // paths), so depending on it too re-triggers the read whenever the user
  // actually moves within this experience's routes.
  const pathname = usePathname();
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    let cancelled = false;

    getExperiences().then((experiences) => {
      if (cancelled) return;

      const experience = experiences.find(
        (item: { id: number; theme?: string }) => String(item.id) === params.id
      );
      const resolvedTheme = experience?.theme ?? DEFAULT_THEME;
      console.log(
        "[ExperienceLayout] experience id:",
        params.id,
        "pathname:",
        pathname,
        "resolved theme:",
        resolvedTheme
      );
      setTheme(resolvedTheme);
    });

    return () => {
      cancelled = true;
    };
  }, [params.id, pathname]);

  // An in-place theme change (e.g. the Host Tools theme modal) doesn't
  // change the route, so the effect above never re-runs for it — those
  // callers announce it with this event instead.
  useEffect(() => {
    function handleThemeChanged(event: Event) {
      const { experienceId, theme: nextTheme } = (
        event as CustomEvent<{ experienceId: string; theme: string }>
      ).detail;
      if (experienceId === params.id) setTheme(nextTheme);
    }

    window.addEventListener("yhtbt:theme-changed", handleThemeChanged);
    return () =>
      window.removeEventListener("yhtbt:theme-changed", handleThemeChanged);
  }, [params.id]);

  // bg-background/text-foreground here matter, not just data-theme: <body>
  // (in the root layout) paints its own background/text color from
  // whatever theme is on <html>, which is always "editorial-classic" — and
  // this div, not body, is what actually needs to show a per-experience
  // theme. Without painting it explicitly here, body's un-themed
  // background still shows through as the page's visible background
  // (everything else was correctly re-theming — text and accent colors
  // are set element-by-element within this subtree — which is why only
  // the background looked stuck). flex-1 makes it fill body's remaining
  // height (root layout's <body> is a flex column) so short pages don't
  // reveal body's background below the fold either.
  return (
    <div data-theme={theme} className="flex flex-1 flex-col bg-background text-foreground">
      {children}
    </div>
  );
}
