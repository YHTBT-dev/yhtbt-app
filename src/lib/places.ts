export type PlaceSuggestion = {
  placeId: string;
  description: string;
};

type PlacePrediction = {
  placeId?: string;
  text?: { text?: string };
};

type AutocompleteResponse = {
  suggestions?: { placePrediction?: PlacePrediction }[];
};

// Calls the Places API (New) Autocomplete endpoint directly from the
// browser with the public NEXT_PUBLIC_GOOGLE_PLACES_API_KEY (meant to be
// restricted by HTTP referrer in the Google Cloud Console — the standard
// way a client-exposed Places/Maps key is secured, same tradeoff already
// made for the Supabase publishable key elsewhere in this app).
//
// Never throws — a failed lookup (network error, CORS block, API not
// enabled, billing not active, key/referrer mismatch, no results) always
// resolves to an empty array, so a location field using this can just
// keep behaving like a normal text input rather than breaking. Every
// failure is still logged to the console with as much detail as Google
// actually returns, so a real misconfiguration is diagnosable instead of
// silently invisible.
//
// Not debounced here — callers (see LocationAutocompleteInput) are
// responsible for only calling this after a pause in typing.
export async function fetchPlaceSuggestions(
  input: string
): Promise<PlaceSuggestion[]> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error(
      "[places] NEXT_PUBLIC_GOOGLE_PLACES_API_KEY is not set — location autocomplete is disabled."
    );
    return [];
  }

  if (!input.trim()) return [];

  console.log("[places] fetching suggestions for:", input);

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({ input }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      console.error(
        `[places] Autocomplete request failed (${response.status} ${response.statusText}):`,
        errorBody
      );
      return [];
    }

    const data: AutocompleteResponse = await response.json();

    const suggestions = (data.suggestions ?? [])
      .map((suggestion) => suggestion.placePrediction)
      .filter((prediction): prediction is PlacePrediction => Boolean(prediction))
      .map((prediction) => ({
        placeId: prediction.placeId ?? "",
        description: prediction.text?.text ?? "",
      }))
      .filter((suggestion) => suggestion.placeId && suggestion.description);

    console.log(`[places] got ${suggestions.length} suggestion(s) for:`, input);
    return suggestions;
  } catch (error) {
    // A CORS block, offline, DNS failure, etc. all land here as a plain
    // TypeError ("Failed to fetch") with no Response to inspect — still
    // logged so it's visible rather than silently swallowed.
    console.error("[places] Autocomplete request threw:", error);
    return [];
  }
}
