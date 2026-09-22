// Small, purely decorative per-type glyphs for the itinerary — same
// restrained inline-SVG house style as ChevronIcon/GridIcon/ListIcon
// elsewhere in the app (no icon library dependency). Type is pure
// categorization here; it never implies extra structured fields.
type IconProps = {
  className?: string;
};

const ICON_CLASSES = "h-4 w-4";

function FlightIcon({ className = ICON_CLASSES }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" className={className}>
      <path d="M17 3 3 9.5l5.5 2 2 5.5L17 3Z" />
    </svg>
  );
}

function TransportationIcon({ className = ICON_CLASSES }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 9 6.5 5.5h7L15 9" />
      <rect x="3" y="9" width="14" height="5" rx="1.2" />
      <circle cx="6.5" cy="15.3" r="1.3" />
      <circle cx="13.5" cy="15.3" r="1.3" />
    </svg>
  );
}

function HotelIcon({ className = ICON_CLASSES }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2.5 16V6.5" />
      <path d="M2.5 12.5h15V16" />
      <rect x="4" y="9" width="5.5" height="3.5" rx="1" />
    </svg>
  );
}

function MealIcon({ className = ICON_CLASSES }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5.5 3v5a1 1 0 0 0 2 0V3" />
      <path d="M6.5 8v9" />
      <path d="M14 3c-1.4 0-2 1.8-2 4s.6 4 2 4v6" />
    </svg>
  );
}

function EventIcon({ className = ICON_CLASSES }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" className={className}>
      <path d="M10 2.5 12.1 6.8l4.7.7-3.4 3.3.8 4.7L10 13.2l-4.2 2.3.8-4.7-3.4-3.3 4.7-.7L10 2.5Z" />
    </svg>
  );
}

function GenericIcon({ className = ICON_CLASSES }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="14" height="13" rx="1.2" />
      <path d="M3 8h14" />
      <path d="M7 2.3v3.4M13 2.3v3.4" />
    </svg>
  );
}

const ICON_BY_TYPE: Record<string, (props: IconProps) => React.JSX.Element> = {
  Flight: FlightIcon,
  Transportation: TransportationIcon,
  Hotel: HotelIcon,
  Meal: MealIcon,
  "Event/Excursion": EventIcon,
  Generic: GenericIcon,
};

export function ItineraryTypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const Icon = ICON_BY_TYPE[type] ?? GenericIcon;
  return <Icon className={className} />;
}
