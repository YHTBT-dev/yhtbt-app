// Parses a plain "YYYY-MM-DD" string as a local calendar date instead of
// letting `new Date(string)` treat it as UTC, which can shift the date by
// one day depending on the viewer's timezone offset. Returns null if the
// value is missing instead of crashing.
export function parseLocalDate(dateString: string | undefined | null) {
  if (!dateString) return null;

  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatShortDate(dateString: string | undefined) {
  const parsed = parseLocalDate(dateString);
  if (!parsed) return "";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

export function formatRelativeTime(timestamp: string) {
  const diffSeconds = Math.round(
    (Date.now() - new Date(timestamp).getTime()) / 1000
  );
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, secondsInUnit] of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffSeconds) >= secondsInUnit) {
      return rtf.format(-Math.round(diffSeconds / secondsInUnit), unit);
    }
  }

  return rtf.format(-diffSeconds, "second");
}

// Strips characters that aren't safe across filesystems and collapses
// whitespace into hyphens, so an experience name can be used as the base
// of a downloaded filename.
export function sanitizeForFilename(value: string) {
  return value
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, "-");
}

export function getPhotoFileExtension(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
  const subtype = match?.[1]?.toLowerCase();
  if (subtype === "jpeg" || subtype === "jpg") return "jpg";
  if (subtype === "png") return "png";
  if (subtype === "gif") return "gif";
  if (subtype === "webp") return "webp";
  return "jpg";
}

export function getPhotoDownloadFilename(
  experienceName: string,
  photo: { id: number; dataUrl: string },
  itineraryItemTitle?: string
) {
  const base = sanitizeForFilename(experienceName) || "photo";
  const extension = getPhotoFileExtension(photo.dataUrl);

  const titlePart = itineraryItemTitle
    ? sanitizeForFilename(itineraryItemTitle)
    : "";
  if (titlePart) {
    return `${base}-${titlePart}-${photo.id}.${extension}`;
  }

  return `${base}-${photo.id}.${extension}`;
}
