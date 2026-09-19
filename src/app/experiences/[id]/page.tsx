"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getExperiences } from "@/data/experiencesStore";
import { getItineraryItems } from "@/data/itineraryStore";
import { getNote, saveNote } from "@/data/notesStore";
import { addGuest, getGuests, updateGuestStatus } from "@/data/guestsStore";
import {
  addTravelDetail,
  getTravelDetails,
  updateTravelDetail,
} from "@/data/travelDetailsStore";
import { addUpdate, getUpdates } from "@/data/updatesStore";
import { addFaq, getFaqs } from "@/data/faqsStore";
import {
  addPoll,
  getPolls,
  getVotedPollIds,
  markPollVoted,
  recordVote,
} from "@/data/pollsStore";
import Modal from "@/components/Modal";

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
type GuestTabStatus = Guest["rsvpStatus"] | "all" | "directory";

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
  {
    label: "Attendee Directory",
    status: "directory",
    emptyMessage: "No confirmed attendees yet",
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
  everConfirmed?: boolean;
};

type Update = {
  id: number;
  experienceId: string;
  message: string;
  timestamp: string;
};

type Faq = {
  id: number;
  experienceId: string;
  question: string;
  answer: string;
};

type Poll = {
  id: number;
  experienceId: string;
  question: string;
  options: string[];
  votes: Record<string, number>;
};

const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = 5;

type FlightDetail = {
  id: number;
  experienceId: string;
  type: "flight";
  guestName?: string;
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureDate?: string;
  departureTime?: string;
  arrivalDate: string;
  arrivalTime: string;
};

type HotelDetail = {
  id: number;
  experienceId: string;
  type: "hotel";
  hotelName: string;
  address: string;
  checkInDate: string;
  checkOutDate: string;
  confirmationNumber?: string;
};

type TransportDetail = {
  id: number;
  experienceId: string;
  type: "transport";
  description: string;
  pickupLocation: string;
  pickupDate: string;
  pickupTime: string;
  notes?: string;
};

type TravelDetail = FlightDetail | HotelDetail | TransportDetail;

const TRAVEL_DETAIL_GROUPS: {
  label: string;
  type: TravelDetail["type"];
}[] = [
  { label: "Flights", type: "flight" },
  { label: "Hotels", type: "hotel" },
  { label: "Transport", type: "transport" },
];

const TRAVEL_FIELD_CLASSES =
  "mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-foreground/40 placeholder:italic focus:border-accent focus:outline-none";
const TRAVEL_LABEL_CLASSES = "text-sm tracking-wide text-foreground/50 uppercase";

// Parses a plain "YYYY-MM-DD" string as a local calendar date instead of
// letting `new Date(string)` treat it as UTC, which can shift the date by
// one day depending on the viewer's timezone offset. Returns null if the
// value is missing instead of crashing.
function parseLocalDate(dateString: string | undefined | null) {
  if (!dateString) return null;

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

  if (!start || !end) return "";

  if (startDate === endDate) {
    return start.toLocaleDateString("en-US", opts);
  }

  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString(
    "en-US",
    opts
  )}`;
}

function formatDateHeading(date: string) {
  const parsed = parseLocalDate(date);
  if (!parsed) return "";

  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatSingleDate(dateString: string | undefined) {
  const parsed = parseLocalDate(dateString);
  if (!parsed) return "";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

function formatRelativeTime(timestamp: string) {
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

function getMapsUrl(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    location
  )}`;
}

