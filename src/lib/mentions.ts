// @mentions inside free text (currently just Update messages).
//
// Stored format: a mention is written into the message itself as
// "@[Jamie B](guest:42)" — the guest's display name at the time it was
// tagged, plus their guests-table id. Keeping it inline (rather than a
// separate column) records exactly where in the sentence each mention
// sits and needs no schema change; the id is what a future feature
// (notifying that guest, linking to them) should key off, since names
// can change or repeat. Messages posted before mentions existed contain
// no tokens and parse as a single plain-text segment.
//
// While editing, the text is kept "display" form ("@Jamie B") with the
// mention ranges tracked alongside it, and only serialized to the stored
// form on submit — see MentionInput.

export type Mention = {
  guestId: number;
  name: string;
};

// A mention's position in display text: [start, end) covers "@Name".
export type MentionRange = Mention & {
  start: number;
  end: number;
};

export type MentionDraft = {
  text: string;
  mentions: MentionRange[];
};

export type MessageSegment =
  | { type: "text"; text: string }
  | ({ type: "mention" } & Mention);

export const EMPTY_MENTION_DRAFT: MentionDraft = { text: "", mentions: [] };

const MENTION_TOKEN = /@\[((?:\\.|[^\]\\])*)\]\(guest:(\d+)\)/g;

function escapeName(name: string) {
  return name.replace(/[\\\]]/g, (char) => `\\${char}`);
}

function unescapeName(name: string) {
  return name.replace(/\\(.)/g, "$1");
}

export function serializeMentionDraft({ text, mentions }: MentionDraft) {
  let result = "";
  let cursor = 0;
  for (const mention of [...mentions].sort((a, b) => a.start - b.start)) {
    result += text.slice(cursor, mention.start);
    result += `@[${escapeName(mention.name)}](guest:${mention.guestId})`;
    cursor = mention.end;
  }
  return result + text.slice(cursor);
}

export function parseMessage(message: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;
  for (const match of message.matchAll(MENTION_TOKEN)) {
    if (match.index > cursor) {
      segments.push({ type: "text", text: message.slice(cursor, match.index) });
    }
    segments.push({
      type: "mention",
      name: unescapeName(match[1]),
      guestId: Number(match[2]),
    });
    cursor = match.index + match[0].length;
  }
  if (cursor < message.length) {
    segments.push({ type: "text", text: message.slice(cursor) });
  }
  return segments;
}

export function getMentions(message: string): Mention[] {
  return parseMessage(message).flatMap((segment) =>
    segment.type === "mention"
      ? [{ guestId: segment.guestId, name: segment.name }]
      : []
  );
}

// Carries mention ranges across an arbitrary edit of the display text.
// The edited span is found by trimming the common suffix and prefix of
// the old and new text: mentions wholly before it stay put, mentions
// wholly after it shift by the length change, and any mention the edit
// touched (e.g. backspacing into "@Jamie B") is dropped — its characters
// remain as ordinary text rather than a half-broken mention.
//
// The caret (where the input's cursor sits after the edit) always marks
// the end of the edited span, so it caps the suffix. Without it, typing
// a repeated character is ambiguous — "@" typed just before "@Ann" would
// look like it landed inside the mention.
export function reconcileMentions(
  previous: MentionDraft,
  nextText: string,
  caret: number = nextText.length
): MentionRange[] {
  const oldText = previous.text;
  const maxShared = Math.min(oldText.length, nextText.length);

  let suffix = 0;
  const maxSuffix = Math.min(maxShared, nextText.length - caret);
  while (
    suffix < maxSuffix &&
    oldText[oldText.length - 1 - suffix] === nextText[nextText.length - 1 - suffix]
  ) {
    suffix++;
  }

  let prefix = 0;
  while (prefix < maxShared - suffix && oldText[prefix] === nextText[prefix]) {
    prefix++;
  }

  const editEnd = oldText.length - suffix;
  const delta = nextText.length - oldText.length;

  return previous.mentions.flatMap((mention) => {
    if (mention.end <= prefix) return [mention];
    if (mention.start >= editEnd) {
      return [{ ...mention, start: mention.start + delta, end: mention.end + delta }];
    }
    return [];
  });
}
