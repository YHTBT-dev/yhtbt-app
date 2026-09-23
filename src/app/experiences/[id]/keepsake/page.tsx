"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExperiences } from "@/data/experiencesStore";
import { getItineraryItems } from "@/data/itineraryStore";
import { getGuests } from "@/data/guestsStore";
import { getPhotos } from "@/data/photosStore";
import { getReflections } from "@/data/reflectionsStore";
import Modal from "@/components/Modal";
import { PolaroidCard, PolaroidExpandModal } from "@/components/PolaroidCard";
import { ItineraryTypeIcon } from "@/components/ItineraryTypeIcon";
import {
  formatDateHeading,
  formatDateRange,
  formatTimeRange,
  getPhotoDownloadFilename,
  groupByDate,
  sanitizeForFilename,
} from "@/lib/format";

const BOOK_ORDER_FIELD_CLASSES =
  "mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-placeholder placeholder:text-sm placeholder:italic focus:border-accent focus:outline-none";
const BOOK_ORDER_LABEL_CLASSES = "text-sm tracking-wide text-muted uppercase";

const DEFAULT_BOOK_ORDER_COUNTRY = "United States";

// A US state/province field only makes sense as a fixed dropdown for the
// US — most other countries don't have a small, fixed, dropdown-friendly
// list of first-level subdivisions the way the US does, so any other
// country falls back to a plain "State/Province/Region" text field (see
// the form below) instead of trying to maintain a full list per country.
const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

// United States first (the default), then the rest alphabetically —
// avoids a duplicate "United States" entry inside the alphabetical run.
const COUNTRIES = [
  DEFAULT_BOOK_ORDER_COUNTRY,
  ...[
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola",
    "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
    "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus",
    "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
    "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
    "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada",
    "Cape Verde", "Central African Republic", "Chad", "Chile", "China",
    "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia",
    "Cuba", "Cyprus", "Czech Republic", "Democratic Republic of the Congo",
    "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador",
    "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia",
    "Eswatini", "Ethiopia", "Fiji", "Finland", "France",
    "Gabon", "Gambia", "Georgia", "Germany", "Ghana",
    "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau",
    "Guyana", "Haiti", "Honduras", "Hungary", "Iceland",
    "India", "Indonesia", "Iran", "Iraq", "Ireland",
    "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan",
    "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo",
    "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
    "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
    "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives",
    "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius",
    "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia",
    "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
    "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua",
    "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
    "Oman", "Pakistan", "Palau", "Palestine", "Panama",
    "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
    "Portugal", "Qatar", "Romania", "Russia", "Rwanda",
    "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines",
    "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia",
    "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
    "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
    "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan",
    "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan",
    "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo",
    "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
    "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
    "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela",
    "Vietnam", "Yemen", "Zambia", "Zimbabwe",
  ].sort(),
];

type Experience = {
  id: number;
  name: string;
  coverImage: string;
  startDate: string;
  endDate: string;
  location?: string;
  theme?: string;
};

type ItineraryItem = {
  id: number;
  date: string;
  startTime?: string;
  endTime?: string;
  time?: string;
  title: string;
  description: string;
  location: string;
  dressCode?: string;
  type?: string;
};

type Guest = {
  id: number;
  name: string;
  everConfirmed?: boolean;
};

type Photo = {
  id: number;
  dataUrl: string;
  itineraryItemId: number | null;
};

type Reflection = {
  id: number;
  promptText: string;
  responseText: string;
  photo: string | null;
  guestName: string;
  taggedGuests: string[];
  createdAt: string;
};

// Gives the photo spread a bit of editorial rhythm instead of a uniform
// grid — every 5th photo is large, every 3rd (offset) is tall.
function getPhotoSpanClasses(index: number) {
  const position = index % 5;
  if (position === 0) return "col-span-2 row-span-2";
  if (position === 3) return "row-span-2";
  return "";
}

function getImageMimeType(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
  return match?.[1] ?? "image/jpeg";
}

