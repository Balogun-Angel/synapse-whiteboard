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

type Point = {
  y: number;
  x: number;
};

type DrawStrokePayload = {
  points: Point[];
  color: string;
  brushSize: number;
  roomId: string;
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

type StrokePayload = DrawStrokePayload & {
  id: string;
  createdAt: string;
  isUndone?: boolean;
};

type ClearCanvasPayload = {
  roomId: string;
};

type LeaveRoomPayload = {
  roomId: string;
};

type RoomPayload = {
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
  const lastPointRef = useRef<Point | null>(null);
  const currentStrokePointsRef = useRef<Point[]>([]);
  const joinedRoomRef = useRef("");

  useEffect(() => {
    joinedRoomRef.current = joinedRoom;
  }, [joinedRoom]);

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

    newSocket.on(
      "draw-live",
      ({ prevX, prevY, x, y, color, brushSize }: DrawLivePayload) => {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }

        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }

        drawLineSegment(context, prevX, prevY, x, y, color, brushSize);
      },
    );

    newSocket.on("draw-stroke", ({ points, color, brushSize }: DrawStrokePayload) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      drawStroke(context, points, color, brushSize);
    });

    newSocket.on("load-strokes", (strokes: StrokePayload[]) => {
      redrawFromStrokes(strokes);
    });

    newSocket.on("stroke-undone", (strokes: StrokePayload[]) => {
      redrawFromStrokes(strokes);
    });

    newSocket.on("stroke-redone", (strokes: StrokePayload[]) => {
      redrawFromStrokes(strokes);
    });

    newSocket.on("clear-canvas", () => {
      clearCanvasLocal();
    });

    return () => {
      newSocket.off("connect");
      newSocket.off("disconnect");
      newSocket.off("room-joined");
      newSocket.off("room-error");
      newSocket.off("connect_error");
      newSocket.off("draw-live");
      newSocket.off("draw-stroke");
      newSocket.off("load-strokes");
      newSocket.off("stroke-undone");
      newSocket.off("stroke-redone");
      newSocket.off("clear-canvas");
      newSocket.close();
      window.removeEventListener("mouseup", handleWindowMouseUp);
      socketRef.current = null;
    };
  }, []);

  const drawLineSegment = (
    context: CanvasRenderingContext2D,
    prevX: number,
    prevY: number,
    x: number,
    y: number,
    color: string,
    size: number,
  ) => {
    if (prevX === x && prevY === y) {
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, Math.max(1, size / 2), 0, Math.PI * 2);
      context.fill();
      return;
    }

    context.beginPath();
    context.moveTo(prevX, prevY);
    context.lineTo(x, y);
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
  };

  const drawStroke = (
    context: CanvasRenderingContext2D,
    points: Point[],
    color: string,
    size: number,
  ) => {
    if (points.length === 0) {
      return;
    }

    if (points.length === 1) {
      const point = points[0];
      context.fillStyle = color;
      context.beginPath();
      context.arc(point.x, point.y, Math.max(1, size / 2), 0, Math.PI * 2);
      context.fill();
      return;
    }

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index].x, points[index].y);
    }
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
  };

  const redrawFromStrokes = (strokes: StrokePayload[]) => {
    clearCanvasLocal();

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    for (const stroke of strokes) {
      drawStroke(context, stroke.points, stroke.color, stroke.brushSize);
    }
  };

  const leaveCurrentRoom = (statusMessage: string) => {
    const currentRoom = joinedRoomRef.current;
    const socket = socketRef.current;

    if (socket && currentRoom) {
      socket.emit("leave-room", { roomId: currentRoom } satisfies LeaveRoomPayload);
    }

    setJoinedRoom("");
    clearCanvasLocal();
    setRoomStatus(statusMessage);
  };

  const handleJoinRoom = () => {
    const trimmedRoomId = roomInput.trim();

    if (!trimmedRoomId) {
      leaveCurrentRoom("Please enter a room ID");
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

    isDrawingRef.current = true;
    lastPointRef.current = position;
    currentStrokePointsRef.current = [position];

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    drawStroke(context, [position], brushColor, brushSize);
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

    drawLineSegment(
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
      socket.emit("draw-live", {
        roomId: joinedRoom,
        prevX: lastPoint.x,
        prevY: lastPoint.y,
        x: position.x,
        y: position.y,
        color: brushColor,
        brushSize,
      } satisfies DrawLivePayload);
    }

    currentStrokePointsRef.current.push(position);
    lastPointRef.current = position;
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) {
      return;
    }

    const points = [...currentStrokePointsRef.current];

    isDrawingRef.current = false;
    lastPointRef.current = null;
    currentStrokePointsRef.current = [];

    if (!points.length) {
      return;
    }

    const socket = socketRef.current;
    if (socket && joinedRoom) {
      socket.emit("save-stroke", {
        points,
        color: brushColor,
        brushSize,
        roomId: joinedRoom,
      } satisfies DrawStrokePayload);
    }
  };

  const clearCanvas = () => {
    if (!joinedRoom) {
      setRoomStatus("Join a room before clearing the canvas");
      return;
    }

    clearCanvasLocal();

    const socket = socketRef.current;
    if (socket) {
      socket.emit("clear-canvas", { roomId: joinedRoom } satisfies ClearCanvasPayload);
    }
  };

  const handleUndo = () => {
    if (!joinedRoom) {
      setRoomStatus("Join a room before using undo");
      return;
    }

    const socket = socketRef.current;
    if (socket) {
      socket.emit("undo-stroke", { roomId: joinedRoom } satisfies RoomPayload);
    }
  };

  const handleRedo = () => {
    if (!joinedRoom) {
      setRoomStatus("Join a room before using redo");
      return;
    }

    const socket = socketRef.current;
    if (socket) {
      socket.emit("redo-stroke", { roomId: joinedRoom } satisfies RoomPayload);
    }
  };

  const clearCanvasLocal = () => {
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
        <button type="button" onClick={handleUndo}>
          Undo
        </button>
        <button type="button" onClick={handleRedo}>
          Redo
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