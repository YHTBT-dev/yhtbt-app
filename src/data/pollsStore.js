const STORAGE_KEY = "yhtbt:polls";

// Poll shape: { id, experienceId, question, options: string[],
// votes: { [option]: number }, isOpen: boolean }. votes starts at 0 for
// every option. isOpen defaults to true (open) — a closed poll is hidden
// entirely from Preview as Guest but still shown, with its status, in the
// host's own view; that filtering happens where isPreviewingAsGuest is
// known (/experiences/[id]/page.tsx), not here.

function readFromStorage() {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeToStorage(polls) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(polls));
}

function getAllPolls() {
  return readFromStorage();
}

// Entries from before isOpen existed default to open — matches how they
// always behaved (visible everywhere, no closed state existed yet).
function normalizePoll(poll) {
  return {
    ...poll,
    isOpen: poll.isOpen ?? true,
  };
}

export function getPolls(experienceId) {
  return getAllPolls()
    .filter((poll) => poll.experienceId === experienceId)
    .map(normalizePoll);
}

export function addPoll(poll) {
  const polls = getAllPolls();
  const nextId = polls.reduce((maxId, existing) => Math.max(maxId, existing.id), 0) + 1;

  const votes = {};
  for (const option of poll.options) {
    votes[option] = 0;
  }

  const newPoll = { id: nextId, isOpen: true, ...poll, votes };
  const updatedPolls = [...polls, newPoll];

  writeToStorage(updatedPolls);
  return newPoll;
}

export function setPollOpen(pollId, isOpen) {
  const polls = getAllPolls();
  let updatedPoll = null;

  const updatedPolls = polls.map((poll) => {
    if (poll.id !== pollId) return poll;
    updatedPoll = normalizePoll({ ...poll, isOpen });
    return updatedPoll;
  });

  writeToStorage(updatedPolls);
  return updatedPoll;
}

export function recordVote(pollId, option) {
  const polls = getAllPolls();
  let updatedPoll = null;

  const updatedPolls = polls.map((poll) => {
    if (poll.id !== pollId) return poll;
    updatedPoll = {
      ...poll,
      votes: { ...poll.votes, [option]: (poll.votes[option] ?? 0) + 1 },
    };
    return updatedPoll;
  });

  writeToStorage(updatedPolls);
  return updatedPoll;
}

const VOTED_POLLS_STORAGE_KEY = "yhtbt:votedPolls";

function readVotedPollIds() {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(VOTED_POLLS_STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeVotedPollIds(ids) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VOTED_POLLS_STORAGE_KEY, JSON.stringify(ids));
}

// Tracks which poll IDs this browser has already voted on, so a poll can
// show its results instead of clickable options on a repeat visit.
export function getVotedPollIds() {
  return readVotedPollIds();
}

export function markPollVoted(pollId) {
  const ids = readVotedPollIds();
  if (!ids.includes(pollId)) {
    writeVotedPollIds([...ids, pollId]);
  }
}

// Removes every poll for an experience — used when the experience itself
// is deleted, so nothing is left orphaned. Also clears those polls' IDs
// out of the separate voted-polls tracking list, since a vote record for
// a poll that no longer exists is itself orphaned data.
export function deleteAllForExperience(experienceId) {
  const polls = getAllPolls();
  const deletedPollIds = new Set(
    polls
      .filter((poll) => poll.experienceId === experienceId)
      .map((poll) => poll.id)
  );

  const remainingPolls = polls.filter(
    (poll) => poll.experienceId !== experienceId
  );
  writeToStorage(remainingPolls);

  if (deletedPollIds.size > 0) {
    const votedIds = readVotedPollIds();
    const updatedVotedIds = votedIds.filter((id) => !deletedPollIds.has(id));
    writeVotedPollIds(updatedVotedIds);
  }
}
