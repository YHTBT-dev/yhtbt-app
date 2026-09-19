"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getExperiences } from "@/data/experiencesStore";
import { getItineraryItems } from "@/data/itineraryStore";
import { getNote, saveNote } from "@/data/notesStore";
import { addGuest, getGuests, updateGuestStatus } from "@/data/guestsStore";

// react-quill-new relies on the browser's `document`, so it can only be
// loaded on the client.
const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

const NOTE_SAVE_DEBOUNCE_MS = 800;
const SAVED_INDICATOR_DURATION_MS = 2000;
const NOTE_TOOLBAR_MODULES = {
  toolbar: [["bold", "italic"], [{ list: "bullet" }]],
};
const NOTE_FORMATS = ["bold", "italic", "list"];
const RSVP_STATUS_OPTIONS: { label: string; value: Guest["rsvpStatus"] }[] = [
  { label: "Invited", value: "invited" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Declined", value: "declined" },
];
type GuestTabStatus = Guest["rsvpStatus"] | "all";

const GUEST_TABS: {
  label: string;
  status: GuestTabStatus;
  emptyMessage: string;
}[] = [
  { label: "All Guests", status: "all", emptyMessage: "No guests yet" },
  {
    label: "Who's Attending",
    status: "confirmed",
    emptyMessage: "No confirmed guests yet",
  },
  { label: "Invited", status: "invited", emptyMessage: "No invited guests" },
  {
    label: "Declined",
    status: "declined",
    emptyMessage: "No declined guests",
  },
];

type Experience = {
  id: number;
  name: string;
  coverImage: string;
  startDate: string;
  endDate: string;
  location?: string;
  roles: string[];
};

type ItineraryItem = {
  id: number;
  experienceId: string;
  date: string;
  // Legacy items created before startTime/endTime existed only have `time`.
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
  experienceId: string;
  name: string;
  email: string;
  rsvpStatus: "invited" | "confirmed" | "declined";
};

// Parses a plain "YYYY-MM-DD" string as a local calendar date instead of
// letting `new Date(string)` treat it as UTC, which can shift the date by
// one day depending on the viewer's timezone offset.
function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateRange(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  if (startDate === endDate) {
    return start.toLocaleDateString("en-US", opts);
  }

  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString(
    "en-US",
    opts
  )}`;
}

function formatDateHeading(date: string) {
  return parseLocalDate(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(time: string | undefined) {
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

function formatTimeRange(item: ItineraryItem) {
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

function groupByDate(items: ItineraryItem[]) {
  const groups: { date: string; items: ItineraryItem[] }[] = [];

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

export default function ExperienceDetailPage() {
  const params = useParams<{ id: string }>();
  const [experience, setExperience] = useState<Experience | null | undefined>(
    undefined
  );
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestTab, setGuestTab] = useState<GuestTabStatus>("confirmed");
  const [note, setNote] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    const experiences = getExperiences();
    const found = experiences.find(
      (item: Experience) => String(item.id) === params.id
    );
    setExperience(found ?? null);
    setItineraryItems(getItineraryItems(params.id));
    setGuests(getGuests(params.id));
    setNote(getNote(params.id));
  }, [params.id]);

  function handleAddGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newGuest = addGuest({
      experienceId: params.id,
      name: guestName,
      email: guestEmail,
      rsvpStatus: "invited",
    });

    setGuests((current) => [...current, newGuest]);
    setGuestName("");
    setGuestEmail("");
  }

  function handleRsvpStatusChange(
    guestId: number,
    rsvpStatus: Guest["rsvpStatus"]
  ) {
    const updatedGuest = updateGuestStatus(guestId, rsvpStatus);
    if (!updatedGuest) return;

    setGuests((current) =>
      current.map((item) => (item.id === guestId ? updatedGuest : item))
    );
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedIndicatorTimerRef.current)
        clearTimeout(savedIndicatorTimerRef.current);
    };
  }, []);

  function handleNoteChange(value: string) {
    setNote(value);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveNote(params.id, value);
      setShowSaved(true);

      if (savedIndicatorTimerRef.current)
        clearTimeout(savedIndicatorTimerRef.current);
      savedIndicatorTimerRef.current = setTimeout(() => {
        setShowSaved(false);
      }, SAVED_INDICATOR_DURATION_MS);
    }, NOTE_SAVE_DEBOUNCE_MS);
  }

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

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
      <span className="inline-block border border-accent/30 bg-accent/5 px-2.5 py-1 text-xs tracking-widest text-accent uppercase">
        Host View
      </span>

      <div className="mt-3 flex items-baseline gap-3">
        <h1 className="font-serif text-3xl text-foreground sm:text-4xl">
          {experience.name}
        </h1>
        <Link
          href={`/experiences/${params.id}/edit`}
          className="shrink-0 text-sm text-foreground/50 underline underline-offset-2 transition-colors hover:text-accent"
        >
          Edit
        </Link>
      </div>
      <p className="mt-2 text-sm text-foreground/60">
        {formatDateRange(experience.startDate, experience.endDate)}
        {experience.location ? ` · ${experience.location}` : ""}
      </p>

      <div className="mt-12 flex items-center justify-between gap-4">
        <h2 className="font-serif text-2xl text-foreground">Itinerary</h2>
        <Link
          href={`/experiences/${params.id}/itinerary/new`}
          className="shrink-0 border border-accent px-5 py-2 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
        >
          Add Itinerary Item
        </Link>
      </div>

      {groupedItinerary.length === 0 ? (
        <div className="flex min-h-[20vh] items-center justify-center text-center font-serif text-lg text-foreground/50 italic">
          No itinerary yet
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {groupedItinerary.map((group) => (
            <div key={group.date}>
              <h3 className="text-sm tracking-wide text-accent uppercase">
                {formatDateHeading(group.date)}
              </h3>
              <div className="mt-4 flex flex-col gap-6 border-t border-foreground/10 pt-4">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_auto] sm:gap-6"
                  >
                    <p className="text-sm text-foreground/60 whitespace-nowrap sm:w-44 sm:shrink-0">
                      {formatTimeRange(item)}
                    </p>
                    <div>
                      <p className="font-serif text-lg text-foreground">
                        {item.title}
                      </p>
                      {item.description ? (
                        <p className="mt-1 text-sm text-foreground/60">
                          {item.description}
                        </p>
                      ) : null}
                      {item.dressCode ? (
                        <p className="mt-1 text-sm text-foreground/60">
                          Dress code: {item.dressCode}
                        </p>
                      ) : null}
                    </div>
                    {item.location ? (
                      <p className="text-sm text-foreground/60 sm:text-right">
                        {item.location}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12">
        <h2 className="font-serif text-2xl text-foreground">Guests</h2>

        <form
          onSubmit={handleAddGuest}
          className="mt-6 grid grid-cols-1 items-end gap-6 sm:grid-cols-[1fr_1fr_auto]"
        >
          <label className="block">
            <span className="text-sm tracking-wide text-foreground/50 uppercase">
              Name
            </span>
            <input
              type="text"
              required
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Jamie Rivera"
              className="mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-foreground/40 placeholder:italic focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm tracking-wide text-foreground/50 uppercase">
              Email
            </span>
            <input
              type="email"
              required
              value={guestEmail}
              onChange={(event) => setGuestEmail(event.target.value)}
              placeholder="jamie@example.com"
              className="mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-foreground/40 placeholder:italic focus:border-accent focus:outline-none"
            />
          </label>

          <button
            type="submit"
            className="shrink-0 border border-accent px-5 py-2 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
          >
            Add Guest
          </button>
        </form>

        <div className="mt-8 flex gap-8 border-b border-foreground/10">
          {GUEST_TABS.map((tab) => {
            const isActive = tab.status === guestTab;
            const count =
              tab.status === "all"
                ? guests.length
                : guests.filter((guest) => guest.rsvpStatus === tab.status)
                    .length;
            return (
              <button
                key={tab.status}
                type="button"
                onClick={() => setGuestTab(tab.status)}
                className={`-mb-px border-b-2 pb-3 text-sm tracking-wide uppercase transition-colors ${
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-foreground/50 hover:text-accent"
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        {(() => {
          const activeTab = GUEST_TABS.find((tab) => tab.status === guestTab)!;
          const tabGuests =
            guestTab === "all"
              ? guests
              : guests.filter((guest) => guest.rsvpStatus === guestTab);

          return tabGuests.length === 0 ? (
            <div className="flex min-h-[15vh] items-center justify-center text-center font-serif text-lg text-foreground/50 italic">
              {activeTab.emptyMessage}
            </div>
          ) : (
            <div className="mt-8 divide-y divide-foreground/10 border-t border-foreground/10">
              {tabGuests.map((guest) => (
                <div
                  key={guest.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <p className="font-serif text-lg text-foreground">
                    {guest.name}
                  </p>
                  <select
                    value={guest.rsvpStatus}
                    onChange={(event) =>
                      handleRsvpStatusChange(
                        guest.id,
                        event.target.value as Guest["rsvpStatus"]
                      )
                    }
                    className="border-b border-foreground/10 bg-transparent py-1 text-xs tracking-wide text-accent uppercase focus:border-accent focus:outline-none"
                  >
                    {RSVP_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      <div className="mt-12 flex items-center justify-between gap-4">
        <h2 className="font-serif text-2xl text-foreground">Notes to Self</h2>
        <span
          className={`text-xs tracking-wide text-accent uppercase transition-opacity ${
            showSaved ? "opacity-100" : "opacity-0"
          }`}
        >
          Saved
        </span>
      </div>
      <p className="mt-1 text-sm text-foreground/50 italic">
        Jot down your private notes from this Experience so you can revisit
        them later
      </p>

      <div className="note-editor mt-4">
        <ReactQuill
          theme="snow"
          value={note}
          onChange={(value) => handleNoteChange(value)}
          modules={NOTE_TOOLBAR_MODULES}
          formats={NOTE_FORMATS}
          placeholder="Jot down private notes about this experience..."
        />
      </div>
    </main>
  );
}
