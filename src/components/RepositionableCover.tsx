"use client";

import { useRef, useState } from "react";

type Props = {
  src: string;
  alt: string;
  // Focal point as 0-100 percentages, applied as CSS object-position.
  x: number;
  y: number;
  canEdit: boolean;
  onSave: (x: number, y: number) => Promise<boolean>;
  onError: () => void;
};

const clamp = (value: number) => Math.min(100, Math.max(0, value));

// The Experience page's cover hero. In edit mode the photo can be dragged
// (like repositioning a photo on Instagram) to choose which part of it
// stays visible in the crop; the result is stored as an object-position
// offset, so it applies to any aspect ratio the cover is shown in.
export default function RepositionableCover({
  src,
  alt,
  x,
  y,
  canEdit,
  onSave,
  onError,
}: Props) {
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [draft, setDraft] = useState({ x, y });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    overflowX: number;
    overflowY: number;
  } | null>(null);

  const shown = isRepositioning ? draft : { x, y };

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const box = containerRef.current;
    const img = imgRef.current;
    if (!isRepositioning || !box || !img || !img.naturalWidth) return;
    // Presses on Save/Cancel must not start a drag: pointer capture on the
    // container would retarget the click away from the button, so the
    // button would never fire.
    if ((event.target as HTMLElement).closest("button")) return;

    // With object-fit: cover the image is scaled until it covers the box;
    // the overflow on each axis is how far it can slide.
    const scale = Math.max(
      box.clientWidth / img.naturalWidth,
      box.clientHeight / img.naturalHeight
    );
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: draft.x,
      originY: draft.y,
      overflowX: img.naturalWidth * scale - box.clientWidth,
      overflowY: img.naturalHeight * scale - box.clientHeight,
    };
    box.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;

    // Dragging the photo right reveals more of its left side, so the
    // focal point moves the opposite way to the pointer.
    const nextX =
      drag.overflowX > 0
        ? drag.originX - ((event.clientX - drag.startX) / drag.overflowX) * 100
        : drag.originX;
    const nextY =
      drag.overflowY > 0
        ? drag.originY - ((event.clientY - drag.startY) / drag.overflowY) * 100
        : drag.originY;
    setDraft({ x: clamp(nextX), y: clamp(nextY) });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function startRepositioning() {
    setDraft({ x, y });
    setSaveError("");
    setIsRepositioning(true);
  }

  async function handleSave() {
    setIsSaving(true);
    const saved = await onSave(Math.round(draft.x), Math.round(draft.y));
    setIsSaving(false);
    if (saved) {
      setIsRepositioning(false);
    } else {
      setSaveError("Could not save the position. Please try again.");
    }
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative h-64 w-full overflow-hidden sm:h-80 ${
        isRepositioning ? "cursor-grab touch-none active:cursor-grabbing" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onError={onError}
        draggable={false}
        style={{ objectPosition: `${shown.x}% ${shown.y}%` }}
        className="h-full w-full object-cover select-none"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

      {canEdit && !isRepositioning ? (
        <button
          type="button"
          onClick={startRepositioning}
          className="absolute right-3 bottom-3 z-10 bg-background/90 px-3 py-1.5 text-xs tracking-wide text-foreground uppercase transition-colors hover:text-accent"
        >
          Reposition photo
        </button>
      ) : null}

      {isRepositioning ? (
        <div className="absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-center justify-between gap-3">
          <span className="bg-background/90 px-3 py-1.5 text-xs tracking-wide text-muted uppercase">
            {saveError || "Drag to reposition"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRepositioning(false)}
              disabled={isSaving}
              className="bg-background/90 px-3 py-1.5 text-xs tracking-wide text-muted uppercase transition-colors hover:text-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-accent px-3 py-1.5 text-xs tracking-wide text-background uppercase disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
