import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();

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

  socket.on("join-room", (roomId: string) => {
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
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = 5000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});