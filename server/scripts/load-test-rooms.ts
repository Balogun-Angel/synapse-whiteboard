import { io, Socket } from "socket.io-client";

type RoomJoinedPayload = {
  roomId: string;
  message: string;
  count: number;
  users: Array<{
    userId: string;
    connectionCount: number;
  }>;
};

type RoomUsersUpdatedPayload = {
  roomId: string;
  count: number;
  users: Array<{
    userId: string;
    connectionCount: number;
  }>;
};

type RoomErrorPayload = {
  message: string;
};

const SERVER_URL = "http://localhost:5000";
const ROOM_ID = "load-test-room";
const TARGET_CLIENTS = 50;
const CONNECTION_TIMEOUT_MS = 8000;

const clients: Socket[] = [];

const waitForEvent = <T>(
  socket: Socket,
  eventName: string,
  timeoutMs: number,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for "${eventName}"`));
    }, timeoutMs);

    const onEvent = (payload: T) => {
      clearTimeout(timeoutHandle);
      socket.off(eventName, onEvent);
      resolve(payload);
    };

    socket.once(eventName, onEvent);
  });
};

const createClient = (label: string): Socket => {
  const socket = io(SERVER_URL, {
    transports: ["websocket", "polling"],
    forceNew: true,
    reconnection: false,
  });

  socket.on("connect", () => {
    console.log(`[${label}] connected: ${socket.id}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[${label}] disconnected: ${reason}`);
  });

  socket.on("room-users-updated", (payload: RoomUsersUpdatedPayload) => {
    if (payload.roomId === ROOM_ID) {
      console.log(`[${label}] room-users-updated count=${payload.count}`);
    }
  });

  return socket;
};

const disconnectAllClients = () => {
  for (const client of clients) {
    if (client.connected) {
      client.disconnect();
    }
  }
};

const run = async () => {
  try {
    console.log(`Starting room load test against ${SERVER_URL}`);

    for (let index = 0; index < TARGET_CLIENTS; index += 1) {
      const clientNumber = index + 1;
      const label = `client-${clientNumber}`;
      const socket = createClient(label);
      clients.push(socket);

      await waitForEvent(socket, "connect", CONNECTION_TIMEOUT_MS);
      socket.emit("join-room", ROOM_ID);

      const roomJoined = await waitForEvent<RoomJoinedPayload>(
        socket,
        "room-joined",
        CONNECTION_TIMEOUT_MS,
      );

      console.log(
        `[${label}] room-joined room=${roomJoined.roomId} count=${roomJoined.count}`,
      );
    }

    const finalCount = clients.length;
    console.log(`Final joined clients: ${finalCount}`);
    if (finalCount !== TARGET_CLIENTS) {
      throw new Error(`Expected ${TARGET_CLIENTS} joined clients, got ${finalCount}`);
    }

    const extraClient = createClient("client-51");
    clients.push(extraClient);
    await waitForEvent(extraClient, "connect", CONNECTION_TIMEOUT_MS);
    extraClient.emit("join-room", ROOM_ID);

    const roomError = await waitForEvent<RoomErrorPayload>(
      extraClient,
      "room-error",
      CONNECTION_TIMEOUT_MS,
    );

    if (roomError.message !== "Sorry, this room is full.") {
      throw new Error(`Unexpected 51st client response: "${roomError.message}"`);
    }

    console.log('51st client rejected with expected message: "Sorry, this room is full."');
    console.log("Load test passed.");
  } finally {
    disconnectAllClients();
  }
};

void run().catch((error) => {
  console.error("Load test failed:", error);
  process.exitCode = 1;
});
