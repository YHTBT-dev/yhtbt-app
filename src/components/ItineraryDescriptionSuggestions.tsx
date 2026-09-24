"use client";

import { getSuggestedItineraryDescriptions } from "@/data/suggestedItineraryDescriptions";

type Props = {
  type: string;
  description: string;
  onPick: (text: string) => void;
};

// Shows the selected type's starter descriptions as clickable options
// whenever the description field is empty (and only then), so it reappears
// any time the host clears the field, on both the new and edit forms.
// Listing every option, rather than one button that silently swaps between
// them, makes it obvious what's on offer. Picking one just fills the field
// with editable text.
export default function ItineraryDescriptionSuggestions({
  type,
  description,
  onPick,
}: Props) {
  if (description.trim() !== "") return null;

  return (
    <span className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <span className="text-placeholder italic">Suggestions:</span>
      {getSuggestedItineraryDescriptions(type).map((text: string) => (
        <button
          key={text}
          type="button"
          onClick={() => onPick(text)}
          className="text-left text-placeholder italic underline underline-offset-2 transition-colors hover:text-accent"
        >
          {text}
        </button>
      ))}
    </span>
  );
}
