"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExperiences } from "@/data/experiencesStore";
import { getItineraryItems } from "@/data/itineraryStore";
import { getGuests } from "@/data/guestsStore";
import { getPhotos } from "@/data/photosStore";
import Modal from "@/components/Modal";
import {
  formatDateHeading,
  formatDateRange,
  formatTimeRange,
  getPhotoDownloadFilename,
  groupByDate,
} from "@/lib/format";

const BOOK_ORDER_FIELD_CLASSES =
  "mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-muted placeholder:italic focus:border-accent focus:outline-none";
const BOOK_ORDER_LABEL_CLASSES = "text-sm tracking-wide text-muted uppercase";

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
  const [coverImageError, setCoverImageError] = useState(false);
  const [isBookOrderModalOpen, setIsBookOrderModalOpen] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
  const [bookOrderError, setBookOrderError] = useState("");
  const [isSubmittingBookOrder, setIsSubmittingBookOrder] = useState(false);

  useEffect(() => {
    const experiences = getExperiences();
    const found = experiences.find(
      (item: Experience) => String(item.id) === params.id
    );
    setExperience(found ?? null);
    setItineraryItems(getItineraryItems(params.id));
    setGuests(getGuests(params.id));
    setPhotos(getPhotos(params.id));
    setCoverImageError(false);
  }, [params.id]);

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
    setCountry("");
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
    <main className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-8 sm:py-24">
      <Link
        href="/experiences"
        className="block text-sm text-muted underline underline-offset-2 transition-colors hover:text-accent"
      >
        &larr; Back to My Experiences
      </Link>
      <Link
        href={`/experiences/${params.id}`}
        className="mt-1 block text-sm text-muted underline underline-offset-2 transition-colors hover:text-accent"
      >
        Back to {experience.name}
      </Link>

      {experience.coverImage && !coverImageError ? (
        <div className="mt-8 h-72 w-full overflow-hidden sm:h-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={experience.coverImage}
            alt=""
            onError={() => setCoverImageError(true)}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="mt-12 text-center">
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
        <h1 className="font-serif text-4xl text-foreground sm:text-5xl">
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
        <section className="mt-24">
          <h2 className="text-center font-serif text-2xl text-foreground">
            The Itinerary
          </h2>

          <div className="mt-14 flex flex-col gap-16">
            {groupedItinerary.map((group) => (
              <div key={group.date}>
                <h3 className="font-serif text-xl text-accent">
                  {formatDateHeading(group.date)}
                </h3>
                <div className="mt-6 flex flex-col gap-8 border-l border-foreground/15 pl-8">
                  {group.items.map((item) => (
                    <div key={item.id} className="relative">
                      <span className="absolute top-2 -left-[calc(2rem+3px)] h-1.5 w-1.5 rounded-full bg-accent" />
                      <p className="text-sm text-muted">
                        {formatTimeRange(item)}
                      </p>
                      <p className="mt-1 font-serif text-lg text-foreground">
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
        <section className="mt-24">
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
                      className={`group relative overflow-hidden bg-foreground/5 ${getPhotoSpanClasses(
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
                        className="absolute right-2 bottom-2 bg-background/80 px-2 py-1 text-[11px] text-foreground/60 opacity-0 underline underline-offset-2 transition-opacity hover:text-accent group-hover:opacity-100"
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
                      className={`group relative overflow-hidden bg-foreground/5 ${getPhotoSpanClasses(
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
                        className="absolute right-2 bottom-2 bg-background/80 px-2 py-1 text-[11px] text-foreground/60 opacity-0 underline underline-offset-2 transition-opacity hover:text-accent group-hover:opacity-100"
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

      <section className="mt-24">
        <h2 className="text-center font-serif text-2xl text-foreground">
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

      <div className="mt-24 flex flex-col items-center gap-3 text-center">
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
              <span className={BOOK_ORDER_LABEL_CLASSES}>State</span>
              <input
                type="text"
                required
                value={addressState}
                onChange={(event) => setAddressState(event.target.value)}
                placeholder="CA"
                className={BOOK_ORDER_FIELD_CLASSES}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
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

            <label className="block">
              <span className={BOOK_ORDER_LABEL_CLASSES}>Country</span>
              <input
                type="text"
                required
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="United States"
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
        className="pointer-events-none fixed right-4 bottom-4 text-[10px] tracking-[0.3em] text-foreground/20 uppercase select-none sm:right-6 sm:bottom-6"
      >
        YHTBT
      </span>
    </main>
  );
}
