// Experiences at or under this guest count are free — no platform fee,
// no Stripe Checkout. Above it, the host pays the platform tier fee.
// Shared between Experience creation (src/app/experiences/new/page.tsx,
// where the host picks a tier upfront) and the real-time guest cap
// enforced on an existing free-tier Experience (src/app/experiences/
// [id]/page.tsx, where it's checked against the actual guest list).
export const GUEST_COUNT_FREE_TIER_THRESHOLD = 20;
