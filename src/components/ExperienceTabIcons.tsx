// Small, purely decorative per-tab glyphs for the Experience tab bar —
// same restrained inline-SVG house style as ChevronIcon/GridIcon/
// ListIcon/ItineraryTypeIcon elsewhere in the app (no icon library
// dependency).
type IconProps = {
  className?: string;
};

const ICON_CLASSES = "h-4 w-4";

export function ItineraryTabIcon({ className = ICON_CLASSES }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className={className}>
      <path d="M4 5h12M4 10h12M4 15h8" />
    </svg>
  );
}

export function GuestsTabIcon({ className = ICON_CLASSES }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="7.2" cy="6.5" r="2.3" />
      <path d="M2.8 16c0-2.8 2-4.5 4.4-4.5s4.4 1.7 4.4 4.5" />
      <circle cx="13.8" cy="7.2" r="1.8" />
      <path d="M12.2 11.7c1.9.2 3.4 1.7 3.4 4.3" />
    </svg>
  );
}

export function UpdatesTabIcon({ className = ICON_CLASSES }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 3.5c-2.3 0-4 1.9-4 4.4v2.6l-1.3 2.3h10.6L14 10.5V7.9c0-2.5-1.7-4.4-4-4.4Z" />
      <path d="M8.2 15.3a1.8 1.8 0 0 0 3.6 0" />
    </svg>
  );
}

export function ChatTabIcon({ className = ICON_CLASSES }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" className={className}>
      <path d="M3 4.5h14v8.5H8.5L5 16v-3H3V4.5Z" />
    </svg>
  );
}

export function DetailsTabIcon({ className = ICON_CLASSES }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className={className}>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
      <path d="M10 9.3v4.4" />
    </svg>
  );
}

export function PhotosTabIcon({ className = ICON_CLASSES }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" className={className}>
      <rect x="2.5" y="4" width="15" height="12" rx="1" />
      <path d="M2.5 13.5 7 9l3.5 3.5L13 10l4.5 4" strokeLinecap="round" />
      <circle cx="7" cy="7.3" r="1.1" />
    </svg>
  );
}

export function NotesTabIcon({ className = ICON_CLASSES }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 2.5h7l3 3V17H5V2.5Z" />
      <path d="M12 2.5V6h3" />
      <path d="M7.3 9.5h5.4M7.3 12.2h5.4M7.3 14.9h3.2" />
    </svg>
  );
}

export function HostToolsTabIcon({ className = ICON_CLASSES }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13.2 3.2a3.6 3.6 0 0 1-4.6 4.6L4 12.4v3.6h3.6l4.6-4.6a3.6 3.6 0 0 0 4.6-4.6l-2.3 2.3-1.9-.5-.5-1.9 2.3-2.3Z" />
    </svg>
  );
}

// Distinct, small — shown appended to the Chat tab's label only when
// phase is "after" (see ExperienceTabBar), not a general-purpose icon.
export function LockTabIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4.5" y="9" width="11" height="7.5" rx="1.2" />
      <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" />
    </svg>
  );
}
