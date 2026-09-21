"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExperiences } from "@/data/experiencesStore";
import { getItineraryItems } from "@/data/itineraryStore";
import { getPhotos } from "@/data/photosStore";
import { formatShortDate, getPhotoDownloadFilename } from "@/lib/format";

type Experience = {
  id: number;
  name: string;
};

type ItineraryItem = {
  id: number;
  date: string;
  title: string;
};

type Photo = {
  id: number;
  dataUrl: string;
  itineraryItemId: number | null;
  timestamp: string;
};

export default function AlbumPage() {
  const params = useParams<{ id: string }>();
  const [experience, setExperience] = useState<Experience | null | undefined>(
    undefined
  );
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    const experiences = getExperiences();
    const found = experiences.find(
      (item: Experience) => String(item.id) === params.id
    );
    setExperience(found ?? null);
    setItineraryItems(getItineraryItems(params.id));
    setPhotos(getPhotos(params.id));
  }, [params.id]);

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

  // itineraryItems is already sorted chronologically by itineraryStore.
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

  const hasAnyPhotos = photos.length > 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
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

      <h1 className="mt-3 font-serif text-3xl text-foreground sm:text-4xl">
        Album
      </h1>

      {!hasAnyPhotos ? (
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-muted italic">
          No photos yet
        </div>
      ) : (
        <div className="mt-12 flex flex-col gap-16">
          {momentGroups.map((group) => (
            <div key={group.key}>
              <h2 className="font-serif text-2xl text-foreground">
                {group.title}
                <span className="ml-3 text-base text-muted">
                  {formatShortDate(group.date)}
                </span>
              </h2>
              <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
                {group.photos.map((photo) => (
                  <div key={photo.id}>
                    <div className="aspect-square w-full overflow-hidden bg-foreground/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.dataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <a
                      href={photo.dataUrl}
                      download={getPhotoDownloadFilename(
                        experience.name,
                        photo,
                        group.title
                      )}
                      className="mt-2 inline-block text-xs text-muted underline underline-offset-2 transition-colors hover:text-accent"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {otherPhotos.length > 0 ? (
            <div>
              <h2 className="font-serif text-2xl text-foreground">
                Other Photos
              </h2>
              <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
                {otherPhotos.map((photo) => (
                  <div key={photo.id}>
                    <div className="aspect-square w-full overflow-hidden bg-foreground/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.dataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <a
                      href={photo.dataUrl}
                      download={getPhotoDownloadFilename(
                        experience.name,
                        photo
                      )}
                      className="mt-2 inline-block text-xs text-muted underline underline-offset-2 transition-colors hover:text-accent"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