// Keepsake-only: composites a small "YHTBT" mark onto a *copy* of the
// photo before it's saved. The original stored photo is never touched —
// this only affects the file generated at download time, from this page.
async function downloadWatermarkedPhoto(photoDataUrl: string, filename: string) {
  const image = new Image();
  // Photos are now hosted on Supabase Storage rather than base64 data
  // URLs, so this is a cross-origin image — without requesting it
  // anonymously, drawing it to the canvas below would "taint" the
  // canvas and canvas.toBlob() would throw a SecurityError instead of
  // producing a file. Supabase Storage's public objects serve permissive
  // CORS headers, so this succeeds without any bucket-side config.
  image.crossOrigin = "anonymous";
  image.src = photoDataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load image"));
  });

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(image, 0, 0);

  const fontSize = Math.max(12, Math.round(canvas.width * 0.018));
  const margin = Math.round(canvas.width * 0.02);

  ctx.save();
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = "bottom";
  ctx.textAlign = "right";
  ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
  ctx.shadowBlur = fontSize * 0.3;
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.fillText("Y H T B T", canvas.width - margin, canvas.height - margin);
  ctx.restore();

  const mimeType = getImageMimeType(photoDataUrl);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, 0.92)
  );
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function KeepsakePage() {
  const params = useParams<{ id: string }>();
  const [experience, setExperience] = useState<Experience | null | undefined>(
    undefined
  );
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [expandedReflection, setExpandedReflection] =
    useState<Reflection | null>(null);
  const [coverImageError, setCoverImageError] = useState(false);
  const [isBookOrderModalOpen, setIsBookOrderModalOpen] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState(DEFAULT_BOOK_ORDER_COUNTRY);
  const [bookOrderError, setBookOrderError] = useState("");
  const [isSubmittingBookOrder, setIsSubmittingBookOrder] = useState(false);
  const originalDocumentTitleRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    getExperiences().then((experiences) => {
      if (cancelled) return;
      const found = experiences.find(
        (item: Experience) => String(item.id) === params.id
      );
      setExperience(found ?? null);
    });

    getItineraryItems(params.id).then((fetched) => {
      if (!cancelled) setItineraryItems(fetched);
    });
    getGuests(params.id).then((fetched) => {
      if (!cancelled) setGuests(fetched);
    });
    getPhotos(params.id).then((fetched) => {
      if (!cancelled) setPhotos(fetched);
    });
    setReflections(getReflections(params.id));
    setCoverImageError(false);

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  // Chrome/Safari's print dialog suggests document.title as the "Save as
  // PDF" filename — without this it's stuck on the app's static default
  // ("Create Next App", set once in the root layout). beforeprint/afterprint
  // fire around ANY print trigger (the button below, but also Cmd/Ctrl+P
  // or a browser print menu item), so the swap is scoped to those events
  // rather than just the button's onClick, and the original title is
  // always restored afterward — this only ever affects the tab title for
  // the duration of the print dialog being open, never permanently.
  useEffect(() => {
    originalDocumentTitleRef.current = document.title;
  }, []);

  useEffect(() => {
    function handleBeforePrint() {
      if (!experience) return;
      document.title =
        sanitizeForFilename(experience.name) || originalDocumentTitleRef.current;
    }

    function handleAfterPrint() {
      document.title = originalDocumentTitleRef.current;
    }

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.title = originalDocumentTitleRef.current;
    };
  }, [experience]);

  function handleOpenBookOrderModal() {
    setBookOrderError("");
    setIsBookOrderModalOpen(true);
  }

  function handleCloseBookOrderModal() {
    setIsBookOrderModalOpen(false);
    setRecipientName("");
    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setAddressState("");
    setZip("");
    setCountry(DEFAULT_BOOK_ORDER_COUNTRY);
    setBookOrderError("");
  }

  async function handleSubmitBookOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBookOrderError("");
    setIsSubmittingBookOrder(true);

    try {
      const response = await fetch("/api/checkout/book-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experienceId: params.id,
          recipientName,
          shippingAddress: {
            line1: addressLine1,
            line2: addressLine2,
            city,
            state: addressState,
            zip,
            country,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        setBookOrderError(
          data.error || "Could not start checkout. Please try again."
        );
        setIsSubmittingBookOrder(false);
        return;
      }

      // Full navigation to Stripe's hosted Checkout page, outside the app.
      window.location.href = data.url;
    } catch {
      setBookOrderError("Could not start checkout. Please try again.");
      setIsSubmittingBookOrder(false);
    }
  }

  if (experience === undefined) {
    return null;
  }

  if (experience === null) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-muted italic">
          Experience not found
        </div>
      </main>
    );
  }

  const groupedItinerary = groupByDate(itineraryItems);

  const momentGroups = itineraryItems
    .map((item) => ({
      key: `item-${item.id}`,
      title: item.title,
      date: item.date,
      photos: photos.filter((photo) => photo.itineraryItemId === item.id),
    }))
    .filter((group) => group.photos.length > 0);

  const linkedItineraryItemIds = new Set(itineraryItems.map((item) => item.id));
  const otherPhotos = photos.filter(
    (photo) =>
      !photo.itineraryItemId || !linkedItineraryItemIds.has(photo.itineraryItemId)
  );

  const confirmedGuests = guests.filter((guest) => guest.everConfirmed);

  return (
    <main className="keepsake-print mx-auto w-full max-w-4xl px-4 py-16 sm:px-8 sm:py-24">
      <Link
        href="/experiences"
        className="keepsake-print-hide block text-sm text-muted underline underline-offset-2 transition-colors hover:text-accent"
      >
        &larr; Back to My Experiences
      </Link>
      <Link
        href={`/experiences/${params.id}`}
        className="keepsake-print-hide mt-1 block text-sm text-muted underline underline-offset-2 transition-colors hover:text-accent"
      >
        Back to {experience.name}
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="keepsake-print-hide mt-1 block text-sm text-muted underline underline-offset-2 transition-colors hover:text-accent"
      >
        Download as PDF
      </button>

      {experience.coverImage && !coverImageError ? (
        <div className="keepsake-print-cover mt-8 h-72 w-full overflow-hidden sm:h-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={experience.coverImage}
            alt=""
            onError={() => setCoverImageError(true)}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="keepsake-print-title-block mt-12 text-center">
        {experience.theme === "midnight-edition" ? (
          // Midnight-Edition-only detail — a small invitation-card flourish
          // Editorial Classic and Coastal Light don't have; see the
          // .keepsake-eyebrow rule in globals.css.
          <div className="mb-5 flex flex-col items-center gap-3">
            <div className="h-px w-8 bg-foreground/25" />
            <span className="keepsake-eyebrow text-sm text-muted">
              A Keepsake
            </span>
          </div>
        ) : null}
        <h1 className="keepsake-print-title font-serif text-4xl text-foreground sm:text-5xl">
          {experience.theme === "midnight-edition" ? (
            // Optional per the original request: a noticeably larger first
            // letter, reserved for this ceremonial page rather than every
            // heading under this theme. Sized inline (not floated) so it
            // stays compatible with this heading's centered alignment.
            <>
              <span className="text-[1.6em] leading-none">
                {experience.name.charAt(0)}
              </span>
              {experience.name.slice(1)}
            </>
          ) : (
            experience.name
          )}
        </h1>
        <p className="keepsake-meta mt-4 text-muted">
          {formatDateRange(experience.startDate, experience.endDate)}
          {experience.location ? ` · ${experience.location}` : ""}
        </p>
      </div>

      {groupedItinerary.length > 0 ? (
        <section className="keepsake-print-page-break mt-24">
          <h2 className="text-center font-serif text-2xl text-foreground">
            The Itinerary
          </h2>

          <div className="mt-14 flex flex-col gap-16">
            {groupedItinerary.map((group) => (
              <div key={group.date}>
                <h3 className="font-serif text-xl text-accent">
                  {formatDateHeading(group.date)}
                </h3>
                <div className="keepsake-print-itinerary-line mt-6 flex flex-col gap-8 border-l border-foreground/15 pl-8">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="relative break-inside-avoid keepsake-print-avoid-break"
                    >
                      <span className="absolute top-2 -left-[calc(2rem+3px)] h-1.5 w-1.5 rounded-full bg-accent" />
                      <p className="text-sm text-muted">
                        {formatTimeRange(item)}
                      </p>
                      <p className="mt-1 flex items-center gap-2 font-serif text-lg text-foreground">
                        <span className="shrink-0 text-muted">
                          <ItineraryTypeIcon type={item.type ?? "Generic"} />
                        </span>
                        {item.title}
                      </p>
                      {item.location ? (
                        <p className="mt-1 text-sm text-foreground/60">
                          {item.location}
                        </p>
                      ) : null}
                      {item.description ? (
                        <p className="mt-2 text-foreground/70">
                          {item.description}
                        </p>
                      ) : null}
                      {item.dressCode ? (
                        <p className="mt-1 text-sm text-muted italic">
                          {item.dressCode}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {photos.length > 0 ? (
        <section className="keepsake-print-page-break mt-24">
          <h2 className="text-center font-serif text-2xl text-foreground">
            The Album
          </h2>

          <div className="mt-14 flex flex-col gap-16">
            {momentGroups.map((group) => (
              <div key={group.key}>
                <h3 className="font-serif text-xl text-accent">
                  {group.title}
                </h3>
                <div className="mt-6 grid auto-rows-[140px] grid-cols-2 grid-flow-dense gap-4 sm:auto-rows-[180px] sm:grid-cols-4">
                  {group.photos.map((photo, index) => (
                    <div
                      key={photo.id}
                      className={`group relative overflow-hidden bg-foreground/5 break-inside-avoid keepsake-print-avoid-break ${getPhotoSpanClasses(
                        index
                      )}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.dataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          downloadWatermarkedPhoto(
                            photo.dataUrl,
                            getPhotoDownloadFilename(
                              experience.name,
                              photo,
                              group.title
                            )
                          )
                        }
                        className="keepsake-print-hide absolute right-2 bottom-2 bg-background/80 px-2 py-1 text-[11px] text-foreground/60 opacity-0 underline underline-offset-2 transition-opacity hover:text-accent group-hover:opacity-100"
                      >
                        Save to device
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {otherPhotos.length > 0 ? (
              <div>
                <h3 className="font-serif text-xl text-accent">
                  More from the Experience
                </h3>
                <div className="mt-6 grid auto-rows-[140px] grid-cols-2 grid-flow-dense gap-4 sm:auto-rows-[180px] sm:grid-cols-4">
                  {otherPhotos.map((photo, index) => (
                    <div
                      key={photo.id}
                      className={`group relative overflow-hidden bg-foreground/5 break-inside-avoid keepsake-print-avoid-break ${getPhotoSpanClasses(
                        index
                      )}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.dataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          downloadWatermarkedPhoto(
                            photo.dataUrl,
                            getPhotoDownloadFilename(experience.name, photo)
                          )
                        }
                        className="keepsake-print-hide absolute right-2 bottom-2 bg-background/80 px-2 py-1 text-[11px] text-foreground/60 opacity-0 underline underline-offset-2 transition-opacity hover:text-accent group-hover:opacity-100"
                      >
                        Save to device
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {reflections.length > 0 ? (
        <section className="keepsake-print-page-break mt-24">
          <h2 className="text-center font-serif text-2xl text-foreground">
            Reflections
          </h2>

          {/* A clean, aligned grid rather than the live feed's masonry —
              a keepsake should read as composed and orderly, not casual,
              so PolaroidCard is rendered here with rotate={false} and no
              onDelete (this is a read-only compiled view). */}
          <div className="keepsake-print-reflections-grid mt-14 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {reflections.map((reflection) => (
              <div
                key={reflection.id}
                className="break-inside-avoid keepsake-print-avoid-break"
              >
                <PolaroidCard
                  reflection={reflection}
                  rotate={false}
                  onExpand={setExpandedReflection}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <PolaroidExpandModal
        reflection={expandedReflection}
        onClose={() => setExpandedReflection(null)}
      />

      <section className="mt-24">
        <h2 className="keepsake-print-avoid-break-after text-center font-serif text-2xl text-foreground">
          Who Was There
        </h2>
        {confirmedGuests.length > 0 ? (
          <p className="mx-auto mt-6 max-w-2xl text-center font-serif text-lg leading-loose text-foreground/80">
            {confirmedGuests.map((guest) => guest.name).join(" · ")}
          </p>
        ) : (
          <p className="mt-6 text-center font-serif text-lg text-muted italic">
            No confirmed guests yet
          </p>
        )}
      </section>

      <div className="keepsake-print-hide mt-24 flex flex-col items-center gap-3 text-center">
        <p className="font-serif text-lg text-foreground/70 italic">
          Want to hold onto this one?
        </p>
        <button
          type="button"
          onClick={handleOpenBookOrderModal}
          className="border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
        >
          Order the Printed Keepsake Book
        </button>
      </div>

      <Modal
        isOpen={isBookOrderModalOpen}
        onClose={handleCloseBookOrderModal}
        title="Order the Printed Keepsake Book"
      >
        <form onSubmit={handleSubmitBookOrder} className="flex flex-col gap-6">
          <p className="text-sm text-muted">
            A human-curated, printed version of this keepsake, mailed to
            whoever you choose. $75 (test mode) — you&apos;ll be taken to a
            secure Stripe checkout page next.
          </p>

          <label className="block">
            <span className={BOOK_ORDER_LABEL_CLASSES}>Recipient Name</span>
            <input
              type="text"
              required
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              placeholder="Jamie Rivera"
              className={BOOK_ORDER_FIELD_CLASSES}
            />
          </label>

          <label className="block">
            <span className={BOOK_ORDER_LABEL_CLASSES}>Address Line 1</span>
            <input
              type="text"
              required
              value={addressLine1}
              onChange={(event) => setAddressLine1(event.target.value)}
              placeholder="123 Main St"
              className={BOOK_ORDER_FIELD_CLASSES}
            />
          </label>

          <label className="block">
            <span className={BOOK_ORDER_LABEL_CLASSES}>
              Address Line 2 (Optional)
            </span>
            <input
              type="text"
              value={addressLine2}
              onChange={(event) => setAddressLine2(event.target.value)}
              placeholder="Apt, suite, etc."
              className={BOOK_ORDER_FIELD_CLASSES}
            />
          </label>

          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
            <label className="block">
              <span className={BOOK_ORDER_LABEL_CLASSES}>City</span>
              <input
                type="text"
                required
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Los Angeles"
                className={BOOK_ORDER_FIELD_CLASSES}
              />
            </label>

            <label className="block">
              <span className={BOOK_ORDER_LABEL_CLASSES}>Country</span>
              <select
                required
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className={BOOK_ORDER_FIELD_CLASSES}
              >
                {COUNTRIES.map((countryName) => (
                  <option key={countryName} value={countryName}>
                    {countryName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
            <label className="block">
              <span className={BOOK_ORDER_LABEL_CLASSES}>
                {country === DEFAULT_BOOK_ORDER_COUNTRY
                  ? "State"
                  : "State/Province/Region"}
              </span>
              {country === DEFAULT_BOOK_ORDER_COUNTRY ? (
                <select
                  required
                  value={addressState}
                  onChange={(event) => setAddressState(event.target.value)}
                  className={BOOK_ORDER_FIELD_CLASSES}
                >
                  <option value="" disabled>
                    Select a state
                  </option>
                  {US_STATES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={addressState}
                  onChange={(event) => setAddressState(event.target.value)}
                  placeholder="Ontario"
                  className={BOOK_ORDER_FIELD_CLASSES}
                />
              )}
            </label>

            <label className="block">
              <span className={BOOK_ORDER_LABEL_CLASSES}>ZIP</span>
              <input
                type="text"
                required
                value={zip}
                onChange={(event) => setZip(event.target.value)}
                placeholder="90001"
                className={BOOK_ORDER_FIELD_CLASSES}
              />
            </label>
          </div>

          {bookOrderError ? (
            <p className="text-sm text-red-600">{bookOrderError}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmittingBookOrder}
            className="self-start border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmittingBookOrder
              ? "Redirecting to Checkout…"
              : "Continue to Payment"}
          </button>
        </form>
      </Modal>

      <span
        aria-hidden="true"
        className="keepsake-print-watermark pointer-events-none fixed right-4 bottom-4 text-[10px] tracking-[0.3em] text-foreground/20 uppercase select-none sm:right-6 sm:bottom-6"
      >
        YHTBT
      </span>
    </main>
  );
}
