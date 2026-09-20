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

export function formatDateRange(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  if (!start || !end) return "";

  if (startDate === endDate) {
    return start.toLocaleDateString("en-US", opts);
  }

  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString(
    "en-US",
    opts
  )}`;
}

export function formatDateHeading(date: string) {
  const parsed = parseLocalDate(date);
  if (!parsed) return "";

  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(time: string | undefined) {
  if (!time) return "";

  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;

  const date = new Date();
  date.setHours(hours, minutes);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

type TimeRangeItem = {
  startTime?: string;
  endTime?: string;
  time?: string;
};

export function formatTimeRange(item: TimeRangeItem) {
  if (item.startTime || item.endTime) {
    const start = formatTime(item.startTime);
    const end = formatTime(item.endTime);
    if (start && end) return `${start} – ${end}`;
    return start || end;
  }

  // Fall back to the legacy single "time" field for items saved before
  // startTime/endTime was introduced.
  return formatTime(item.time);
}

type DateGroupableItem = { date: string };

export function groupByDate<T extends DateGroupableItem>(items: T[]) {
  const groups: { date: string; items: T[] }[] = [];

  for (const item of items) {
    const group = groups.find((g) => g.date === item.date);
    if (group) {
      group.items.push(item);
    } else {
      groups.push({ date: item.date, items: [item] });
    }
  }

  return groups;
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
