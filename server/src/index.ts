import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

type DrawPayload = {
  prevX: number;
  prevY: number;
  x: number;
  y: number;
  color: string;
  brushSize: number;
  roomId: string;
};

type ClearCanvasPayload = {
  roomId: string;
};

type LeaveRoomPayload = {
  roomId: string;
};

const app = express();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

app.use(express.json());

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

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", async (roomId: string) => {
    const trimmedRoomId = roomId?.trim();

    if (!trimmedRoomId) {
      socket.emit("room-error", { message: "Room ID is required" });
      return;
    }

    const joinedRooms = [...socket.rooms];

    for (const room of joinedRooms) {
      if (room !== socket.id) {
        socket.leave(room);
      }
    }

    socket.join(trimmedRoomId);
    console.log(`Socket ${socket.id} joined room ${trimmedRoomId}`);

    socket.emit("room-joined", {
      roomId: trimmedRoomId,
      message: `Joined room ${trimmedRoomId}`,
    });

    try {
      const strokes = await prisma.stroke.findMany({
        where: { roomId: trimmedRoomId },
        orderBy: { createdAt: "asc" },
      });

      socket.emit("load-strokes", strokes);
    } catch (error) {
      console.error("Failed to load strokes:", error);
      socket.emit("room-error", { message: "Failed to load room drawing history" });
    }
  });

  socket.on("draw", async (data: DrawPayload) => {
    const { roomId } = data;

    if (!roomId) {
      return;
    }

    try {
      await prisma.stroke.create({
        data: {
          roomId,
          prevX: data.prevX,
          prevY: data.prevY,
          x: data.x,
          y: data.y,
          color: data.color,
          brushSize: data.brushSize,
        },
      });
    } catch (error) {
      console.error("Failed to save stroke:", error);
    }

    socket.to(roomId).emit("draw", data);
  });

  socket.on("clear-canvas", async ({ roomId }: ClearCanvasPayload) => {
    if (!roomId) {
      return;
    }

    try {
      await prisma.stroke.deleteMany({
        where: { roomId },
      });
    } catch (error) {
      console.error("Failed to clear strokes:", error);
    }

    socket.to(roomId).emit("clear-canvas");
  });

  socket.on("leave-room", ({ roomId }: LeaveRoomPayload) => {
    const trimmedRoomId = roomId?.trim();
    if (!trimmedRoomId) {
      return;
    }

    socket.leave(trimmedRoomId);
    console.log(`Socket ${socket.id} left room ${trimmedRoomId}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = 5000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});