import AppNav from "@/components/AppNav";

// Shared shell for the top-level tabs (Experiences, Activity, Profile).
// The route group keeps these URLs unchanged while giving all three one
// container, so the nav sits in the same spot on every tab and persists
// across navigation instead of remounting per page. Pages that want a
// narrower reading width constrain their own content inside this, left-
// aligned rather than re-centered, so their left edge still lines up
// with the nav.
export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <AppNav />
      {children}
    </main>
  );
}