function addOneDay(dateString: string) {
  const date = parseLocalDate(dateString);
  if (!date) return dateString;

  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function combineDateAndTime(dateString: string, timeString: string | undefined) {
  const date = parseLocalDate(dateString);
  if (!date || !timeString) return null;

  const [hours, minutes] = timeString.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  date.setHours(hours, minutes, 0, 0);
  return date;
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

function collapsedSectionsStorageKey(experienceId: string) {
  return `yhtbt:collapsedSections:${experienceId}`;
}

function loadCollapsedSections(experienceId: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};

  const raw = window.localStorage.getItem(
    collapsedSectionsStorageKey(experienceId)
  );
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveCollapsedSections(
  experienceId: string,
  collapsedSections: Record<string, boolean>
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    collapsedSectionsStorageKey(experienceId),
    JSON.stringify(collapsedSections)
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
        collapsed ? "-rotate-90" : ""
      }`}
    >
      <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
  const [travelDetails, setTravelDetails] = useState<TravelDetail[]>([]);
  const [travelDetailType, setTravelDetailType] =
    useState<TravelDetail["type"]>("flight");
  // Flight fields
  const [flightGuestName, setFlightGuestName] = useState("");
  const [airline, setAirline] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [departureAirport, setDepartureAirport] = useState("");
  const [arrivalAirport, setArrivalAirport] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  // Hotel fields
  const [hotelName, setHotelName] = useState("");
  const [hotelAddress, setHotelAddress] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  // Tracks whether checkOutDate should keep following checkInDate. Stays
  // true until the user manually sets checkOutDate to something other
  // than checkInDate, at which point their multi-night stay is respected.
  const [isCheckOutDateAutoSynced, setIsCheckOutDateAutoSynced] =
    useState(true);
  const [confirmationNumber, setConfirmationNumber] = useState("");
  // Transport fields
  const [transportDescription, setTransportDescription] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [transportNotes, setTransportNotes] = useState("");
  const [travelDetailError, setTravelDetailError] = useState("");
  const [editingTravelDetailId, setEditingTravelDetailId] = useState<
    number | null
  >(null);
  const [travelDetailEditDraft, setTravelDetailEditDraft] = useState<
    Record<string, string>
  >({});
  const [travelDetailEditError, setTravelDetailEditError] = useState("");
  const [note, setNote] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  // Local-only, resets on every page load; purely a visual preview, not
  // real access control.
  const [isPreviewingAsGuest, setIsPreviewingAsGuest] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [coverImageError, setCoverImageError] = useState(false);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [updateMessage, setUpdateMessage] = useState("");
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votedPollIds, setVotedPollIds] = useState<number[]>([]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isTravelDetailModalOpen, setIsTravelDetailModalOpen] =
    useState(false);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 0);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const experiences = getExperiences();
    const found = experiences.find(
      (item: Experience) => String(item.id) === params.id
    );
    setExperience(found ?? null);
    setCoverImageError(false);
    setItineraryItems(getItineraryItems(params.id));
    setGuests(getGuests(params.id));
    setTravelDetails(getTravelDetails(params.id));
    setNote(getNote(params.id));
    setCollapsedSections(loadCollapsedSections(params.id));
    setUpdates(getUpdates(params.id));
    setFaqs(getFaqs(params.id));
    setPolls(getPolls(params.id));
    setVotedPollIds(getVotedPollIds());
  }, [params.id]);

  function toggleSection(section: string) {
    setCollapsedSections((current) => {
      const next = { ...current, [section]: !current[section] };
      saveCollapsedSections(params.id, next);
      return next;
    });
  }

  function handleAddUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newUpdate = addUpdate({
      experienceId: params.id,
      message: updateMessage,
    });

    setUpdates((current) => [newUpdate, ...current]);
    setUpdateMessage("");
  }

  function handleAddFaq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newFaq = addFaq({
      experienceId: params.id,
      question: faqQuestion,
      answer: faqAnswer,
    });

    setFaqs((current) => [...current, newFaq]);
    setFaqQuestion("");
    setFaqAnswer("");
    setIsFaqModalOpen(false);
  }

  function handleCloseFaqModal() {
    setIsFaqModalOpen(false);
    setFaqQuestion("");
    setFaqAnswer("");
  }

  function handlePollOptionChange(index: number, value: string) {
    setPollOptions((current) =>
      current.map((option, i) => (i === index ? value : option))
    );
  }

  function handleAddPollOption() {
    setPollOptions((current) =>
      current.length >= MAX_POLL_OPTIONS ? current : [...current, ""]
    );
  }

  function handleClosePollModal() {
    setIsPollModalOpen(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
  }

  function handleAddPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedOptions = pollOptions
      .map((option) => option.trim())
      .filter(Boolean);
    if (trimmedOptions.length < MIN_POLL_OPTIONS) return;

    const newPoll = addPoll({
      experienceId: params.id,
      question: pollQuestion,
      options: trimmedOptions,
    });

    setPolls((current) => [...current, newPoll]);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setIsPollModalOpen(false);
  }

  function handleVote(pollId: number, option: string) {
    if (votedPollIds.includes(pollId)) return;

    const updatedPoll = recordVote(pollId, option);
    if (!updatedPoll) return;

    setPolls((current) =>
      current.map((poll) => (poll.id === pollId ? updatedPoll : poll))
    );
    markPollVoted(pollId);
    setVotedPollIds((current) => [...current, pollId]);
  }

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
    setIsGuestModalOpen(false);
  }

  function handleCloseGuestModal() {
    setIsGuestModalOpen(false);
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

  function handleCheckInDateChange(value: string) {
    setCheckInDate(value);

    if (isCheckOutDateAutoSynced) {
      const nextCheckOutDate = addOneDay(value);
      setCheckOutDate(nextCheckOutDate);
      setTravelDetailError("");
      return;
    }

    setTravelDetailError(
      checkOutDate && checkOutDate < value
        ? "Check-out date must be on or after the check-in date."
        : ""
    );
  }

  function handleCheckOutDateChange(value: string) {
    setCheckOutDate(value);
    // Sync targets checkInDate + 1 day; once the user picks anything
    // else, respect their manually-chosen stay length going forward.
    if (value !== addOneDay(checkInDate)) setIsCheckOutDateAutoSynced(false);

    setTravelDetailError(
      checkInDate && value < checkInDate
        ? "Check-out date must be on or after the check-in date."
        : ""
    );
  }

  function handleAddTravelDetail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (travelDetailType === "flight" && departureDate) {
      const departureDateTime = `${departureDate}T${departureTime || "00:00"}`;
      const arrivalDateTime = `${arrivalDate}T${arrivalTime}`;
      if (arrivalDateTime < departureDateTime) {
        setTravelDetailError(
          "Arrival must be on or after departure."
        );
        return;
      }
    }

    if (travelDetailType === "hotel" && checkOutDate < checkInDate) {
      setTravelDetailError(
        "Check-out date must be on or after the check-in date."
      );
      return;
    }

    setTravelDetailError("");

    let newEntry: TravelDetail;

    if (travelDetailType === "flight") {
      newEntry = addTravelDetail({
        experienceId: params.id,
        type: "flight",
        guestName: flightGuestName,
        airline,
        flightNumber,
        departureAirport,
        arrivalAirport,
        departureDate,
        departureTime,
        arrivalDate,
        arrivalTime,
      });
      setFlightGuestName("");
      setAirline("");
      setFlightNumber("");
      setDepartureAirport("");
      setArrivalAirport("");
      setDepartureDate("");
      setDepartureTime("");
      setArrivalDate("");
      setArrivalTime("");
    } else if (travelDetailType === "hotel") {
      newEntry = addTravelDetail({
        experienceId: params.id,
        type: "hotel",
        hotelName,
        address: hotelAddress,
        checkInDate,
        checkOutDate,
        confirmationNumber,
      });
      setHotelName("");
      setHotelAddress("");
      setCheckInDate("");
      setCheckOutDate("");
      setIsCheckOutDateAutoSynced(true);
      setConfirmationNumber("");
    } else {
      newEntry = addTravelDetail({
        experienceId: params.id,
        type: "transport",
        description: transportDescription,
        pickupLocation,
        pickupDate,
        pickupTime,
        notes: transportNotes,
      });
      setTransportDescription("");
      setPickupLocation("");
      setPickupDate("");
      setPickupTime("");
      setTransportNotes("");
    }

    setTravelDetails((current) => [...current, newEntry]);
    setIsTravelDetailModalOpen(false);
  }

  function handleCloseTravelDetailModal() {
    setIsTravelDetailModalOpen(false);
    setFlightGuestName("");
    setAirline("");
    setFlightNumber("");
    setDepartureAirport("");
    setArrivalAirport("");
    setDepartureDate("");
    setDepartureTime("");
    setArrivalDate("");
    setArrivalTime("");
    setHotelName("");
    setHotelAddress("");
    setCheckInDate("");
    setCheckOutDate("");
    setIsCheckOutDateAutoSynced(true);
    setConfirmationNumber("");
    setTransportDescription("");
    setPickupLocation("");
    setPickupDate("");
    setPickupTime("");
    setTransportNotes("");
    setTravelDetailError("");
  }

  function handleStartEditTravelDetail(entry: TravelDetail) {
    setEditingTravelDetailId(entry.id);
    setTravelDetailEditError("");

    if (entry.type === "flight") {
      setTravelDetailEditDraft({
        guestName: entry.guestName ?? "",
        airline: entry.airline,
        flightNumber: entry.flightNumber,
        departureAirport: entry.departureAirport,
        arrivalAirport: entry.arrivalAirport,
        departureDate: entry.departureDate ?? "",
        departureTime: entry.departureTime ?? "",
        arrivalDate: entry.arrivalDate,
        arrivalTime: entry.arrivalTime,
      });
    } else if (entry.type === "hotel") {
      setTravelDetailEditDraft({
        hotelName: entry.hotelName,
        address: entry.address,
        checkInDate: entry.checkInDate,
        checkOutDate: entry.checkOutDate,
        confirmationNumber: entry.confirmationNumber ?? "",
      });
    } else {
      setTravelDetailEditDraft({
        description: entry.description,
        pickupLocation: entry.pickupLocation,
        pickupDate: entry.pickupDate,
        pickupTime: entry.pickupTime,
        notes: entry.notes ?? "",
      });
    }
  }

  function handleTravelDetailEditDraftChange(field: string, value: string) {
    setTravelDetailEditDraft((current) => ({ ...current, [field]: value }));
  }

  function handleCancelEditTravelDetail() {
    setEditingTravelDetailId(null);
    setTravelDetailEditDraft({});
    setTravelDetailEditError("");
  }

  function handleSaveEditTravelDetail(entry: TravelDetail) {
    const draft = travelDetailEditDraft;

    if (entry.type === "hotel" && draft.checkOutDate < draft.checkInDate) {
      setTravelDetailEditError(
        "Check-out date must be on or after the check-in date."
      );
      return;
    }

    if (entry.type === "flight" && draft.departureDate) {
      const departureDateTime = `${draft.departureDate}T${draft.departureTime || "00:00"}`;
      const arrivalDateTime = `${draft.arrivalDate}T${draft.arrivalTime}`;
      if (arrivalDateTime < departureDateTime) {
        setTravelDetailEditError("Arrival must be on or after departure.");
        return;
      }
    }

    const updatedEntry = updateTravelDetail(entry.id, draft);
    if (updatedEntry) {
      setTravelDetails((current) =>
        current.map((item) => (item.id === entry.id ? updatedEntry : item))
      );
    }

    setEditingTravelDetailId(null);
    setTravelDetailEditDraft({});
    setTravelDetailEditError("");
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

  // Live "happening now" / "up next" highlighting only makes sense while
  // the experience is actually underway (today falls within its date
  // range) — otherwise leave the itinerary unhighlighted.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const experienceStartDate = parseLocalDate(experience.startDate);
  const experienceEndDate = parseLocalDate(experience.endDate);
  const isExperienceOngoingToday =
    !!experienceStartDate &&
    !!experienceEndDate &&
    today >= experienceStartDate &&
    today <= experienceEndDate;

  let happeningNowItemId: number | null = null;
  let upNextItemId: number | null = null;

  if (isExperienceOngoingToday) {
    const flatItineraryItems = groupedItinerary.flatMap((group) => group.items);

    for (const item of flatItineraryItems) {
      const start = combineDateAndTime(item.date, item.startTime ?? item.time);
      const end = combineDateAndTime(item.date, item.endTime ?? item.time);
      if (!start || !end) continue;
      if (now >= start && now <= end) {
        happeningNowItemId = item.id;
        break;
      }
    }

    if (happeningNowItemId === null) {
      let soonestStart: Date | null = null;
      for (const item of flatItineraryItems) {
        const start = combineDateAndTime(item.date, item.startTime ?? item.time);
        if (!start || start <= now) continue;
        if (!soonestStart || start < soonestStart) {
          soonestStart = start;
          upNextItemId = item.id;
        }
      }
    }
  }

  return (
    <>
      <div className="relative h-64 w-full overflow-hidden sm:h-80">
        {experience.coverImage && !coverImageError ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={experience.coverImage}
              alt={experience.name}
              onError={() => setCoverImageError(true)}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-accent/15 via-background to-accent/5" />
        )}
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
      <div
        className={`sticky top-0 z-10 bg-background pb-4 transition-shadow duration-200 ${
          isScrolled
            ? "border-b border-foreground/10 shadow-sm"
            : "border-b border-transparent"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="inline-block border border-accent/30 bg-accent/5 px-2.5 py-1 text-xs tracking-widest text-accent uppercase">
            {isPreviewingAsGuest ? "Previewing as: Guest" : "Host View"}
          </span>
          <button
            type="button"
            onClick={() => setIsPreviewingAsGuest((current) => !current)}
            className="text-sm text-foreground/50 underline underline-offset-2 transition-colors hover:text-accent"
          >
            {isPreviewingAsGuest ? "Switch to Host View" : "Preview as Guest"}
          </button>
        </div>

        <div className="mt-3 flex items-baseline gap-3">
          <h1 className="font-serif text-3xl text-foreground sm:text-4xl">
            {experience.name}
          </h1>
          {isPreviewingAsGuest ? null : (
            <Link
              href={`/experiences/${params.id}/edit`}
              className="shrink-0 text-sm text-foreground/50 underline underline-offset-2 transition-colors hover:text-accent"
            >
              Edit
            </Link>
          )}
        </div>
        <p className="mt-2 text-sm text-foreground/60">
          {formatDateRange(experience.startDate, experience.endDate)}
          {experience.location ? ` · ${experience.location}` : ""}
        </p>
      </div>

      <div className="mt-12">
        <h2 className="font-serif text-2xl text-foreground">
          <button
            type="button"
            onClick={() => toggleSection("itinerary")}
            className="flex items-center gap-2 text-left"
          >
            <ChevronIcon collapsed={!!collapsedSections.itinerary} />
            Itinerary
          </button>
        </h2>
      </div>

      {collapsedSections.itinerary ? null : (
        <>
          {isPreviewingAsGuest ? null : (
          <div className="mt-6 flex justify-end">
            <Link
              href={`/experiences/${params.id}/itinerary/new`}
              className="shrink-0 border border-accent px-5 py-2 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
            >
              Add Itinerary Item
            </Link>
          </div>
          )}

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
                {group.items.map((item) => {
                  const isHappeningNow = item.id === happeningNowItemId;
                  const isUpNext = item.id === upNextItemId;

                  return (
                  <div
                    key={item.id}
                    className={`grid grid-cols-1 gap-2 border-l-2 py-1 pl-4 transition-colors sm:grid-cols-[auto_1fr_auto] sm:gap-6 ${
                      isHappeningNow
                        ? "border-accent bg-accent/5"
                        : isUpNext
                          ? "border-accent/40"
                          : "border-transparent"
                    }`}
                  >
                    <p className="text-sm text-foreground/60 whitespace-nowrap sm:w-44 sm:shrink-0">
                      {formatTimeRange(item)}
                    </p>
                    <div>
                      {isHappeningNow || isUpNext ? (
                        <span className="mb-1 inline-block border border-accent/30 bg-accent/5 px-2 py-0.5 text-xs tracking-widest text-accent uppercase">
                          {isHappeningNow ? "Happening Now" : "Up Next"}
                        </span>
                      ) : null}
                      <div className="flex items-baseline gap-2">
                        <p className="font-serif text-lg text-foreground">
                          {item.title}
                        </p>
                        {isPreviewingAsGuest ? null : (
                        <Link
                          href={`/experiences/${params.id}/itinerary/${item.id}/edit`}
                          className="shrink-0 text-xs text-foreground/50 underline underline-offset-2 transition-colors hover:text-accent"
                        >
                          Edit
                        </Link>
                        )}
                      </div>
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
                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        <p className="text-sm text-foreground/60 sm:text-right">
                          {item.location}
                        </p>
                        <a
                          href={getMapsUrl(item.location)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-foreground/50 underline underline-offset-2 transition-colors hover:text-accent"
                        >
                          Open in Maps
                        </a>
                      </div>
                    ) : null}
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      <div className="mt-12">
        <h2 className="font-serif text-2xl text-foreground">
          <button
            type="button"
            onClick={() => toggleSection("updates")}
            className="flex items-center gap-2 text-left"
          >
            <ChevronIcon collapsed={!!collapsedSections.updates} />
            Updates
          </button>
        </h2>

        {collapsedSections.updates ? null : (
          <>
            {isPreviewingAsGuest ? null : (
            <form
              onSubmit={handleAddUpdate}
              className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end"
            >
              <label className="block flex-1">
                <span className="text-sm tracking-wide text-foreground/50 uppercase">
                  New Update
                </span>
                <input
                  type="text"
                  required
                  value={updateMessage}
                  onChange={(event) => setUpdateMessage(event.target.value)}
                  placeholder="The dinner start time moved to 7pm..."
                  className="mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-foreground/40 placeholder:italic focus:border-accent focus:outline-none"
                />
              </label>

              <button
                type="submit"
                className="shrink-0 border border-accent px-6 py-2 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
              >
                Post
              </button>
            </form>
            )}

            {updates.length === 0 ? (
              <div className="flex min-h-[15vh] items-center justify-center text-center font-serif text-lg text-foreground/50 italic">
                No updates yet
              </div>
            ) : (
              <div className="mt-10 flex flex-col gap-8">
                {updates.map((update) => (
                  <div
                    key={update.id}
                    className="border-b border-foreground/10 pb-8 last:border-b-0"
                  >
                    <p className="font-serif text-lg text-foreground">
                      {update.message}
                    </p>
                    <p className="mt-1 text-sm text-foreground/60">
                      {formatRelativeTime(update.timestamp)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-12">
        <h2 className="font-serif text-2xl text-foreground">
          <button
            type="button"
            onClick={() => toggleSection("faqs")}
            className="flex items-center gap-2 text-left"
          >
            <ChevronIcon collapsed={!!collapsedSections.faqs} />
            FAQs
          </button>
        </h2>

        {collapsedSections.faqs ? null : (
          <>
            {isPreviewingAsGuest ? null : (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsFaqModalOpen(true)}
                className="shrink-0 border border-accent px-5 py-2 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
              >
                Add FAQ
              </button>
            </div>
            )}

            <Modal
              isOpen={isFaqModalOpen}
              onClose={handleCloseFaqModal}
              title="Add FAQ"
            >
              <form
                onSubmit={handleAddFaq}
                className="flex flex-col gap-6"
              >
                <label className="block">
                  <span className="text-sm tracking-wide text-foreground/50 uppercase">
                    Question
                  </span>
                  <input
                    type="text"
                    required
                    value={faqQuestion}
                    onChange={(event) => setFaqQuestion(event.target.value)}
                    placeholder="Is there parking on site?"
                    className="mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-foreground/40 placeholder:italic focus:border-accent focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-sm tracking-wide text-foreground/50 uppercase">
                    Answer
                  </span>
                  <textarea
                    required
                    rows={3}
                    value={faqAnswer}
                    onChange={(event) => setFaqAnswer(event.target.value)}
                    className="mt-2 w-full resize-none border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-foreground/40 placeholder:italic focus:border-accent focus:outline-none"
                  />
                </label>

                <button
                  type="submit"
                  className="mt-2 self-start border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
                >
                  Add FAQ
                </button>
              </form>
            </Modal>

            {faqs.length === 0 ? (
              <div className="flex min-h-[15vh] items-center justify-center text-center font-serif text-lg text-foreground/50 italic">
                No FAQs yet
              </div>
            ) : (
              <div className="mt-10 flex flex-col gap-8">
                {faqs.map((faq) => (
                  <div
                    key={faq.id}
                    className="border-b border-foreground/10 pb-8 last:border-b-0"
                  >
                    <p className="font-serif text-lg text-foreground">
                      {faq.question}
                    </p>
                    <p className="mt-1 text-sm text-foreground/60">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-12">
        <h2 className="font-serif text-2xl text-foreground">
          <button
            type="button"
            onClick={() => toggleSection("polls")}
            className="flex items-center gap-2 text-left"
          >
            <ChevronIcon collapsed={!!collapsedSections.polls} />
            Polls
          </button>
        </h2>

        {collapsedSections.polls ? null : (
          <>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPollModalOpen(true)}
                className="shrink-0 border border-accent px-5 py-2 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
              >
                Add Poll
              </button>
            </div>

            <Modal
              isOpen={isPollModalOpen}
              onClose={handleClosePollModal}
              title="Add Poll"
            >
              <form onSubmit={handleAddPoll} className="flex flex-col gap-6">
                <label className="block">
                  <span className="text-sm tracking-wide text-foreground/50 uppercase">
                    Question
                  </span>
                  <input
                    type="text"
                    required
                    value={pollQuestion}
                    onChange={(event) => setPollQuestion(event.target.value)}
                    placeholder="Where should we go for the group dinner?"
                    className="mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-foreground/40 placeholder:italic focus:border-accent focus:outline-none"
                  />
                </label>

                <div className="flex flex-col gap-4">
                  <span className="text-sm tracking-wide text-foreground/50 uppercase">
                    Options
                  </span>
                  {pollOptions.map((option, index) => (
                    <input
                      key={index}
                      type="text"
                      required
                      value={option}
                      onChange={(event) =>
                        handlePollOptionChange(index, event.target.value)
                      }
                      placeholder={`Option ${index + 1}`}
                      className="w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-foreground/40 placeholder:italic focus:border-accent focus:outline-none"
                    />
                  ))}

                  {pollOptions.length < MAX_POLL_OPTIONS ? (
                    <button
                      type="button"
                      onClick={handleAddPollOption}
                      className="self-start text-sm text-foreground/50 underline underline-offset-2 transition-colors hover:text-accent"
                    >
                      + Add another option
                    </button>
                  ) : null}
                </div>

                <button
                  type="submit"
                  className="mt-2 self-start border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
                >
                  Add Poll
                </button>
              </form>
            </Modal>

            {polls.length === 0 ? (
              <div className="flex min-h-[15vh] items-center justify-center text-center font-serif text-lg text-foreground/50 italic">
                No polls yet
              </div>
            ) : (
              <div className="mt-10 flex flex-col gap-8">
                {polls.map((poll) => {
                  const hasVoted = votedPollIds.includes(poll.id);
                  const totalVotes = Object.values(poll.votes).reduce(
                    (sum, count) => sum + count,
                    0
                  );

                  return (
                    <div
                      key={poll.id}
                      className="border-b border-foreground/10 pb-8 last:border-b-0"
                    >
                      <p className="font-serif text-lg text-foreground">
                        {poll.question}
                      </p>
                      <div className="mt-4 flex flex-col gap-3">
                        {poll.options.map((option) => {
                          const count = poll.votes[option] ?? 0;
                          const percentage =
                            totalVotes === 0
                              ? 0
                              : Math.round((count / totalVotes) * 100);

                          if (!hasVoted) {
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => handleVote(poll.id, option)}
                                className="border border-foreground/10 px-4 py-3 text-left font-serif text-lg text-foreground transition-colors hover:border-accent hover:text-accent"
                              >
                                {option}
                              </button>
                            );
                          }

                          return (
                            <div key={option}>
                              <div className="flex items-center justify-between gap-4">
                                <span className="font-serif text-lg text-foreground">
                                  {option}
                                </span>
                                <span className="shrink-0 text-sm text-foreground/60">
                                  {count} ({percentage}%)
                                </span>
                              </div>
                              <div className="mt-1 h-2 w-full bg-foreground/10">
                                <div
                                  className="h-2 bg-accent"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-12">
        <h2 className="font-serif text-2xl text-foreground">
          <button
            type="button"
            onClick={() => toggleSection("guests")}
            className="flex items-center gap-2 text-left"
          >
            <ChevronIcon collapsed={!!collapsedSections.guests} />
            Guests
          </button>
        </h2>

        {collapsedSections.guests ? null : (
        <>
        {isPreviewingAsGuest ? null : (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setIsGuestModalOpen(true)}
            className="shrink-0 border border-accent px-5 py-2 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
          >
            Add Guest
          </button>
        </div>
        )}

        <Modal
          isOpen={isGuestModalOpen}
          onClose={handleCloseGuestModal}
          title="Add Guest"
        >
          <form
            onSubmit={handleAddGuest}
            className="flex flex-col gap-6"
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
              className="mt-2 self-start border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
            >
              Add Guest
            </button>
          </form>
        </Modal>

        {isPreviewingAsGuest ? null : (
        <div className="mt-8 flex gap-8 border-b border-foreground/10">
          {GUEST_TABS.map((tab) => {
            const isActive = tab.status === guestTab;
            const count =
              tab.status === "all"
                ? guests.length
                : tab.status === "directory"
                  ? guests.filter((guest) => guest.everConfirmed).length
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
        )}

        {(() => {
          const effectiveGuestTab = isPreviewingAsGuest
            ? "directory"
            : guestTab;
          const activeTab = GUEST_TABS.find(
            (tab) => tab.status === effectiveGuestTab
          )!;

          if (effectiveGuestTab === "directory") {
            const confirmedGuests = guests.filter(
              (guest) => guest.everConfirmed
            );

            return confirmedGuests.length === 0 ? (
              <div className="flex min-h-[15vh] items-center justify-center text-center font-serif text-lg text-foreground/50 italic">
                {activeTab.emptyMessage}
              </div>
            ) : (
              <div className="mt-8 divide-y divide-foreground/10 border-t border-foreground/10">
                {confirmedGuests.map((guest) => (
                  <p
                    key={guest.id}
                    className="py-3 font-serif text-lg text-foreground"
                  >
                    {guest.name}
                  </p>
                ))}
              </div>
            );
          }

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
        </>
        )}
      </div>

      <div className="mt-12">
        <h2 className="font-serif text-2xl text-foreground">
          <button
            type="button"
            onClick={() => toggleSection("travelDetails")}
            className="flex items-center gap-2 text-left"
          >
            <ChevronIcon collapsed={!!collapsedSections.travelDetails} />
            Travel Details
          </button>
        </h2>

        {collapsedSections.travelDetails ? null : (
        <>
        {isPreviewingAsGuest ? null : (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setIsTravelDetailModalOpen(true)}
            className="shrink-0 border border-accent px-5 py-2 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
          >
            Add Travel Detail
          </button>
        </div>
        )}

        <Modal
          isOpen={isTravelDetailModalOpen}
          onClose={handleCloseTravelDetailModal}
          title="Add Travel Detail"
        >
        <form
          onSubmit={handleAddTravelDetail}
          className="flex flex-col gap-6"
        >
          <label className="block">
            <span className={TRAVEL_LABEL_CLASSES}>Type</span>
            <select
              value={travelDetailType}
              onChange={(event) =>
                setTravelDetailType(
                  event.target.value as TravelDetail["type"]
                )
              }
              className={TRAVEL_FIELD_CLASSES}
            >
              <option value="flight">Flight</option>
              <option value="hotel">Hotel</option>
              <option value="transport">Transport</option>
            </select>
          </label>

          {travelDetailType === "flight" ? (
            <>
              <label className="block">
                <span className={TRAVEL_LABEL_CLASSES}>
                  Guest Name (Optional)
                </span>
                <input
                  type="text"
                  list="guest-name-options"
                  value={flightGuestName}
                  onChange={(event) => setFlightGuestName(event.target.value)}
                  placeholder="Amina"
                  className={TRAVEL_FIELD_CLASSES}
                />
                <datalist id="guest-name-options">
                  {guests.map((guest) => (
                    <option key={guest.id} value={guest.name} />
                  ))}
                </datalist>
              </label>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className={TRAVEL_LABEL_CLASSES}>Airline</span>
                  <input
                    type="text"
                    required
                    value={airline}
                    onChange={(event) => setAirline(event.target.value)}
                    placeholder="United"
                    className={TRAVEL_FIELD_CLASSES}
                  />
                </label>

                <label className="block">
                  <span className={TRAVEL_LABEL_CLASSES}>Flight Number</span>
                  <input
                    type="text"
                    required
                    value={flightNumber}
                    onChange={(event) => setFlightNumber(event.target.value)}
                    placeholder="1234"
                    className={TRAVEL_FIELD_CLASSES}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className={TRAVEL_LABEL_CLASSES}>
                    Departure Airport
                  </span>
                  <input
                    type="text"
                    required
                    value={departureAirport}
                    onChange={(event) =>
                      setDepartureAirport(event.target.value)
                    }
                    placeholder="SFO"
                    className={TRAVEL_FIELD_CLASSES}
                  />
                </label>

                <label className="block">
                  <span className={TRAVEL_LABEL_CLASSES}>
                    Arrival Airport
                  </span>
                  <input
                    type="text"
                    required
                    value={arrivalAirport}
                    onChange={(event) =>
                      setArrivalAirport(event.target.value)
                    }
                    placeholder="MIA"
                    className={TRAVEL_FIELD_CLASSES}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className={TRAVEL_LABEL_CLASSES}>
                    Departure Date (Optional)
                  </span>
                  <input
                    type="date"
                    value={departureDate}
                    onChange={(event) => setDepartureDate(event.target.value)}
                    className={TRAVEL_FIELD_CLASSES}
                  />
                </label>

                <label className="block">
                  <span className={TRAVEL_LABEL_CLASSES}>
                    Departure Time (Optional)
                  </span>
                  <input
                    type="time"
                    value={departureTime}
                    onChange={(event) => setDepartureTime(event.target.value)}
                    className={TRAVEL_FIELD_CLASSES}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className={TRAVEL_LABEL_CLASSES}>Arrival Date</span>
                  <input
                    type="date"
                    required
                    value={arrivalDate}
                    onChange={(event) => setArrivalDate(event.target.value)}
                    className={TRAVEL_FIELD_CLASSES}
                  />
                </label>

                <label className="block">
                  <span className={TRAVEL_LABEL_CLASSES}>Arrival Time</span>
                  <input
                    type="time"
                    required
                    value={arrivalTime}
                    onChange={(event) => setArrivalTime(event.target.value)}
                    className={TRAVEL_FIELD_CLASSES}
                  />
                </label>
              </div>
            </>
          ) : null}

          {travelDetailType === "hotel" ? (
            <>
              <label className="block">
                <span className={TRAVEL_LABEL_CLASSES}>Hotel Name</span>
                <input
                  type="text"
                  required
                  value={hotelName}
                  onChange={(event) => setHotelName(event.target.value)}
                  placeholder="The Setai"
                  className={TRAVEL_FIELD_CLASSES}
                />
              </label>

              <label className="block">
                <span className={TRAVEL_LABEL_CLASSES}>Address</span>
                <input
                  type="text"
                  required
                  value={hotelAddress}
                  onChange={(event) => setHotelAddress(event.target.value)}
                  placeholder="2001 Collins Ave, Miami Beach, FL"
                  className={TRAVEL_FIELD_CLASSES}
                />
              </label>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className={TRAVEL_LABEL_CLASSES}>Check-In Date</span>
                  <input
                    type="date"
                    required
                    value={checkInDate}
                    onChange={(event) =>
                      handleCheckInDateChange(event.target.value)
                    }
                    className={TRAVEL_FIELD_CLASSES}
                  />
                </label>

                <label className="block">
                  <span className={TRAVEL_LABEL_CLASSES}>Check-Out Date</span>
                  <input
                    type="date"
                    required
                    value={checkOutDate}
                    onChange={(event) =>
                      handleCheckOutDateChange(event.target.value)
                    }
                    className={TRAVEL_FIELD_CLASSES}
                  />
                </label>
              </div>

              <label className="block">
                <span className={TRAVEL_LABEL_CLASSES}>
                  Confirmation Number (Optional)
                </span>
                <input
                  type="text"
                  value={confirmationNumber}
                  onChange={(event) =>
                    setConfirmationNumber(event.target.value)
                  }
                  placeholder="ABC123"
                  className={TRAVEL_FIELD_CLASSES}
                />
              </label>
            </>
          ) : null}

          {travelDetailType === "transport" ? (
            <>
              <label className="block">
                <span className={TRAVEL_LABEL_CLASSES}>Description</span>
                <input
                  type="text"
                  required
                  value={transportDescription}
                  onChange={(event) =>
                    setTransportDescription(event.target.value)
                  }
                  placeholder="Airport shuttle"
                  className={TRAVEL_FIELD_CLASSES}
                />
              </label>

              <label className="block">
                <span className={TRAVEL_LABEL_CLASSES}>
                  Pickup Location
                </span>
                <input
                  type="text"
                  required
                  value={pickupLocation}
                  onChange={(event) =>
                    setPickupLocation(event.target.value)
                  }
                  placeholder="Hotel lobby"
                  className={TRAVEL_FIELD_CLASSES}
                />
              </label>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className={TRAVEL_LABEL_CLASSES}>Pickup Date</span>
                  <input
                    type="date"
                    required
                    value={pickupDate}
                    onChange={(event) => setPickupDate(event.target.value)}
                    className={TRAVEL_FIELD_CLASSES}
                  />
                </label>

                <label className="block">
                  <span className={TRAVEL_LABEL_CLASSES}>Pickup Time</span>
                  <input
                    type="time"
                    required
                    value={pickupTime}
                    onChange={(event) => setPickupTime(event.target.value)}
                    className={TRAVEL_FIELD_CLASSES}
                  />
                </label>
              </div>

              <label className="block">
                <span className={TRAVEL_LABEL_CLASSES}>
                  Notes (Optional)
                </span>
                <input
                  type="text"
                  value={transportNotes}
                  onChange={(event) => setTransportNotes(event.target.value)}
                  placeholder="Driver will text on arrival"
                  className={TRAVEL_FIELD_CLASSES}
                />
              </label>
            </>
          ) : null}

          {travelDetailError ? (
            <p className="text-sm text-red-600">{travelDetailError}</p>
          ) : null}

          <button
            type="submit"
            className="mt-2 self-start border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
          >
            Add Travel Detail
          </button>
        </form>
        </Modal>

        {travelDetails.length === 0 ? (
          <div className="flex min-h-[15vh] items-center justify-center text-center font-serif text-lg text-foreground/50 italic">
            No travel details yet
          </div>
        ) : (
          <div className="mt-10 flex flex-col gap-8">
            {TRAVEL_DETAIL_GROUPS.map((group) => {
              const entries = travelDetails.filter(
                (entry) => entry.type === group.type
              );
              if (entries.length === 0) return null;

              if (group.type === "flight") {
                entries.sort((a, b) => {
                  const flightA = a as FlightDetail;
                  const flightB = b as FlightDetail;
                  if (flightA.arrivalDate !== flightB.arrivalDate) {
                    return flightA.arrivalDate < flightB.arrivalDate ? -1 : 1;
                  }
                  return flightA.arrivalTime < flightB.arrivalTime
                    ? -1
                    : flightA.arrivalTime > flightB.arrivalTime
                      ? 1
                      : 0;
                });
              }

              if (group.type === "transport") {
                entries.sort((a, b) => {
                  const transportA = a as TransportDetail;
                  const transportB = b as TransportDetail;
                  if (transportA.pickupDate !== transportB.pickupDate) {
                    return transportA.pickupDate < transportB.pickupDate
                      ? -1
                      : 1;
                  }
                  return transportA.pickupTime < transportB.pickupTime
                    ? -1
                    : transportA.pickupTime > transportB.pickupTime
                      ? 1
                      : 0;
                });
              }

              return (
                <div key={group.type}>
                  <h3 className="text-sm tracking-wide text-accent uppercase">
                    {group.label}
                  </h3>
                  <div className="mt-4 flex flex-col gap-4 border-t border-foreground/10 pt-4">
                    {entries.map((entry) => {
                      if (editingTravelDetailId === entry.id) {
                        const draft = travelDetailEditDraft;
                        const field = (key: string) => draft[key] ?? "";
                        const onField =
                          (key: string) =>
                          (
                            event: ChangeEvent<
                              HTMLInputElement | HTMLTextAreaElement
                            >
                          ) =>
                            handleTravelDetailEditDraftChange(
                              key,
                              event.target.value
                            );

                        return (
                          <div
                            key={entry.id}
                            className="flex flex-col gap-6 border border-foreground/10 p-4"
                          >
                            {entry.type === "flight" ? (
                              <>
                                <label className="block">
                                  <span className={TRAVEL_LABEL_CLASSES}>
                                    Guest Name (Optional)
                                  </span>
                                  <input
                                    type="text"
                                    value={field("guestName")}
                                    onChange={onField("guestName")}
                                    className={TRAVEL_FIELD_CLASSES}
                                  />
                                </label>
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                  <label className="block">
                                    <span className={TRAVEL_LABEL_CLASSES}>
                                      Airline
                                    </span>
                                    <input
                                      type="text"
                                      required
                                      value={field("airline")}
                                      onChange={onField("airline")}
                                      className={TRAVEL_FIELD_CLASSES}
                                    />
                                  </label>
                                  <label className="block">
                                    <span className={TRAVEL_LABEL_CLASSES}>
                                      Flight Number
                                    </span>
                                    <input
                                      type="text"
                                      required
                                      value={field("flightNumber")}
                                      onChange={onField("flightNumber")}
                                      className={TRAVEL_FIELD_CLASSES}
                                    />
                                  </label>
                                </div>
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                  <label className="block">
                                    <span className={TRAVEL_LABEL_CLASSES}>
                                      Departure Airport
                                    </span>
                                    <input
                                      type="text"
                                      required
                                      value={field("departureAirport")}
                                      onChange={onField("departureAirport")}
                                      className={TRAVEL_FIELD_CLASSES}
                                    />
                                  </label>
                                  <label className="block">
                                    <span className={TRAVEL_LABEL_CLASSES}>
                                      Arrival Airport
                                    </span>
                                    <input
                                      type="text"
                                      required
                                      value={field("arrivalAirport")}
                                      onChange={onField("arrivalAirport")}
                                      className={TRAVEL_FIELD_CLASSES}
                                    />
                                  </label>
                                </div>
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                  <label className="block">
                                    <span className={TRAVEL_LABEL_CLASSES}>
                                      Departure Date (Optional)
                                    </span>
                                    <input
                                      type="date"
                                      value={field("departureDate")}
                                      onChange={onField("departureDate")}
                                      className={TRAVEL_FIELD_CLASSES}
                                    />
                                  </label>
                                  <label className="block">
                                    <span className={TRAVEL_LABEL_CLASSES}>
                                      Departure Time (Optional)
                                    </span>
                                    <input
                                      type="time"
                                      value={field("departureTime")}
                                      onChange={onField("departureTime")}
                                      className={TRAVEL_FIELD_CLASSES}
                                    />
                                  </label>
                                </div>
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                  <label className="block">
                                    <span className={TRAVEL_LABEL_CLASSES}>
                                      Arrival Date
                                    </span>
                                    <input
                                      type="date"
                                      required
                                      value={field("arrivalDate")}
                                      onChange={onField("arrivalDate")}
                                      className={TRAVEL_FIELD_CLASSES}
                                    />
                                  </label>
                                  <label className="block">
                                    <span className={TRAVEL_LABEL_CLASSES}>
                                      Arrival Time
                                    </span>
                                    <input
                                      type="time"
                                      required
                                      value={field("arrivalTime")}
                                      onChange={onField("arrivalTime")}
                                      className={TRAVEL_FIELD_CLASSES}
                                    />
                                  </label>
                                </div>
                              </>
                            ) : null}

                            {entry.type === "hotel" ? (
                              <>
                                <label className="block">
                                  <span className={TRAVEL_LABEL_CLASSES}>
                                    Hotel Name
                                  </span>
                                  <input
                                    type="text"
                                    required
                                    value={field("hotelName")}
                                    onChange={onField("hotelName")}
                                    className={TRAVEL_FIELD_CLASSES}
                                  />
                                </label>
                                <label className="block">
                                  <span className={TRAVEL_LABEL_CLASSES}>
                                    Address
                                  </span>
                                  <input
                                    type="text"
                                    required
                                    value={field("address")}
                                    onChange={onField("address")}
                                    className={TRAVEL_FIELD_CLASSES}
                                  />
                                </label>
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                  <label className="block">
                                    <span className={TRAVEL_LABEL_CLASSES}>
                                      Check-In Date
                                    </span>
                                    <input
                                      type="date"
                                      required
                                      value={field("checkInDate")}
                                      onChange={onField("checkInDate")}
                                      className={TRAVEL_FIELD_CLASSES}
                                    />
                                  </label>
                                  <label className="block">
                                    <span className={TRAVEL_LABEL_CLASSES}>
                                      Check-Out Date
                                    </span>
                                    <input
                                      type="date"
                                      required
                                      value={field("checkOutDate")}
                                      onChange={onField("checkOutDate")}
                                      className={TRAVEL_FIELD_CLASSES}
                                    />
                                  </label>
                                </div>
                                <label className="block">
                                  <span className={TRAVEL_LABEL_CLASSES}>
                                    Confirmation Number (Optional)
                                  </span>
                                  <input
                                    type="text"
                                    value={field("confirmationNumber")}
                                    onChange={onField("confirmationNumber")}
                                    className={TRAVEL_FIELD_CLASSES}
                                  />
                                </label>
                              </>
                            ) : null}

                            {entry.type === "transport" ? (
                              <>
                                <label className="block">
                                  <span className={TRAVEL_LABEL_CLASSES}>
                                    Description
                                  </span>
                                  <input
                                    type="text"
                                    required
                                    value={field("description")}
                                    onChange={onField("description")}
                                    className={TRAVEL_FIELD_CLASSES}
                                  />
                                </label>
                                <label className="block">
                                  <span className={TRAVEL_LABEL_CLASSES}>
                                    Pickup Location
                                  </span>
                                  <input
                                    type="text"
                                    required
                                    value={field("pickupLocation")}
                                    onChange={onField("pickupLocation")}
                                    className={TRAVEL_FIELD_CLASSES}
                                  />
                                </label>
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                  <label className="block">
                                    <span className={TRAVEL_LABEL_CLASSES}>
                                      Pickup Date
                                    </span>
                                    <input
                                      type="date"
                                      required
                                      value={field("pickupDate")}
                                      onChange={onField("pickupDate")}
                                      className={TRAVEL_FIELD_CLASSES}
                                    />
                                  </label>
                                  <label className="block">
                                    <span className={TRAVEL_LABEL_CLASSES}>
                                      Pickup Time
                                    </span>
                                    <input
                                      type="time"
                                      required
                                      value={field("pickupTime")}
                                      onChange={onField("pickupTime")}
                                      className={TRAVEL_FIELD_CLASSES}
                                    />
                                  </label>
                                </div>
                                <label className="block">
                                  <span className={TRAVEL_LABEL_CLASSES}>
                                    Notes (Optional)
                                  </span>
                                  <input
                                    type="text"
                                    value={field("notes")}
                                    onChange={onField("notes")}
                                    className={TRAVEL_FIELD_CLASSES}
                                  />
                                </label>
                              </>
                            ) : null}

                            {travelDetailEditError ? (
                              <p className="text-sm text-red-600">
                                {travelDetailEditError}
                              </p>
                            ) : null}

                            <div className="flex gap-4">
                              <button
                                type="button"
                                onClick={() =>
                                  handleSaveEditTravelDetail(entry)
                                }
                                className="border border-accent px-5 py-2 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditTravelDetail}
                                className="text-sm text-foreground/50 underline underline-offset-2 transition-colors hover:text-accent"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (entry.type === "flight") {
                        const prefix = entry.guestName
                          ? `${entry.guestName}'s flight: `
                          : "";
                        return (
                          <div
                            key={entry.id}
                            className="flex items-start justify-between gap-4"
                          >
                            <p className="font-serif text-lg text-foreground">
                              {prefix}
                              {entry.airline} {entry.flightNumber} —{" "}
                              {entry.departureAirport} to{" "}
                              {entry.arrivalAirport}, arriving{" "}
                              {formatSingleDate(entry.arrivalDate)} at{" "}
                              {formatTime(entry.arrivalTime)}
                            </p>
                            {isPreviewingAsGuest ? null : (
                            <button
                              type="button"
                              onClick={() => handleStartEditTravelDetail(entry)}
                              className="shrink-0 text-xs text-foreground/50 underline underline-offset-2 transition-colors hover:text-accent"
                            >
                              Edit
                            </button>
                            )}
                          </div>
                        );
                      }

                      if (entry.type === "hotel") {
                        return (
                          <div
                            key={entry.id}
                            className="flex items-start justify-between gap-4"
                          >
                            <div>
                              <p className="font-serif text-lg text-foreground">
                                {entry.hotelName}
                              </p>
                              <p className="mt-1 text-sm text-foreground/60">
                                {entry.address}
                              </p>
                              <a
                                href={getMapsUrl(entry.address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-block text-xs text-foreground/50 underline underline-offset-2 transition-colors hover:text-accent"
                              >
                                Open in Maps
                              </a>
                              <p className="mt-1 text-sm text-foreground/60">
                                {formatSingleDate(entry.checkInDate)} –{" "}
                                {formatSingleDate(entry.checkOutDate)}
                                {entry.confirmationNumber
                                  ? ` · Confirmation: ${entry.confirmationNumber}`
                                  : ""}
                              </p>
                            </div>
                            {isPreviewingAsGuest ? null : (
                            <button
                              type="button"
                              onClick={() => handleStartEditTravelDetail(entry)}
                              className="shrink-0 text-xs text-foreground/50 underline underline-offset-2 transition-colors hover:text-accent"
                            >
                              Edit
                            </button>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={entry.id}
                          className="flex items-start justify-between gap-4"
                        >
                          <div>
                            <p className="font-serif text-lg text-foreground">
                              {entry.description}
                            </p>
                            <p className="mt-1 text-sm text-foreground/60">
                              {entry.pickupLocation} ·{" "}
                              {formatSingleDate(entry.pickupDate)} at{" "}
                              {formatTime(entry.pickupTime)}
                            </p>
                            {entry.notes ? (
                              <p className="mt-1 text-sm text-foreground/60">
                                {entry.notes}
                              </p>
                            ) : null}
                          </div>
                          {isPreviewingAsGuest ? null : (
                          <button
                            type="button"
                            onClick={() => handleStartEditTravelDetail(entry)}
                            className="shrink-0 text-xs text-foreground/50 underline underline-offset-2 transition-colors hover:text-accent"
                          >
                            Edit
                          </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>
        )}
      </div>

      {!isPreviewingAsGuest && (
      <>
      <div className="mt-12 flex items-center justify-between gap-4">
        <h2 className="font-serif text-2xl text-foreground">
          <button
            type="button"
            onClick={() => toggleSection("notes")}
            className="flex items-center gap-2 text-left"
          >
            <ChevronIcon collapsed={!!collapsedSections.notes} />
            Notes to Self
          </button>
        </h2>
        <span
          className={`text-xs tracking-wide text-accent uppercase transition-opacity ${
            showSaved ? "opacity-100" : "opacity-0"
          }`}
        >
          Saved
        </span>
      </div>

      {collapsedSections.notes ? null : (
        <>
          <p className="mt-1 text-sm text-foreground/50 italic">
            Jot down your private notes from this Experience so you can
            revisit them later
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
        </>
      )}
      </>
      )}
      </main>
    </>
  );
}
