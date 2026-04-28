import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import "./App.css";

type RoomJoinedPayload = {
  roomId: string;
  message: string;
};

type RoomErrorPayload = {
  message: string;
};

type DrawPayload = {
  prevX: number;
  prevY: number;
  x: number;
  y: number;
  color: string;
  brushSize: number;
  roomId: string;
};

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const [roomInput, setRoomInput] = useState("");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [roomStatus, setRoomStatus] = useState("");
  const [brushColor, setBrushColor] = useState("#111111");
  const [brushSize, setBrushSize] = useState(4);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const newSocket: Socket = io("http://localhost:5000", {
      transports: ["websocket", "polling"],
    });
    socketRef.current = newSocket;
    const handleWindowMouseUp = () => {
      isDrawingRef.current = false;
      lastPointRef.current = null;
    };
    window.addEventListener("mouseup", handleWindowMouseUp);

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

    newSocket.on("draw", ({ prevX, prevY, x, y, color, brushSize }: DrawPayload) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      drawLine(context, prevX, prevY, x, y, color, brushSize);
    });

    return () => {
      newSocket.off("connect");
      newSocket.off("disconnect");
      newSocket.off("room-joined");
      newSocket.off("room-error");
      newSocket.off("connect_error");
      newSocket.off("draw");
      newSocket.close();
      window.removeEventListener("mouseup", handleWindowMouseUp);
      socketRef.current = null;
    };
  }, []);

  const drawLine = (
    context: CanvasRenderingContext2D,
    prevX: number,
    prevY: number,
    x: number,
    y: number,
    color: string,
    size: number,
  ) => {
    context.beginPath();
    context.moveTo(prevX, prevY);
    context.lineTo(x, y);
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
  };

  const handleJoinRoom = () => {
    const trimmedRoomId = roomInput.trim();

    if (!trimmedRoomId) {
      setRoomStatus("Please enter a room ID");
      return;
    }

    const socket = socketRef.current;
    if (!socket || !isConnected) {
      setRoomStatus("Not connected to server");
      return;
    }

    socket.emit("join-room", trimmedRoomId);
    setRoomStatus("Joining room...");
  };

  const getMousePosition = (
    event: React.MouseEvent<HTMLCanvasElement, MouseEvent>,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - canvas.clientLeft,
      y: event.clientY - rect.top - canvas.clientTop,
    };
  };

  const startDrawing = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    const canvas = canvasRef.current;
    const position = getMousePosition(event);
    if (!canvas || !position) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    isDrawingRef.current = true;
    lastPointRef.current = position;

    context.fillStyle = brushColor;
    context.beginPath();
    context.arc(position.x, position.y, Math.max(1, brushSize / 2), 0, Math.PI * 2);
    context.fill();
  };

  const draw = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    if (!isDrawingRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const position = getMousePosition(event);
    const lastPoint = lastPointRef.current;

    if (!canvas || !position || !lastPoint) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    drawLine(
      context,
      lastPoint.x,
      lastPoint.y,
      position.x,
      position.y,
      brushColor,
      brushSize,
    );

    const socket = socketRef.current;
    if (socket && joinedRoom) {
      socket.emit("draw", {
        prevX: lastPoint.x,
        prevY: lastPoint.y,
        x: position.x,
        y: position.y,
        color: brushColor,
        brushSize,
        roomId: joinedRoom,
      } satisfies DrawPayload);
    }

    lastPointRef.current = position;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="app">
      <h1>Synapse</h1>
      <p>Status: {isConnected ? "Connected" : "Disconnected"}</p>
      <p>Socket ID: {socketId || "None"}</p>
      <div className="room-controls">
        <input
          type="text"
          value={roomInput}
          onChange={(event) => setRoomInput(event.target.value)}
          placeholder="Enter room ID"
        />
        <button type="button" onClick={handleJoinRoom}>
          Join Room
        </button>
      </div>
      <p>Current Room: {joinedRoom || "None"}</p>
      <p>Room Status: {roomStatus || "No room activity yet"}</p>

      <div className="drawing-controls">
        <label>
          Color:
          <input
            type="color"
            value={brushColor}
            onChange={(event) => setBrushColor(event.target.value)}
          />
        </label>

        <label>
          Brush Size:
          <input
            type="range"
            min={1}
            max={30}
            value={brushSize}
            onChange={(event) => setBrushSize(Number(event.target.value))}
          />
          <span>{brushSize}px</span>
        </label>

        <button type="button" onClick={clearCanvas}>
          Clear Canvas
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={900}
        height={500}
        className="whiteboard-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
    </div>
  );
}

export default App;