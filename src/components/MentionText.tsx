import type { CSSProperties } from "react";
import type { MessageSegment } from "@/lib/mentions";

type MentionTextProps = {
  segments: MessageSegment[];
  // How a mention stands out from the text around it. Defaults to the
  // theme accent; the polaroid card passes its own fixed palette instead
  // (see POLAROID_ACCENT in PolaroidCard).
  mentionClassName?: string;
  mentionStyle?: CSSProperties;
};

// Renders parsed message segments (see parseMessage in @/lib/mentions)
// with each @mention bold and accent-colored. Display only — no link or
// click-through yet.
export default function MentionText({
  segments,
  mentionClassName = "font-semibold text-accent",
  mentionStyle,
}: MentionTextProps) {
  return segments.map((segment, index) =>
    segment.type === "mention" ? (
      <span key={index} className={mentionClassName} style={mentionStyle}>
        {segment.name}
      </span>
    ) : (
      segment.text
    )
  );
}
