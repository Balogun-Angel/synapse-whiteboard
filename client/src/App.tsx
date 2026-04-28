import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState("");

  useEffect(() => {
    const socket: Socket = io("http://localhost:5000", {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setIsConnected(true);
      setSocketId(socket.id || "");
      console.log("Connected to server:", socket.id);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      setSocketId("");
      console.log("Disconnected from server");
    });

    socket.on("connect_error", (error) => {
      console.log("Connection error:", error.message);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.close();
    };
  }, []);

  return (
    <div>
      <h1>Synapse</h1>
      <p>Status: {isConnected ? "Connected" : "Disconnected"}</p>
      <p>Socket ID: {socketId || "None"}</p>
    </div>
  );
}

export default App;