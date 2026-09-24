import { endsAfterMidnight, formatTimeRange } from "@/lib/format";

type Props = {
  startTime?: string;
  endTime?: string;
  time?: string;
};

// The time range for an itinerary item, with a "*" and a short footnote
// when it ends after midnight (end earlier than start). The footnote is
// visible text rather than only a tooltip so it also works on touch. The
// title gives the same explanation on hover.
export default function ItineraryTimeRange(item: Props) {
  const range = formatTimeRange(item);

  if (!endsAfterMidnight(item)) return <>{range}</>;

  return (
    <>
      {range}
      <span title="Ends after midnight">*</span>
      <span className="block text-xs text-foreground/50">*Ends after midnight</span>
    </>
  );
}
