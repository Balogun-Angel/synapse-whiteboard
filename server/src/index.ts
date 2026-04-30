import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import type { Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { randomBytes } from "crypto";
import { createClient } from "redis";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "./generated/prisma/client";

type Point = {
  x: number;
  y: number;
};

type DrawStrokePayload = {
  points: Point[];
  color: string;
  brushSize: number;
  roomId: string;
  clientStrokeId?: string;
};

type RoomJoinedPayload = {
  roomId: string;
  message: string;
  count: number;
  users: {
    userId: string;
    connectionCount: number;
  }[];
};

type DrawLivePayload = {
  roomId: string;
  prevX: number;
  prevY: number;
  x: number;
  y: number;
  color: string;
  brushSize: number;
};

type ClearCanvasPayload = {
  roomId: string;
};

type RoomPayload = {
  roomId: string;
};

type UndoStrokePayload = RoomPayload & {
  strokeId?: string;
};

type RoomUsersUpdatedPayload = {
  roomId: string;
  count: number;
  users: {
    userId: string;
    connectionCount: number;
  }[];
};

type RoomLeftPayload = {
  roomId: string;
};

type StrokeSocketPayload = {
  id: string;
  roomId: string;
  points: Point[];
  color: string;
  brushSize: number;
  isUndone: boolean;
  createdAt: string;
  clientStrokeId?: string;
};

type StrokeSavedPayload = StrokeSocketPayload;
type AuthUserPayload = {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

const MAX_ROOM_USERS = 50;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 7;
const SALT_ROUNDS = 10;

const app = express();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const accessSecret = process.env.JWT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;

if (!accessSecret || !refreshSecret) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set");
}

const toAuthUserPayload = (user: {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}): AuthUserPayload => {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
};

const createAccessToken = (user: { id: string; email: string }) => {
  return jwt.sign(
    { sub: user.id, email: user.email },
    accessSecret,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );
};

const createRefreshTokenValue = (userId: string) => {
  const randomPart = randomBytes(40).toString("hex");
  return jwt.sign(
    { sub: userId, nonce: randomPart },
    refreshSecret,
    { expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d` },
  );
};

const parseBearerToken = (authorizationHeader?: string) => {
  if (!authorizationHeader) {
    return null;
  }
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
};

const getSocketUserId = (socket: Socket) => {
  const socketData = socket.data as { userId?: string | null };
  return socketData.userId ?? null;
};

const getPresenceKeyForSocket = (socket: Socket) => {
  const userId = getSocketUserId(socket);
  return userId ? `user:${userId}` : `guest:${socket.id}`;
};

const getRoomPresence = (roomId: string) => {
  const socketIds = io.sockets.adapter.rooms.get(roomId);
  if (!socketIds) {
    return [];
  }

  const presenceByUser = new Map<string, { userId: string; connectionCount: number }>();

  for (const socketId of socketIds) {
    const roomSocket = io.sockets.sockets.get(socketId);
    if (!roomSocket) {
      continue;
    }

    const presenceKey = getPresenceKeyForSocket(roomSocket);
    const currentPresence = presenceByUser.get(presenceKey);
    if (currentPresence) {
      currentPresence.connectionCount += 1;
      continue;
    }

    presenceByUser.set(presenceKey, {
      userId: presenceKey,
      connectionCount: 1,
    });
  }

  return Array.from(presenceByUser.values());
};

const emitRoomUsersUpdated = (roomId: string) => {
  const users = getRoomPresence(roomId);
  io.to(roomId).emit("room-users-updated", {
    roomId,
    count: users.length,
    users,
  } satisfies RoomUsersUpdatedPayload);
};

const fetchActiveStrokes = async (roomId: string) => {
  return prisma.stroke.findMany({
    select: {
      id: true,
      roomId: true,
      points: true,
      color: true,
      brushSize: true,
      createdAt: true,
      updatedAt: true,
      isUndone: true,
    },
    where: {
      roomId,
      isUndone: false,
    },
    orderBy: { createdAt: "asc" },
  });
};

const toStrokeSocketPayload = (
  stroke: Awaited<ReturnType<typeof fetchActiveStrokes>>[number],
): StrokeSocketPayload => {
  return {
    id: stroke.id,
    roomId: stroke.roomId,
    points: Array.isArray(stroke.points) ? (stroke.points as unknown as Point[]) : [],
    color: stroke.color,
    brushSize: stroke.brushSize,
    isUndone: stroke.isUndone,
    createdAt: stroke.createdAt.toISOString(),
  };
};

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

app.use(express.json());

app.post("/auth/signup", async (req, res) => {
  const { username, email, password } = req.body ?? {};
  const normalizedUsername = typeof username === "string" ? username.trim() : "";
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedPassword = typeof password === "string" ? password : "";

  if (!normalizedUsername || !normalizedEmail || !normalizedPassword) {
    res.status(400).json({ message: "username, email, and password are required" });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(normalizedPassword, SALT_ROUNDS);
    const createdUser = await prisma.user.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
      },
    });

    res.status(201).json({ user: toAuthUserPayload(createdUser) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ message: "Username or email already exists" });
      return;
    }
    console.error("Failed to sign up:", error);
    res.status(500).json({ message: "Failed to create account" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedPassword = typeof password === "string" ? password : "";

  if (!normalizedEmail || !normalizedPassword) {
    res.status(400).json({ message: "email and password are required" });
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!existingUser) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const passwordMatches = await bcrypt.compare(normalizedPassword, existingUser.passwordHash);
    if (!passwordMatches) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const accessToken = createAccessToken(existingUser);
    const refreshToken = createRefreshTokenValue(existingUser.id);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: existingUser.id,
        expiresAt,
      },
    });

    res.json({
      accessToken,
      refreshToken,
      user: toAuthUserPayload(existingUser),
    });
  } catch (error) {
    console.error("Failed to login:", error);
    res.status(500).json({ message: "Failed to login" });
  }
});

app.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  const tokenValue = typeof refreshToken === "string" ? refreshToken : "";
  if (!tokenValue) {
    res.status(400).json({ message: "refreshToken is required" });
    return;
  }

  let storedToken;
  try {
    storedToken = await prisma.refreshToken.findUnique({
      where: { token: tokenValue },
      include: { user: true },
    });
  } catch (error) {
    console.error("Failed to look up refresh token:", error);
    res.status(500).json({ message: "Failed to refresh token" });
    return;
  }

  if (!storedToken) {
    res.status(401).json({ message: "Invalid refresh token" });
    return;
  }

  if (storedToken.expiresAt <= new Date()) {
    try {
      await prisma.refreshToken.deleteMany({ where: { id: storedToken.id } });
    } catch (error) {
      console.error("Failed to delete expired refresh token:", error);
      res.status(500).json({ message: "Failed to refresh token" });
      return;
    }
    res.status(401).json({ message: "Refresh token expired or invalid" });
    return;
  }

  try {
    jwt.verify(tokenValue, refreshSecret);
  } catch {
    res.status(401).json({ message: "Invalid refresh token" });
    return;
  }

  type RefreshTxResult =
    | { status: "already_used" }
    | { status: "ok"; user: { id: string; email: string; username: string; createdAt: Date; updatedAt: Date }; nextRefreshToken: string };

  try {
    const rotation = await prisma.$transaction(async (tx) => {
      const deleteResult = await tx.refreshToken.deleteMany({
        where: { id: storedToken.id, token: tokenValue },
      });

      if (deleteResult.count === 0) {
        return { status: "already_used" } satisfies RefreshTxResult;
      }

      const nextRefreshToken = createRefreshTokenValue(storedToken.user.id);
      const nextRefreshExpiresAt = new Date(
        Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      );

      await tx.refreshToken.create({
        data: {
          token: nextRefreshToken,
          userId: storedToken.user.id,
          expiresAt: nextRefreshExpiresAt,
        },
      });

      return {
        status: "ok",
        user: storedToken.user,
        nextRefreshToken,
      } satisfies RefreshTxResult;
    });

    if (rotation.status === "already_used") {
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    const accessToken = createAccessToken(rotation.user);
    res.json({
      accessToken,
      refreshToken: rotation.nextRefreshToken,
      user: toAuthUserPayload(rotation.user),
    });
  } catch (error) {
    console.error("Failed to refresh access token:", error);
    res.status(500).json({ message: "Failed to refresh token" });
  }
});

app.post("/auth/logout", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  const tokenValue = typeof refreshToken === "string" ? refreshToken : "";
  if (!tokenValue) {
    res.status(400).json({ message: "refreshToken is required" });
    return;
  }

  try {
    await prisma.refreshToken.deleteMany({
      where: { token: tokenValue },
    });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to logout:", error);
    res.status(500).json({ message: "Failed to logout" });
  }
});

app.get("/auth/me", async (req, res) => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ message: "Missing or invalid authorization header" });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, accessSecret) as JwtPayload;
  } catch {
    res.status(401).json({ message: "Invalid access token" });
    return;
  }

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  if (!userId) {
    res.status(401).json({ message: "Invalid access token payload" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({ user: toAuthUserPayload(user) });
  } catch (error) {
    console.error("Failed to fetch current user:", error);
    res.status(500).json({ message: "Failed to fetch current user" });
  }
});

// simple test route
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const server = http.createServer(app);

// socket.io setup
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const setupRedisAdapter = async () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn("Redis adapter disabled: REDIS_URL is not set.");
    return;
  }

  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  pubClient.on("error", (error) => {
    console.warn("Redis pub client error:", error.message);
  });
  subClient.on("error", (error) => {
    console.warn("Redis sub client error:", error.message);
  });

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Redis adapter connected");
  } catch (error) {
    console.warn("Redis adapter unavailable. Running without Redis pub/sub.");
    if (error instanceof Error) {
      console.warn(`Redis connection error: ${error.message}`);
    }
  }
};

void setupRedisAdapter();

io.use((socket, next) => {
  const handshakeToken = socket.handshake.auth?.token;
  const token =
    typeof handshakeToken === "string" && handshakeToken
      ? handshakeToken
      : parseBearerToken(socket.handshake.headers.authorization);

  if (!token) {
    (socket.data as { userId?: string | null }).userId = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, accessSecret) as JwtPayload;
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    (socket.data as { userId?: string | null }).userId = userId;
    next();
  } catch {
    (socket.data as { userId?: string | null }).userId = null;
    next();
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  socket.data.currentRoom = null as string | null;
  const isSocketAuthorizedForRoom = (roomId: string) => {
    const currentRoom = socket.data.currentRoom as string | null;
    return currentRoom === roomId && socket.rooms.has(roomId);
  };

  socket.on("join-room", async (roomId: string) => {
    const trimmedRoomId = roomId?.trim();

    if (!trimmedRoomId) {
      socket.emit("room-error", { message: "Room ID is required" });
      return;
    }

    const previousRoom = socket.data.currentRoom as string | null;
    const thisSocketPresenceKey = getPresenceKeyForSocket(socket);

    if (previousRoom !== trimmedRoomId) {
      const usersInTargetRoom = getRoomPresence(trimmedRoomId);
      const uniqueUsersCount = usersInTargetRoom.length;
      const alreadyPresentInRoom = usersInTargetRoom.some((user) => user.userId === thisSocketPresenceKey);

      // Allow only one active tab per authenticated user in the same room.
      // Keep app access available, but prompt user to close the extra tab.
      if (thisSocketPresenceKey.startsWith("user:") && alreadyPresentInRoom) {
        socket.emit("room-error", {
          message:
            "You already joined this room in another tab. Please close the other tab and try again.",
        });
        return;
      }

      if (uniqueUsersCount >= MAX_ROOM_USERS && !alreadyPresentInRoom) {
        socket.emit("room-error", { message: "Sorry, this room is full." });
        return;
      }
    }

    if (previousRoom && previousRoom !== trimmedRoomId) {
      socket.leave(previousRoom);
      emitRoomUsersUpdated(previousRoom);
    }

    socket.join(trimmedRoomId);
    socket.data.currentRoom = trimmedRoomId;
    const usersInRoom = getRoomPresence(trimmedRoomId);
    const count = usersInRoom.length;
    console.log(`Socket ${socket.id} joined room ${trimmedRoomId}`);

    socket.emit("room-joined", {
      roomId: trimmedRoomId,
      message: `Joined room ${trimmedRoomId}`,
      count,
      users: usersInRoom,
    } satisfies RoomJoinedPayload);

    emitRoomUsersUpdated(trimmedRoomId);

    try {
      const strokes = await fetchActiveStrokes(trimmedRoomId);
      const strokePayloads = strokes.map(toStrokeSocketPayload);

      socket.emit("load-strokes", strokePayloads);
    } catch (error) {
      console.error("Failed to load strokes:", error);
      socket.emit("room-error", { message: "Failed to load room drawing history" });
    }
  });

  socket.on("draw-live", (data: DrawLivePayload) => {
    const { roomId, prevX, prevY, x, y, color, brushSize } = data;

    if (!roomId) {
      return;
    }

    if (!isSocketAuthorizedForRoom(roomId)) {
      return;
    }

    if (
      !Number.isFinite(prevX) ||
      !Number.isFinite(prevY) ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(brushSize)
    ) {
      return;
    }

    socket.to(roomId).emit("draw-live", {
      roomId,
      prevX,
      prevY,
      x,
      y,
      color,
      brushSize,
    } satisfies DrawLivePayload);
  });

  socket.on("save-stroke", async (data: DrawStrokePayload) => {
    const { roomId, points, color, brushSize, clientStrokeId } = data;

    if (!roomId || !Array.isArray(points) || points.length === 0 || !clientStrokeId) {
      return;
    }

    if (!isSocketAuthorizedForRoom(roomId)) {
      return;
    }

    try {
      const createdStroke = await prisma.stroke.create({
        data: {
          roomId,
          points: points as unknown as Prisma.InputJsonValue,
          color,
          brushSize: Math.round(brushSize),
          isUndone: false,
        },
      });

      socket.to(roomId).emit("draw-stroke", data);
      socket.emit("stroke-saved", {
        id: createdStroke.id,
        roomId: createdStroke.roomId,
        points: Array.isArray(createdStroke.points)
          ? (createdStroke.points as unknown as Point[])
          : [],
        color: createdStroke.color,
        brushSize: createdStroke.brushSize,
        isUndone: createdStroke.isUndone,
        createdAt: createdStroke.createdAt.toISOString(),
        clientStrokeId,
      } satisfies StrokeSavedPayload);
    } catch (error) {
      console.error("Failed to save stroke:", error);
    }
  });

  socket.on("undo-stroke", async ({ roomId, strokeId }: UndoStrokePayload) => {
    if (!roomId) {
      return;
    }

    if (!isSocketAuthorizedForRoom(roomId)) {
      return;
    }

    try {
      const latestStroke = strokeId
        ? await prisma.stroke.findFirst({
            where: {
              id: strokeId,
              roomId,
              isUndone: false,
            },
          })
        : await prisma.stroke.findFirst({
            where: {
              roomId,
              isUndone: false,
            },
            orderBy: { createdAt: "desc" },
          });

      if (!latestStroke) {
        return;
      }

      await prisma.stroke.update({
        where: { id: latestStroke.id },
        data: { isUndone: true },
      });

      const activeStrokes = await fetchActiveStrokes(roomId);
      const strokePayloads = activeStrokes.map(toStrokeSocketPayload);

      socket.emit("stroke-undone", strokePayloads);
      socket.to(roomId).emit("stroke-undone", strokePayloads);
    } catch (error) {
      console.error("Failed to undo stroke:", error);
    }
  });

  socket.on("redo-stroke", async ({ roomId }: RoomPayload) => {
    if (!roomId) {
      return;
    }

    if (!isSocketAuthorizedForRoom(roomId)) {
      return;
    }

    try {
      const latestUndoneStroke = await prisma.stroke.findFirst({
        where: {
          roomId,
          isUndone: true,
        },
        orderBy: { updatedAt: "desc" },
      });

      if (!latestUndoneStroke) {
        return;
      }

      await prisma.stroke.update({
        where: { id: latestUndoneStroke.id },
        data: { isUndone: false },
      });

      const activeStrokes = await fetchActiveStrokes(roomId);
      const strokePayloads = activeStrokes.map(toStrokeSocketPayload);

      socket.emit("stroke-redone", strokePayloads);
      socket.to(roomId).emit("stroke-redone", strokePayloads);
    } catch (error) {
      console.error("Failed to redo stroke:", error);
    }
  });

  socket.on("clear-canvas", async ({ roomId }: ClearCanvasPayload) => {
    if (!roomId) {
      return;
    }

    if (!isSocketAuthorizedForRoom(roomId)) {
      return;
    }

    try {
      await prisma.stroke.deleteMany({
        where: { roomId },
      });
      io.to(roomId).emit("clear-canvas");
    } catch (error) {
      console.error("Failed to clear strokes:", error);
    }
  });

  socket.on("leave-room", () => {
    const currentRoom = socket.data.currentRoom as string | null;
    if (!currentRoom) {
      return;
    }

    socket.leave(currentRoom);
    socket.data.currentRoom = null;

    emitRoomUsersUpdated(currentRoom);
    socket.emit("room-left", {
      roomId: currentRoom,
    } satisfies RoomLeftPayload);
    console.log(`Socket ${socket.id} left room ${currentRoom}`);
  });

  socket.on("disconnect", () => {
    const currentRoom = socket.data.currentRoom as string | null;
    if (currentRoom) {
      emitRoomUsersUpdated(currentRoom);
    }
    socket.data.currentRoom = null;
    console.log("User disconnected:", socket.id);
  });
});

const PORT = 5000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});