// Generic starter descriptions per itinerary item type — a convenience for
// the "Suggest description" link on the new-item form, same idea as the
// suggested FAQs (see suggestedFaqs.js): text goes into the field for the
// host to edit or replace, never stored or applied on its own. Written to
// work for any event, so none mention specifics.
export const SUGGESTED_ITINERARY_DESCRIPTIONS_BY_TYPE = {
  Flight: [
    "Safe travels! See you there.",
    "Wishing everyone a smooth flight.",
  ],
  Transportation: [
    "We'll travel together, so please arrive a few minutes early.",
    "Transportation is arranged, so just show up and we'll get everyone there.",
  ],
  Hotel: [
    "Check in and get settled. We can't wait to see you.",
    "Your home base for the trip. Settle in and enjoy!",
  ],
  Meal: ["Join us for a meal together.", "Good food, good company."],
  "Event/Excursion": [
    "Come along and join in the fun.",
    "Something to look forward to. Hope you can make it!",
  ],
  Generic: [
    "We're glad you're here. See you then!",
    "Join us and enjoy the moment.",
  ],
};

export function getSuggestedItineraryDescriptions(type) {
  return (
    SUGGESTED_ITINERARY_DESCRIPTIONS_BY_TYPE[type] ??
    SUGGESTED_ITINERARY_DESCRIPTIONS_BY_TYPE.Generic
  );
}
