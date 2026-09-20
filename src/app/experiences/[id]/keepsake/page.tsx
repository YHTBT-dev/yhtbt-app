"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExperiences } from "@/data/experiencesStore";
import { getItineraryItems } from "@/data/itineraryStore";
import { getGuests } from "@/data/guestsStore";
import { getPhotos } from "@/data/photosStore";
import {
  formatDateHeading,
  formatDateRange,
  formatTimeRange,
  getPhotoDownloadFilename,
  groupByDate,
} from "@/lib/format";

type Experience = {
  id: number;
  name: string;
  coverImage: string;
  startDate: string;
  endDate: string;
  location?: string;
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

export default function KeepsakePage() {
  const params = useParams<{ id: string }>();
  const [experience, setExperience] = useState<Experience | null | undefined>(
    undefined
  );
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [coverImageError, setCoverImageError] = useState(false);

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

  if (experience === undefined) {
    return null;
  }

  if (experience === null) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-foreground/50 italic">
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
        href={`/experiences/${params.id}`}
        className="text-sm text-foreground/50 underline underline-offset-2 transition-colors hover:text-accent"
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
        <h1 className="font-serif text-4xl text-foreground sm:text-5xl">
          {experience.name}
        </h1>
        <p className="mt-4 text-foreground/60">
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
                      <p className="text-sm text-foreground/50">
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
                        <p className="mt-1 text-sm text-foreground/50 italic">
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
                      <a
                        href={photo.dataUrl}
                        download={getPhotoDownloadFilename(
                          experience.name,
                          photo,
                          group.title
                        )}
                        className="absolute right-2 bottom-2 bg-background/80 px-2 py-1 text-[11px] text-foreground/60 opacity-0 underline underline-offset-2 transition-opacity hover:text-accent group-hover:opacity-100"
                      >
                        Save to device
                      </a>
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
                      <a
                        href={photo.dataUrl}
                        download={getPhotoDownloadFilename(
                          experience.name,
                          photo
                        )}
                        className="absolute right-2 bottom-2 bg-background/80 px-2 py-1 text-[11px] text-foreground/60 opacity-0 underline underline-offset-2 transition-opacity hover:text-accent group-hover:opacity-100"
                      >
                        Save to device
                      </a>
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
          <p className="mt-6 text-center font-serif text-lg text-foreground/50 italic">
            No confirmed guests yet
          </p>
        )}
      </section>
    </main>
  );
}
