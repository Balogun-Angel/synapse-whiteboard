import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

type RoomJoinedPayload = {
  roomId: string;
  message: string;
};

type RoomErrorPayload = {
  message: string;
};

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomInput, setRoomInput] = useState("");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [roomStatus, setRoomStatus] = useState("");

  useEffect(() => {
    const newSocket: Socket = io("http://localhost:5000", {
      transports: ["websocket", "polling"],
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
      setSocketId(newSocket.id || "");
      console.log("Connected to server:", newSocket.id);
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
      setSocketId("");
      setJoinedRoom("");
      setRoomStatus("Disconnected from server");
      console.log("Disconnected from server");
    });

    newSocket.on("room-joined", ({ roomId, message }: RoomJoinedPayload) => {
      setJoinedRoom(roomId);
      setRoomStatus(message);
    });

    newSocket.on("room-error", ({ message }: RoomErrorPayload) => {
      setRoomStatus(message);
    });

    newSocket.on("connect_error", (error) => {
      console.log("Connection error:", error.message);
    });

    return () => {
      newSocket.off("connect");
      newSocket.off("disconnect");
      newSocket.off("room-joined");
      newSocket.off("room-error");
      newSocket.off("connect_error");
      newSocket.close();
      setSocket(null);
    };
  }, []);

  const handleJoinRoom = () => {
    const trimmedRoomId = roomInput.trim();

    if (!trimmedRoomId) {
      setRoomStatus("Please enter a room ID");
      return;
    }

    if (!socket || !isConnected) {
      setRoomStatus("Not connected to server");
      return;
    }

    socket.emit("join-room", trimmedRoomId);
    setRoomStatus("Joining room...");
  };

  return (
    <div>
      <h1>Synapse</h1>
      <p>Status: {isConnected ? "Connected" : "Disconnected"}</p>
      <p>Socket ID: {socketId || "None"}</p>
      <input
        type="text"
        value={roomInput}
        onChange={(event) => setRoomInput(event.target.value)}
        placeholder="Enter room ID"
      />
      <button type="button" onClick={handleJoinRoom}>
        Join Room
      </button>
      <p>Current Room: {joinedRoom || "None"}</p>
      <p>Room Status: {roomStatus || "No room activity yet"}</p>
    </div>
  );
}

export default App;