"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExperiences } from "@/data/experiencesStore";
import { deleteItineraryItem, getItineraryItems } from "@/data/itineraryStore";
import { ItineraryTypeIcon } from "@/components/ItineraryTypeIcon";
import { addGuest, getGuests, updateGuestStatus } from "@/data/guestsStore";
import {
  addTravelDetail,
  deleteTravelDetail,
  getTravelDetails,
  updateTravelDetail,
} from "@/data/travelDetailsStore";
import { addUpdate, getUpdates } from "@/data/updatesStore";
import {
  BOOK_ORDER_STATUSES,
  getBookOrders,
  updateBookOrderStatus,
} from "@/data/bookOrdersStore";
import Modal from "@/components/Modal";
import {
  addDaysToLocalDateString,
  formatDateHeading,
  formatLocalDateString,
  formatRelativeTime,
  formatTime,
  formatTimeRange,
  groupByDate,
  parseLocalDate,
} from "@/lib/format";
import { GUEST_COUNT_FREE_TIER_THRESHOLD } from "@/lib/billing";
import DateRangePickerField, {
  type DateRange,
} from "@/components/DateRangePickerField";
import { computeExperiencePhase, type ExperiencePhase } from "@/lib/experiencePhase";
import ExperienceTabBar, {
  type ExperienceTabId,
} from "@/components/ExperienceTabBar";

// Isolated test view for the new Experience tab navigation — NOT wired
// to replace the real Experience page (/experiences/[id]/page.tsx) yet.
// Itinerary, Guests (+ Travel Details), and Updates render the real
// sections (relocated verbatim from that page); the remaining tabs are
// still placeholders. Safe to delete once the real page adopts this.

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
  // "Attendee Directory" (status: "directory") is deliberately not a
  // selectable tab here — nothing currently distinguishes a live RSVP
  // list from a permanent post-event record, so it was functionally
  // redundant with "Who's Attending". The "directory" status/rendering
  // branch itself still exists below (see effectiveGuestTab) — guest
  // preview mode always shows that view regardless of this tab list,
  // since a guest is never meant to see the host's live RSVP-status tabs.
];


type Experience = {
  id: number;
  name: string;
  coverImage: string;
  startDate: string;
  endDate: string;
  location?: string;
  roles: string[];
  reflectionsEnabled: boolean;
  experienceType?: string;
  paid: boolean;
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
  type?: string;
};

type Guest = {
  id: number;
  experienceId: string;
  name: string;
  email: string;
  phone: string;
  rsvpStatus: "invited" | "confirmed" | "declined";
  everConfirmed?: boolean;
};

type BookOrder = {
  id: number;
  experienceId: string;
  recipientName: string;
  shippingAddress: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  status: string;
  stripeSessionId: string;
  createdAt: string;
};

type Update = {
  id: number;
  experienceId: string;
  message: string;
  timestamp: string;
};




// Tighter when a photo is attached, since the response then shares space
// with the prompt (see the Reflections feed layout below).
// Polaroid card rendering (fixed palette, rotation, tints, truncation)
// lives in src/components/PolaroidCard.tsx, shared with the keepsake page.

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
  "mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-placeholder placeholder:text-sm placeholder:italic focus:border-accent focus:outline-none";
const TRAVEL_LABEL_CLASSES = "text-sm tracking-wide text-muted uppercase";

