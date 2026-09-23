import { getSupabaseClient } from "@/lib/supabase";

const TABLE_NAME = "polls";

// Migrated off localStorage onto Supabase — see the "polls" table (a real
// experience_id foreign key referencing experiences.id, on delete cascade)
// and its RLS policies. Every function here is now async. votes is stored
// as a jsonb column (an object mapping each option string to its vote
// count) rather than an array, since that's the shape the rest of the app
// already expects; options stays a text[] array. There's no Postgres
// function for atomic vote increments here — recordVote reads the current
// votes object and writes back the incremented value, same small-scale
// tradeoff already accepted elsewhere in this app (e.g. guestsStore's
// everConfirmed).
//
// The "which polls has this browser already voted on" tracking
// (getVotedPollIds/markPollVoted, below) is deliberately NOT part of this
// migration — it's a per-browser flag, not shared poll data, so it stays
// in localStorage exactly as before. The only place it interacts with
// poll data is deleteAllForExperience, which still looks up the poll ids
// being deleted (now via Supabase) so it can prune those same ids out of
// the voted-list.

function rowToPoll(row) {
  return {
    id: row.id,
    experienceId: String(row.experience_id),
    question: row.question,
    options: row.options ?? [],
    votes: row.votes ?? {},
    isOpen: row.is_open ?? true,
  };
}

function pollToRow(poll) {
  const row = {};
  if (poll.experienceId !== undefined) row.experience_id = Number(poll.experienceId);
  if (poll.question !== undefined) row.question = poll.question;
  if (poll.options !== undefined) row.options = poll.options;
  if (poll.votes !== undefined) row.votes = poll.votes;
  if (poll.isOpen !== undefined) row.is_open = poll.isOpen;
  return row;
}

export async function getPolls(experienceId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("experience_id", Number(experienceId))
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[pollsStore] getPolls failed:", error);
    return [];
  }
  return data.map(rowToPoll);
}

export async function addPoll(poll) {
  const supabase = getSupabaseClient();
  const votes = {};
  for (const option of poll.options) {
    votes[option] = 0;
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(pollToRow({ ...poll, votes, isOpen: true }))
    .select()
    .single();

  if (error) {
    console.error("[pollsStore] addPoll failed:", error);
    throw error;
  }
  return rowToPoll(data);
}

export async function setPollOpen(pollId, isOpen) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ is_open: isOpen })
    .eq("id", pollId)
    .select()
    .single();

  if (error) {
    console.error("[pollsStore] setPollOpen failed:", error);
    return null;
  }
  return rowToPoll(data);
}

// Reads the poll's current votes, increments the given option, and writes
// the whole object back — not a true atomic increment (see module
// comment), but matches how contended writes are already handled
// elsewhere in this app.
export async function recordVote(pollId, option) {
  const supabase = getSupabaseClient();
  const { data: current, error: fetchError } = await supabase
    .from(TABLE_NAME)
    .select("votes")
    .eq("id", pollId)
    .maybeSingle();

  if (fetchError || !current) {
    console.error("[pollsStore] recordVote lookup failed:", fetchError);
    return null;
  }

  const nextVotes = {
    ...current.votes,
    [option]: (current.votes[option] ?? 0) + 1,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ votes: nextVotes })
    .eq("id", pollId)
    .select()
    .single();

  if (error) {
    console.error("[pollsStore] recordVote failed:", error);
    return null;
  }
  return rowToPoll(data);
}

const VOTED_POLLS_STORAGE_KEY = "yhtbt:votedPolls";

function readVotedPollIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VOTED_POLLS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeVotedPollIds(ids) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VOTED_POLLS_STORAGE_KEY, JSON.stringify(ids));
}

// Tracks which poll IDs this browser has already voted on, so a poll can
// show its results instead of clickable options on a repeat visit. Stays
// in localStorage — this is a per-browser flag, not shared poll data, so
// it's untouched by the Supabase migration above.
export function getVotedPollIds() {
  return readVotedPollIds();
}
export function markPollVoted(pollId) {
  const ids = readVotedPollIds();
  if (!ids.includes(pollId)) writeVotedPollIds([...ids, pollId]);
}

// Removes every poll for an experience — used when the experience itself
// is deleted, so nothing is left orphaned. The table's own experience_id
// foreign key is ON DELETE CASCADE, so this call is belt-and-braces for
// the poll rows themselves; it's still needed to also prune those same
// poll ids out of the separate, still-localStorage voted-polls list,
// since a vote record for a poll that no longer exists is itself orphaned
// data that the database cascade can't reach.
export async function deleteAllForExperience(experienceId) {
  const supabase = getSupabaseClient();
  const { data: rows, error: selectError } = await supabase
    .from(TABLE_NAME)
    .select("id")
    .eq("experience_id", Number(experienceId));

  if (selectError) {
    console.error("[pollsStore] deleteAllForExperience lookup failed:", selectError);
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("experience_id", Number(experienceId));

  if (error) {
    console.error("[pollsStore] deleteAllForExperience failed:", error);
  }

  if (rows && rows.length > 0) {
    const deletedPollIds = new Set(rows.map((row) => row.id));
    const votedIds = readVotedPollIds();
    const updatedVotedIds = votedIds.filter((id) => !deletedPollIds.has(id));
    writeVotedPollIds(updatedVotedIds);
  }
}

// One-time cleanup: this store no longer reads/writes poll data in
// localStorage, so the old "yhtbt:polls" key is dead data now rather than
// left lingering indefinitely. Existing local test polls are deliberately
// NOT migrated into Supabase — starting fresh, same choice already made
// for every other migrated store. Note "yhtbt:votedPolls" is NOT removed
// here — that key is still actively used, see above.
if (typeof window !== "undefined") {
  window.localStorage.removeItem("yhtbt:polls");
}
