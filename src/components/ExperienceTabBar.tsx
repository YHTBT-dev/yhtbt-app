"use client";

import type { ExperiencePhase } from "@/lib/experiencePhase";
import {
  ChatTabIcon,
  DetailsTabIcon,
  GuestsTabIcon,
  HostToolsTabIcon,
  ItineraryTabIcon,
  LockTabIcon,
  NotesTabIcon,
  PhotosTabIcon,
  UpdatesTabIcon,
} from "@/components/ExperienceTabIcons";

export type ExperienceTabId =
  | "itinerary"
  | "guests"
  | "updates"
  | "chat"
  | "details"
  | "photos"
  | "notes"
  | "hostTools";

const TAB_META: Record<
  ExperienceTabId,
  { label: string; Icon: (props: { className?: string }) => React.JSX.Element }
> = {
  itinerary: { label: "Itinerary", Icon: ItineraryTabIcon },
  guests: { label: "Guests", Icon: GuestsTabIcon },
  updates: { label: "Updates", Icon: UpdatesTabIcon },
  chat: { label: "Chat", Icon: ChatTabIcon },
  details: { label: "Details", Icon: DetailsTabIcon },
  photos: { label: "Photos", Icon: PhotosTabIcon },
  notes: { label: "Notes", Icon: NotesTabIcon },
  hostTools: { label: "Host Tools", Icon: HostToolsTabIcon },
};

// Reordered per phase rather than staying fixed — During surfaces the
// live/social tabs (Chat, Updates, Itinerary) first since that's what's
// most useful while the Experience is actually happening; After leads
// with Photos/Chat since the event is over and reminiscing is the
// dominant use case. Host Tools stays reachable in every phase but never
// leads.
const TAB_ORDER_BY_PHASE: Record<ExperiencePhase, ExperienceTabId[]> = {
  before: [
    "itinerary",
    "guests",
    "updates",
    "chat",
    "details",
    "photos",
    "notes",
    "hostTools",
  ],
  during: [
    "chat",
    "updates",
    "itinerary",
    "photos",
    "notes",
    "guests",
    "details",
    "hostTools",
  ],
  after: [
    "photos",
    "chat",
    "hostTools",
    "notes",
    "itinerary",
    "guests",
    "updates",
    "details",
  ],
};

// PLACEHOLDER: every tab has content for now — real per-tab content
// detection (mirroring the section-level "hide if nothing's there"
// pattern already used for FAQs/Polls/Updates on the real Experience
// page) comes once actual sections are moved into these tabs. Callers
// can override this stub via hasContentByTab (used by the isolated
// preview page to exercise the hiding behavior before real content
// exists).
const DEFAULT_HAS_CONTENT: Record<ExperienceTabId, boolean> = {
  itinerary: true,
  guests: true,
  updates: true,
  chat: true,
  details: true,
  photos: true,
  notes: true,
  hostTools: true,
};

type ExperienceTabBarProps = {
  phase: ExperiencePhase;
  activeTab: ExperienceTabId;
  onChange: (tab: ExperienceTabId) => void;
  hasContentByTab?: Partial<Record<ExperienceTabId, boolean>>;
};

// Horizontal, scrollable pill tab bar for the Experience page's
// upcoming navigation redesign — active tab filled, inactive outlined.
// Tab order and which tabs even appear both depend on the Experience's
// current phase (see computeExperiencePhase in @/lib/experiencePhase).
export default function ExperienceTabBar({
  phase,
  activeTab,
  onChange,
  hasContentByTab,
}: ExperienceTabBarProps) {
  const visibleTabs = TAB_ORDER_BY_PHASE[phase].filter(
    (tab) => (hasContentByTab?.[tab] ?? DEFAULT_HAS_CONTENT[tab])
  );

  return (
    <div className="overflow-x-auto">
      <div className="flex w-max gap-3 pb-2">
        {visibleTabs.map((tab) => {
          const { label, Icon } = TAB_META[tab];
          const isActive = tab === activeTab;
          // Distinct from Chat's normal Before/During appearance — the
          // conversation is read-only once the Experience is over.
          const isArchivedChat = tab === "chat" && phase === "after";

          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              aria-pressed={isActive}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm tracking-wide whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-accent text-background"
                  : "border border-accent/40 text-foreground hover:border-accent"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {isArchivedChat ? (
                <span
                  className="flex items-center gap-1 text-xs uppercase opacity-80"
                  title="Archived"
                >
                  <LockTabIcon />
                  Archived
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