function formatSingleDate(dateString: string | undefined) {
  const parsed = parseLocalDate(dateString);
  if (!parsed) return "";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getMapsUrl(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    location
  )}`;
}

// Splits a comma-separated location into one line per part, except the
// last two parts (typically city + state/country, e.g. "Tulum, Mexico")
// which join onto one final line together. A location with 2 or fewer
// parts (a single phrase, or already just "City, Country") comes out
// as a single unsplit line — the last-two-joined slice covers the whole
// string in that case, so no separate threshold check is needed.
function formatLocationLines(location: string) {
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];

  const individualParts = parts.slice(0, -2);
  const lastLine = parts.slice(-2).join(", ");
  return [...individualParts, lastLine];
}

function combineDateAndTime(dateString: string, timeString: string | undefined) {
  const date = parseLocalDate(dateString);
  if (!date || !timeString) return null;

  const [hours, minutes] = timeString.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  date.setHours(hours, minutes, 0, 0);
  return date;
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

// Small icon-only actions (itinerary items' Edit/Delete) — deliberately
// lower visual weight than ItineraryTypeIcon's h-4/w-4, since these sit
// on their own dedicated line now rather than needing to read at a
// glance alongside the title.
function EditIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M13.5 3.5l3 3L7 16l-4 1 1-4 9.5-9.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M4 6h12" />
      <path d="M7.5 6V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6" />
      <path d="M5.5 6l.7 9a1 1 0 0 0 1 1h5.6a1 1 0 0 0 1-1l.7-9" />
      <path d="M8.5 9v5M11.5 9v5" />
    </svg>
  );
}

const PHASE_OVERRIDE_OPTIONS: { label: string; value: ExperiencePhase | "actual" }[] = [
  { label: "Actual (computed)", value: "actual" },
  { label: "Before", value: "before" },
  { label: "During", value: "during" },
  { label: "After", value: "after" },
];

const TAB_ORDER_FOR_DEFAULT: Record<ExperiencePhase, ExperienceTabId[]> = {
  before: ["itinerary", "guests", "updates", "chat", "details", "photos", "notes", "hostTools"],
  during: ["chat", "updates", "itinerary", "photos", "notes", "guests", "details", "hostTools"],
  after: ["photos", "chat", "hostTools", "notes", "itinerary", "guests", "updates", "details"],
};

const TAB_PLACEHOLDER_TEXT: Partial<Record<ExperienceTabId, string>> = {
  chat: "Placeholder: the group conversation will live here.",
  details: "Placeholder: cover image, dates, location, and FAQs will live here.",
  photos: "Placeholder: the shared photo album will live here.",
  notes: "Placeholder: the host's private notes-to-self will live here.",
  hostTools: "Placeholder: host-only controls (delete, theme, preview-as-guest) will live here.",
};

export default function ExperienceTabsPreviewPage() {
  const params = useParams<{ id: string }>();
  const [experience, setExperience] = useState<Experience | null | undefined>(
    undefined
  );
  const [phaseOverride, setPhaseOverride] = useState<ExperiencePhase | "actual">(
    "actual"
  );
  const [activeTab, setActiveTab] = useState<ExperienceTabId>("itinerary");

  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestContactError, setGuestContactError] = useState("");
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
  // real access control.
  const [bookOrders, setBookOrders] = useState<BookOrder[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [isPreviewingAsGuest, setIsPreviewingAsGuest] = useState(false);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isInviteLinkCopied, setIsInviteLinkCopied] = useState(false);
  // Shown instead of adding the guest when a free-tier Experience is
  // already at the guest cap (see handleAddGuest below).
  const [isGuestCapModalOpen, setIsGuestCapModalOpen] = useState(false);
  const [isStartingGuestCapCheckout, setIsStartingGuestCapCheckout] =
    useState(false);
  const [guestCapError, setGuestCapError] = useState("");
  const [isTravelDetailModalOpen, setIsTravelDetailModalOpen] =
    useState(false);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    getExperiences().then((experiences) => {
      if (cancelled) return;
      const found = experiences.find(
        (item: Experience) => String(item.id) === params.id
      );
      setExperience(found ?? null);
    });
    getGuests(params.id).then((fetched) => {
      if (!cancelled) setGuests(fetched);
    });
    getItineraryItems(params.id).then((fetched) => {
      if (!cancelled) setItineraryItems(fetched);
    });
    getTravelDetails(params.id).then((fetched) => {
      if (!cancelled) setTravelDetails(fetched);
    });
    getUpdates(params.id).then((fetched) => {
      if (!cancelled) setUpdates(fetched);
    });
    getBookOrders(params.id).then((fetched) => {
      if (!cancelled) setBookOrders(fetched);
    });
    setCollapsedSections(loadCollapsedSections(params.id));

    return () => {
      cancelled = true;
    };
  }
  , [params.id]);

  function toggleSection(section: string) {
    setCollapsedSections((current) => {
      const next = { ...current, [section]: !current[section] };
      saveCollapsedSections(params.id, next);
      return next;
    });
  }


  async function handleBookOrderStatusChange(id: number, status: string) {
    const updated = await updateBookOrderStatus(id, status);
    if (!updated) return;
    setBookOrders((current) =>
      current.map((order) => (order.id === id ? updated : order))
    );
  }

  async function handleAddUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const newUpdate = await addUpdate({
        experienceId: params.id,
        message: updateMessage,
      });

      setUpdates((current) => [newUpdate, ...current]);
      setUpdateMessage("");
      setUpdateError("");
    } catch {
      setUpdateError("Could not post this update. Please try again.");
    }
  }


  async function handleDeleteItineraryItem(itemId: number) {
    if (!window.confirm("Delete this item?")) return;

    await deleteItineraryItem(itemId);
    setItineraryItems((current) => current.filter((item) => item.id !== itemId));
  }

  async function handleAddGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Counts every guest regardless of RSVP status — the cap is on list
    // size, not confirmed attendance. Checked before the email/phone
    // validation below so a blocked add doesn't first complain about
    // missing contact info.
    if (
      experience &&
      !experience.paid &&
      guests.length >= GUEST_COUNT_FREE_TIER_THRESHOLD
    ) {
      setIsGuestModalOpen(false);
      setIsGuestCapModalOpen(true);
      return;
    }

    if (!guestEmail.trim() && !guestPhone.trim()) {
      setGuestContactError("Enter an email or a phone number.");
      return;
    }
    setGuestContactError("");

    try {
      const newGuest = await addGuest({
        experienceId: params.id,
        name: guestName,
        email: guestEmail,
        phone: guestPhone,
        rsvpStatus: "invited",
      });

      setGuests((current) => [...current, newGuest]);
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
      setIsGuestModalOpen(false);
    } catch {
      setGuestContactError("Could not add this guest. Please try again.");
    }
  }

  function handleCloseGuestModal() {
    setIsGuestModalOpen(false);
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    setGuestContactError("");
  }

  function handleCloseGuestCapModal() {
    setIsGuestCapModalOpen(false);
    setGuestCapError("");
  }

  // Same Checkout flow used for the "more than 20 guests" tier at
  // Experience creation, but for an Experience that already exists — see
  // /api/checkout/guest-cap and its success page, which flips paid to
  // true and sends the host back here. If they cancel, Stripe's own
  // cancel_url just returns them to this page with nothing changed: no
  // guest was added and the Experience stays on the free tier at its
  // current count.
  async function handleStartGuestCapCheckout() {
    setGuestCapError("");
    setIsStartingGuestCapCheckout(true);

    try {
      const response = await fetch("/api/checkout/guest-cap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceId: params.id }),
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        setGuestCapError(data.error || "Could not start checkout. Please try again.");
        setIsStartingGuestCapCheckout(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setGuestCapError("Could not start checkout. Please try again.");
      setIsStartingGuestCapCheckout(false);
    }
  }

  function handleCopyInviteLink() {
    const inviteLink = `${window.location.origin}/experiences/${params.id}/rsvp`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setIsInviteLinkCopied(true);
      setTimeout(() => setIsInviteLinkCopied(false), 2000);
    });
  }

  async function handleRsvpStatusChange(
    guestId: number,
    rsvpStatus: Guest["rsvpStatus"]
  ) {
    const updatedGuest = await updateGuestStatus(guestId, rsvpStatus);
    if (!updatedGuest) return;

    setGuests((current) =>
      current.map((item) => (item.id === guestId ? updatedGuest : item))
    );
  }

  const hotelDateRange: DateRange | undefined =
    checkInDate && checkOutDate
      ? {
          from: parseLocalDate(checkInDate) ?? undefined,
          to: parseLocalDate(checkOutDate) ?? undefined,
        }
      : undefined;

  // A 7-day buffer on either side of the Experience's own dates — wider
  // than the itinerary items' 1-day buffer, since an early arrival or
  // extended stay around the event is normal for a hotel booking, while
  // still ruling out wildly unrelated dates. Deliberately not tied to
  // today (unlike Experience dates) — travel logistics are reasonably
  // logged after the fact.
  const hotelMinDate = experience
    ? (parseLocalDate(addDaysToLocalDateString(experience.startDate, -7)) ??
      undefined)
    : undefined;
  const hotelMaxDate = experience
    ? (parseLocalDate(addDaysToLocalDateString(experience.endDate, 7)) ??
      undefined)
    : undefined;

  // react-day-picker's own range logic (via DateRangePickerField's
  // autoSyncDays={1}) already gives the "check-out defaults to one day
  // after check-in, until a second, later click overrides it" auto-sync
  // behavior for free — no separate synced-flag state needed, same
  // simplification already made for Experience dates.
  function handleHotelDateRangeChange(range: DateRange | undefined) {
    setCheckInDate(range?.from ? formatLocalDateString(range.from) : "");
    setCheckOutDate(range?.to ? formatLocalDateString(range.to) : "");
  }

  async function handleAddTravelDetail(event: FormEvent<HTMLFormElement>) {
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

    if (travelDetailType === "hotel") {
      // The native date inputs' `required` attribute used to enforce
      // this at the browser level; DateRangePickerField has no
      // equivalent, so it's checked explicitly here instead.
      if (!checkInDate || !checkOutDate) {
        setTravelDetailError("Select check-in and check-out dates.");
        return;
      }
      if (checkOutDate < checkInDate) {
        setTravelDetailError(
          "Check-out date must be on or after the check-in date."
        );
        return;
      }
    }

    setTravelDetailError("");

    try {
      let newEntry: TravelDetail;

      if (travelDetailType === "flight") {
        newEntry = await addTravelDetail({
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
        newEntry = await addTravelDetail({
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
        setConfirmationNumber("");
      } else {
        newEntry = await addTravelDetail({
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
    } catch {
      setTravelDetailError("Could not save this entry. Please try again.");
    }
  }

  function handleOpenTravelDetailModal() {
    // Default to the Experience's own start date rather than today —
    // travel days reasonably fall a day or so before/after the
    // Experience itself (arrival/departure travel), so this is only a
    // starting point, not a restriction: unlike itinerary item dates,
    // these fields have no min/max (including no past-date guardrail —
    // travel logistics are reasonably logged after the fact) and stay
    // freely adjustable either direction.
    if (experience) {
      setDepartureDate(experience.startDate);
      setArrivalDate(experience.startDate);
      setCheckInDate(experience.startDate);
      setCheckOutDate(addDaysToLocalDateString(experience.startDate, 1));
    }
    setIsTravelDetailModalOpen(true);
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

  async function handleSaveEditTravelDetail(entry: TravelDetail) {
    const draft = travelDetailEditDraft;

    if (entry.type === "hotel") {
      if (!draft.checkInDate || !draft.checkOutDate) {
        setTravelDetailEditError("Select check-in and check-out dates.");
        return;
      }
      if (draft.checkOutDate < draft.checkInDate) {
        setTravelDetailEditError(
          "Check-out date must be on or after the check-in date."
        );
        return;
      }
    }

    if (entry.type === "flight" && draft.departureDate) {
      const departureDateTime = `${draft.departureDate}T${draft.departureTime || "00:00"}`;
      const arrivalDateTime = `${draft.arrivalDate}T${draft.arrivalTime}`;
      if (arrivalDateTime < departureDateTime) {
        setTravelDetailEditError("Arrival must be on or after departure.");
        return;
      }
    }

    const updatedEntry = await updateTravelDetail(entry.id, draft);
    if (!updatedEntry) {
      setTravelDetailEditError("Could not save changes. Please try again.");
      return;
    }

    setTravelDetails((current) =>
      current.map((item) => (item.id === entry.id ? updatedEntry : item))
    );

    setEditingTravelDetailId(null);
    setTravelDetailEditDraft({});
    setTravelDetailEditError("");
  }

  async function handleDeleteTravelDetail(id: number) {
    if (!window.confirm("Delete this travel detail?")) return;

    await deleteTravelDetail(id);
    setTravelDetails((current) => current.filter((item) => item.id !== id));
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


  // Recomputed on every render (never stored) — see computeExperiencePhase.
  // The override below exists only for this preview, so all three
  // phases' tab orderings can be exercised from a single Experience
  // without needing three separately-dated ones.
  const actualPhase = computeExperiencePhase(
    experience.startDate,
    experience.endDate
  );
  const phase = phaseOverride === "actual" ? actualPhase : phaseOverride;

  function handlePhaseOverrideChange(next: ExperiencePhase | "actual") {
    setPhaseOverride(next);
    const resolvedPhase = next === "actual" ? actualPhase : next;
    setActiveTab(TAB_ORDER_FOR_DEFAULT[resolvedPhase][0]);
  }

  // Itinerary and Guests are always shown, empty or not. Updates hides
  // whenever there are zero updates, in host view too. Tabs not migrated
  // yet stay visible via the tab bar's default.
  const hasContentByTab: Partial<Record<ExperienceTabId, boolean>> = {
    itinerary: true,
    guests: true,
    updates: updates.length > 0,
    // Book Orders is the only real content this tab holds right now, and
    // it's host-only, so the tab hides when there are no orders or in
    // guest preview.
    // TODO(Group 2/3): once Delete Experience, the theme picker, and the
    // Preview-as-Guest toggle are migrated into this tab, change this to
    // `hostTools: !isPreviewingAsGuest` and drop the bookOrders.length
    // condition — those controls exist whether or not an order was ever
    // placed, so the tab should never be empty for a host.
    hostTools: bookOrders.length > 0 && !isPreviewingAsGuest,
  };

  // Guard against sitting on a tab that just disappeared (e.g. toggling
  // to guest preview while on an empty Updates tab).
  const resolvedActiveTab: ExperienceTabId =
    hasContentByTab[activeTab] === false
      ? TAB_ORDER_FOR_DEFAULT[phase][0]
      : activeTab;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
      <Link
        href={`/experiences/${params.id}`}
        className="block text-sm text-muted underline underline-offset-2 transition-colors hover:text-accent"
      >
        &larr; Back to {experience.name}
      </Link>

      <h1 className="mt-3 font-serif text-3xl text-foreground sm:text-4xl">
        Tab Navigation Preview
      </h1>
      <p className="mt-2 text-sm text-muted">
        Isolated test view — not wired into the real Experience page.
        Actual phase for this Experience (today vs. {experience.startDate}
        –{experience.endDate}): <strong>{actualPhase}</strong>.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {PHASE_OVERRIDE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handlePhaseOverrideChange(option.value)}
            aria-pressed={phaseOverride === option.value}
            className={`border px-3 py-1.5 text-xs tracking-wide uppercase transition-colors ${
              phaseOverride === option.value
                ? "border-accent bg-accent/10 text-accent"
                : "border-foreground/10 text-muted hover:border-accent/50 hover:text-accent"
            }`}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIsPreviewingAsGuest((current) => !current)}
          aria-pressed={isPreviewingAsGuest}
          className={`border px-3 py-1.5 text-xs tracking-wide uppercase transition-colors ${
            isPreviewingAsGuest
              ? "border-accent bg-accent/10 text-accent"
              : "border-foreground/10 text-muted hover:border-accent/50 hover:text-accent"
          }`}
        >
          {isPreviewingAsGuest ? "Previewing as: Guest" : "Host View"}
        </button>
      </div>

      <div className="mt-8">
        <ExperienceTabBar
          phase={phase}
          activeTab={resolvedActiveTab}
          onChange={setActiveTab}
          hasContentByTab={hasContentByTab}
        />
      </div>

      {resolvedActiveTab === "itinerary" ? (
        <>

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
        <div className="flex min-h-[20vh] items-center justify-center text-center font-serif text-lg text-muted italic">
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
                    <div className="min-w-0">
                      {isHappeningNow || isUpNext ? (
                        <span className="mb-1 inline-block border border-accent/30 bg-accent/5 px-2 py-0.5 text-xs tracking-widest text-accent uppercase">
                          {isHappeningNow ? "Happening Now" : "Up Next"}
                        </span>
                      ) : null}
                      {/* min-w-0 on the title lets this grid track actually
                          shrink instead of being held to its text's
                          min-content width; break-words (overflow-wrap)
                          then wraps normally at word boundaries within
                          whatever width it ends up with, only breaking
                          mid-word as a last resort. items-start (not
                          items-baseline) keeps the icon pinned to the
                          title's first line once it wraps, rather than
                          floating against the whole wrapped block. No
                          flex-wrap/flex-1 here — those caused the 3-column
                          layout to collapse in an earlier attempt. */}
                      <div className="flex items-start gap-2">
                        <span
                          className="shrink-0 text-muted"
                          title={item.type ?? "Generic"}
                        >
                          <ItineraryTypeIcon type={item.type ?? "Generic"} />
                        </span>
                        <p className="min-w-0 font-serif text-lg text-foreground break-words">
                          {item.title}
                        </p>
                      </div>
                      {/* ml-6 = the icon's own width (h-4/w-4 = 1rem)
                          plus the icon-to-title gap (gap-2 = 0.5rem)
                          above, so these align with the title text
                          rather than the icon. */}
                      {item.description ? (
                        <p className="mt-1 ml-6 text-sm text-foreground/60">
                          {item.description}
                        </p>
                      ) : null}
                      {item.dressCode ? (
                        <p className="mt-1 ml-6 text-sm text-foreground/60">
                          Dress code: {item.dressCode}
                        </p>
                      ) : null}
                      {isPreviewingAsGuest ? null : (
                      <div className="mt-2 ml-6 flex items-center gap-3">
                        <Link
                          href={`/experiences/${params.id}/itinerary/${item.id}/edit`}
                          aria-label="Edit"
                          title="Edit"
                          className="text-muted transition-colors hover:text-accent"
                        >
                          <EditIcon />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteItineraryItem(item.id)}
                          aria-label="Delete"
                          title="Delete"
                          className="text-muted transition-colors hover:text-red-600"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                      )}
                    </div>
                    {item.location ? (
                      // An explicit bounded width (matching the time
                      // column's sm:w-44) rather than relying on this
                      // grid track's own "auto" sizing — a long unbroken
                      // address previously forced that track to claim its
                      // full content width, starving the title column
                      // down to almost nothing. Splitting into short
                      // stacked lines (see formatLocationLines) keeps
                      // each line comfortably within this width too.
                      <div className="flex flex-col items-start gap-1 sm:w-56 sm:shrink-0 sm:items-end">
                        {formatLocationLines(item.location).map((line, index) => (
                          <p
                            key={index}
                            className="text-sm text-foreground/60 break-words sm:text-right"
                          >
                            {line}
                          </p>
                        ))}
                        <a
                          href={getMapsUrl(item.location)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted underline underline-offset-2 transition-colors hover:text-accent"
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

        </>
      ) : resolvedActiveTab === "guests" ? (
        <>

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
        <div className="mt-6 flex flex-wrap items-center justify-end gap-4">
          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="shrink-0 text-sm text-muted underline underline-offset-2 transition-colors hover:text-accent"
          >
            {isInviteLinkCopied ? "Link Copied!" : "Copy Invite Link"}
          </button>
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
              <span className="text-sm tracking-wide text-muted uppercase">
                Name
              </span>
              <input
                type="text"
                required
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Jamie Rivera"
                className="mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-placeholder placeholder:text-sm placeholder:italic focus:border-accent focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm tracking-wide text-muted uppercase">
                Email
              </span>
              <input
                type="email"
                value={guestEmail}
                onChange={(event) => setGuestEmail(event.target.value)}
                placeholder="jamie@example.com"
                className="mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-placeholder placeholder:text-sm placeholder:italic focus:border-accent focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm tracking-wide text-muted uppercase">
                Phone
              </span>
              <input
                type="tel"
                value={guestPhone}
                onChange={(event) => setGuestPhone(event.target.value)}
                placeholder="(555) 123-4567"
                className="mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-placeholder placeholder:text-sm placeholder:italic focus:border-accent focus:outline-none"
              />
            </label>

            <p className="text-sm text-muted">
              Provide an email or a phone number — at least one is required.
            </p>

            {guestContactError ? (
              <p className="text-sm text-red-600">{guestContactError}</p>
            ) : null}

            <button
              type="submit"
              className="mt-2 self-start border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
            >
              Add Guest
            </button>
          </form>
        </Modal>

        <Modal
          isOpen={isGuestCapModalOpen}
          onClose={handleCloseGuestCapModal}
          title="Guest Limit Reached"
        >
          <div className="flex flex-col gap-6">
            <p className="text-sm text-foreground/80">
              This Experience is on the free tier, which covers up to{" "}
              {GUEST_COUNT_FREE_TIER_THRESHOLD} guests. You&apos;re already at
              that limit — upgrading with the platform tier fee removes the
              cap, so you can add this guest and any more after that.
            </p>

            {guestCapError ? (
              <p className="text-sm text-red-600">{guestCapError}</p>
            ) : null}

            <button
              type="button"
              onClick={handleStartGuestCapCheckout}
              disabled={isStartingGuestCapCheckout}
              className="self-start border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isStartingGuestCapCheckout
                ? "Redirecting to Checkout…"
                : "Continue to Payment"}
            </button>
          </div>
        </Modal>

        {isPreviewingAsGuest ? null : (
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 border-b border-foreground/10">
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
                className={`-mb-px shrink-0 border-b-2 px-3 pb-3 text-sm tracking-wide whitespace-nowrap uppercase transition-colors ${
                  isActive
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-transparent text-muted hover:text-accent"
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

          if (effectiveGuestTab === "directory") {
            // "directory" isn't a selectable tab anymore (Attendee
            // Directory was removed from GUEST_TABS) — it's only reached
            // via isPreviewingAsGuest above, so it needs its own message
            // rather than looking one up in GUEST_TABS, where it will
            // never find a match.
            const confirmedGuests = guests.filter(
              (guest) => guest.everConfirmed
            );

            return confirmedGuests.length === 0 ? (
              <div className="flex min-h-[15vh] items-center justify-center text-center font-serif text-lg text-muted italic">
                No confirmed attendees yet
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

          // Falls back to the first tab rather than crashing if guestTab
          // ever holds a value that doesn't match any current entry in
          // GUEST_TABS (e.g. a stale reference to a tab that's since been
          // removed or renamed) — this class of bug has come up before,
          // so the lookup stays defensive here rather than assuming a
          // match will always exist.
          const activeTab =
            GUEST_TABS.find((tab) => tab.status === guestTab) ??
            GUEST_TABS[0];

          const tabGuests =
            guestTab === "all"
              ? guests
              : guests.filter((guest) => guest.rsvpStatus === guestTab);

          return tabGuests.length === 0 ? (
            <div className="flex min-h-[15vh] items-center justify-center text-center font-serif text-lg text-muted italic">
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


      {travelDetails.length > 0 || !isPreviewingAsGuest ? (
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
            onClick={handleOpenTravelDetailModal}
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

              <label className="block">
                <span className={TRAVEL_LABEL_CLASSES}>
                  Check-In / Check-Out
                </span>
                <DateRangePickerField
                  value={hotelDateRange}
                  onChange={handleHotelDateRangeChange}
                  autoSyncDays={1}
                  disabled={
                    hotelMinDate && hotelMaxDate
                      ? [{ before: hotelMinDate }, { after: hotelMaxDate }]
                      : undefined
                  }
                />
              </label>

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
          <div className="flex min-h-[15vh] items-center justify-center text-center font-serif text-lg text-muted italic">
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
                                <label className="block">
                                  <span className={TRAVEL_LABEL_CLASSES}>
                                    Check-In / Check-Out
                                  </span>
                                  <DateRangePickerField
                                    value={
                                      field("checkInDate") && field("checkOutDate")
                                        ? {
                                            from:
                                              parseLocalDate(field("checkInDate")) ??
                                              undefined,
                                            to:
                                              parseLocalDate(field("checkOutDate")) ??
                                              undefined,
                                          }
                                        : undefined
                                    }
                                    onChange={(range) => {
                                      handleTravelDetailEditDraftChange(
                                        "checkInDate",
                                        range?.from
                                          ? formatLocalDateString(range.from)
                                          : ""
                                      );
                                      handleTravelDetailEditDraftChange(
                                        "checkOutDate",
                                        range?.to
                                          ? formatLocalDateString(range.to)
                                          : ""
                                      );
                                    }}
                                    autoSyncDays={1}
                                    disabled={
                                      hotelMinDate && hotelMaxDate
                                        ? [
                                            { before: hotelMinDate },
                                            { after: hotelMaxDate },
                                          ]
                                        : undefined
                                    }
                                  />
                                </label>
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
                                className="text-sm text-muted underline underline-offset-2 transition-colors hover:text-accent"
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
                            <div className="flex shrink-0 items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleStartEditTravelDetail(entry)}
                                className="text-xs text-muted underline underline-offset-2 transition-colors hover:text-accent"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTravelDetail(entry.id)}
                                className="text-xs text-muted underline underline-offset-2 transition-colors hover:text-red-600"
                              >
                                Delete
                              </button>
                            </div>
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
                                className="mt-1 inline-block text-xs text-muted underline underline-offset-2 transition-colors hover:text-accent"
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
                            <div className="flex shrink-0 items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleStartEditTravelDetail(entry)}
                                className="text-xs text-muted underline underline-offset-2 transition-colors hover:text-accent"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTravelDetail(entry.id)}
                                className="text-xs text-muted underline underline-offset-2 transition-colors hover:text-red-600"
                              >
                                Delete
                              </button>
                            </div>
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
                          <div className="flex shrink-0 items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleStartEditTravelDetail(entry)}
                              className="text-xs text-muted underline underline-offset-2 transition-colors hover:text-accent"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTravelDetail(entry.id)}
                              className="text-xs text-muted underline underline-offset-2 transition-colors hover:text-red-600"
                            >
                              Delete
                            </button>
                          </div>
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
      ) : null}

        </>
      ) : resolvedActiveTab === "updates" ? (
        <>

      {updates.length > 0 || !isPreviewingAsGuest ? (
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
                <span className="text-sm tracking-wide text-muted uppercase">
                  New Update
                </span>
                <input
                  type="text"
                  required
                  value={updateMessage}
                  onChange={(event) => setUpdateMessage(event.target.value)}
                  placeholder="The dinner start time moved to 7pm..."
                  className="mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-placeholder placeholder:text-sm placeholder:italic focus:border-accent focus:outline-none"
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

            {updateError ? (
              <p className="mt-2 text-sm text-red-600">{updateError}</p>
            ) : null}

            {updates.length === 0 ? (
              <div className="flex min-h-[15vh] items-center justify-center text-center font-serif text-lg text-muted italic">
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
      ) : null}

        </>
      ) : (
        <>
      {resolvedActiveTab === "hostTools" && !isPreviewingAsGuest && bookOrders.length > 0 ? (
      <div className="mt-12">
        <h2 className="font-serif text-2xl text-foreground">
          <button
            type="button"
            onClick={() => toggleSection("bookOrders")}
            className="flex items-center gap-2 text-left"
          >
            <ChevronIcon collapsed={!!collapsedSections.bookOrders} />
            Book Orders
          </button>
        </h2>

        {collapsedSections.bookOrders ? null : (
          <div className="mt-6 flex flex-col gap-8">
            {bookOrders.map((order) => (
              <div
                key={order.id}
                className="border-b border-foreground/10 pb-8 last:border-b-0"
              >
                <p className="font-serif text-lg text-foreground">
                  {order.recipientName}
                </p>
                <p className="mt-1 text-sm text-foreground/60">
                  {order.shippingAddress.line1}
                  {order.shippingAddress.line2
                    ? `, ${order.shippingAddress.line2}`
                    : ""}
                  <br />
                  {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                  {order.shippingAddress.zip}
                  <br />
                  {order.shippingAddress.country}
                </p>
                <label className="mt-4 block max-w-xs">
                  <span className="text-sm tracking-wide text-muted uppercase">
                    Status
                  </span>
                  <select
                    value={order.status}
                    onChange={(event) =>
                      handleBookOrderStatusChange(order.id, event.target.value)
                    }
                    className="mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground focus:border-accent focus:outline-none"
                  >
                    {BOOK_ORDER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
      ) : null}
        <div className="mt-8 border border-foreground/10 p-6">
          <h2 className="font-serif text-xl text-foreground capitalize">
            {resolvedActiveTab.replace(/([A-Z])/g, " $1")}
          </h2>
          <p className="mt-3 text-sm text-muted italic">
            {TAB_PLACEHOLDER_TEXT[resolvedActiveTab]}
          </p>
        </div>
        </>
      )}
    </main>
  );
}
