"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

const TABS = [
  { label: "Experiences", value: "experiences", href: "/experiences" },
  { label: "Activity", value: "activity", href: "/activity" },
  { label: "Profile", value: "profile", href: "/profile" },
];

// Top-level navigation between the app's main pages, rendered once by the
// (tabs) route group's layout. The active tab is the layout's selected
// child segment ("experiences" / "activity" / "profile") — layouts don't
// re-render on navigation, so it can't be passed down as a prop.
export default function AppNav() {
  const active = useSelectedLayoutSegment();

  return (
    <nav className="mb-10 flex gap-6 border-b border-foreground/10">
      {TABS.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px border-b-2 pb-3 text-xs tracking-[0.2em] uppercase transition-colors ${
              isActive
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-accent"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
