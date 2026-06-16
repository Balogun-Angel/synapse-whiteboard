export type RecentWhiteboard = {
  roomId: string;
  name: string;
  createdBy: string;
  lastVisitedAt: string;
};

const RECENT_WHITEBOARDS_KEY = "synapse_recent_whiteboards";
const MAX_RECENT_WHITEBOARDS = 8;

export const getRecentWhiteboards = (): RecentWhiteboard[] => {
  const raw = localStorage.getItem(RECENT_WHITEBOARDS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as RecentWhiteboard[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const upsertRecentWhiteboard = (board: RecentWhiteboard) => {
  const existing = getRecentWhiteboards().filter((item) => item.roomId !== board.roomId);
  const next = [board, ...existing].slice(0, MAX_RECENT_WHITEBOARDS);
  localStorage.setItem(RECENT_WHITEBOARDS_KEY, JSON.stringify(next));
};

export const formatRelativeTime = (isoDate: string) => {
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) {
    return "Just now";
  }

  const elapsedMs = Date.now() - timestamp;
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);

  if (elapsedMinutes < 1) {
    return "Just now";
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
};

export const getAuthUsername = () => {
  const authUserRaw = localStorage.getItem("authUser");
  if (!authUserRaw) {
    return "You";
  }

  try {
    const authUser = JSON.parse(authUserRaw) as { username?: string };
    return authUser.username?.trim() || "You";
  } catch {
    return "You";
  }
};
