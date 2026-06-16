export const generateRoomId = () => {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `room-${suffix}`;
};

export const parseRoomIdFromInput = (rawInput: string) => {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const asUrl = new URL(trimmed, window.location.origin);
    const pathMatch = asUrl.pathname.match(/\/room\/([^/]+)/);
    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]);
    }
  } catch {
    // Not a URL; treat as a plain room id.
  }

  if (trimmed.startsWith("/room/")) {
    return trimmed.slice("/room/".length).split("/")[0] ?? "";
  }

  return trimmed;
};

export const buildRoomPath = (roomId: string) => {
  return `/room/${encodeURIComponent(roomId)}`;
};
