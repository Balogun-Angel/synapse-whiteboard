import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ACCESS_TOKEN_STORAGE_KEY } from "./auth";
import "./App.css";

type RoomJoinedPayload = {
  roomId: string;
  message: string;
  count: number;
  users: RoomUserPresence[];
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
  clientStrokeId?: string;
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

type RoomPayload = {
  roomId: string;
};

type UndoStrokePayload = RoomPayload & {
  strokeId?: string;
};

type RoomUsersUpdatedPayload = {
  roomId: string;
  count: number;
  users: RoomUserPresence[];
};

type RoomLeftPayload = {
  roomId: string;
};

type RoomUserPresence = {
  userId: string;
  connectionCount: number;
};

const BRUSH_COLORS = ["#111111", "#6366f1", "#ef4444"];

type AppProps = {
  onLogout: () => void;
};

function App({ onLogout }: AppProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const [roomInput, setRoomInput] = useState("");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [roomStatus, setRoomStatus] = useState("");
  const [roomUsersCount, setRoomUsersCount] = useState(0);
  const [roomUsers, setRoomUsers] = useState<RoomUserPresence[]>([]);
  const [brushColor, setBrushColor] = useState("#111111");
  const [brushSize, setBrushSize] = useState(4);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const currentStrokePointsRef = useRef<Point[]>([]);
  const joinedRoomRef = useRef("");
  const activeStrokesRef = useRef<StrokePayload[]>([]);
  const undoneStrokesRef = useRef<StrokePayload[]>([]);
  const pendingLocalStrokesRef = useRef<StrokePayload[]>([]);
  const pendingServerUndoMatchesRef = useRef<string[]>([]);
  const currentUserPresenceKeyRef = useRef("");

  const roomUsersRefineAndSort = ({
    users,
    currentUserPresenceKey,
  }: {
    users: RoomUserPresence[];
    currentUserPresenceKey: string;
  }) => {
    return [...users].sort((firstUser, secondUser) => {
      const firstIsCurrentUser = firstUser.userId === currentUserPresenceKey;
      const secondIsCurrentUser = secondUser.userId === currentUserPresenceKey;
      if (firstIsCurrentUser && !secondIsCurrentUser) {
        return -1;
      }
      if (!firstIsCurrentUser && secondIsCurrentUser) {
        return 1;
      }
      return firstUser.userId.localeCompare(secondUser.userId);
    });
  };

  const resetRoomState = (statusMessage: string) => {
    joinedRoomRef.current = "";
    setJoinedRoom("");
    setRoomUsersCount(0);
    setRoomUsers([]);
    activeStrokesRef.current = [];
    undoneStrokesRef.current = [];
    pendingLocalStrokesRef.current = [];
    pendingServerUndoMatchesRef.current = [];
    clearCanvasLocal();
    setRoomStatus(statusMessage);
  };

  useEffect(() => {
    joinedRoomRef.current = joinedRoom;
  }, [joinedRoom]);

  useEffect(() => {
    const authUserRaw = localStorage.getItem("authUser");
    if (authUserRaw) {
      try {
        const authUser = JSON.parse(authUserRaw) as { id?: string };
        if (typeof authUser.id === "string" && authUser.id) {
          currentUserPresenceKeyRef.current = `user:${authUser.id}`;
        }
      } catch {
        currentUserPresenceKeyRef.current = "";
      }
    }

    const accessToken =
      localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ||
      localStorage.getItem("synapse_access_token");

    const newSocket: Socket = io("http://localhost:5000", {
      transports: ["websocket", "polling"],
      auth: { token: accessToken },
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
      resetRoomState("Disconnected from server");
      console.log("Disconnected from server");
    });

    newSocket.on("room-joined", ({ roomId, message, count, users }: RoomJoinedPayload) => {
      joinedRoomRef.current = roomId;
      setJoinedRoom(roomId);
      setRoomStatus(message);
      setRoomUsersCount(count);
      setRoomUsers(
        roomUsersRefineAndSort({
          users,
          currentUserPresenceKey: currentUserPresenceKeyRef.current,
        }),
      );
    });

    newSocket.on("room-error", ({ message }: RoomErrorPayload) => {
      setRoomStatus(message);
    });

    newSocket.on("room-left", (_payload: RoomLeftPayload) => {
      resetRoomState("Left room");
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
      activeStrokesRef.current = [...strokes, ...pendingLocalStrokesRef.current];
      undoneStrokesRef.current = [];
      redrawFromStrokes(activeStrokesRef.current);
    });

    newSocket.on("stroke-undone", (strokes: StrokePayload[]) => {
      activeStrokesRef.current = [...strokes, ...pendingLocalStrokesRef.current];
      redrawFromStrokes(activeStrokesRef.current);
    });

    newSocket.on("stroke-redone", (strokes: StrokePayload[]) => {
      activeStrokesRef.current = [...strokes, ...pendingLocalStrokesRef.current];
      redrawFromStrokes(activeStrokesRef.current);
    });

    newSocket.on("stroke-saved", (savedStroke: StrokePayload) => {
      const savedClientStrokeId = savedStroke.clientStrokeId;
      if (!savedClientStrokeId) {
        return;
      }

      const pendingUndoneIndex = pendingServerUndoMatchesRef.current.findIndex(
        (pendingClientStrokeId) => pendingClientStrokeId === savedClientStrokeId,
      );

      if (pendingUndoneIndex !== -1) {
        pendingServerUndoMatchesRef.current.splice(pendingUndoneIndex, 1);
        newSocket.emit("undo-stroke", {
          roomId: savedStroke.roomId,
          strokeId: savedStroke.id,
        } satisfies UndoStrokePayload);
        return;
      }

      const pendingIndex = pendingLocalStrokesRef.current.findIndex(
        (pendingStroke) => pendingStroke.id === savedClientStrokeId,
      );

      if (pendingIndex !== -1) {
        pendingLocalStrokesRef.current.splice(pendingIndex, 1);
      }

      const localStrokeIndex = activeStrokesRef.current.findIndex(
        (stroke) => stroke.id === savedClientStrokeId,
      );

      if (localStrokeIndex !== -1) {
        activeStrokesRef.current.splice(localStrokeIndex, 1, savedStroke);
      } else if (!activeStrokesRef.current.some((stroke) => stroke.id === savedStroke.id)) {
        activeStrokesRef.current.push(savedStroke);
      }
    });

    newSocket.on("clear-canvas", () => {
      activeStrokesRef.current = [];
      undoneStrokesRef.current = [];
      pendingLocalStrokesRef.current = [];
      pendingServerUndoMatchesRef.current = [];
      clearCanvasLocal();
    });

    newSocket.on("room-users-updated", ({ roomId, count, users }: RoomUsersUpdatedPayload) => {
      if (roomId === joinedRoomRef.current) {
        setRoomUsersCount(count);
        setRoomUsers(
          roomUsersRefineAndSort({
            users,
            currentUserPresenceKey: currentUserPresenceKeyRef.current,
          }),
        );
      }
    });

    return () => {
      newSocket.off("connect");
      newSocket.off("disconnect");
      newSocket.off("room-joined");
      newSocket.off("room-error");
      newSocket.off("room-left");
      newSocket.off("connect_error");
      newSocket.off("draw-live");
      newSocket.off("draw-stroke");
      newSocket.off("load-strokes");
      newSocket.off("stroke-undone");
      newSocket.off("stroke-redone");
      newSocket.off("stroke-saved");
      newSocket.off("clear-canvas");
      newSocket.off("room-users-updated");
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

  const handleJoinRoom = () => {
    const trimmedRoomId = roomInput.trim();

    if (!trimmedRoomId) {
      const socket = socketRef.current;
      if (socket && joinedRoomRef.current) {
        socket.emit("leave-room");
      }
      resetRoomState("Please enter a room ID");
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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: Math.min(Math.max(0, (event.clientX - rect.left) * scaleX), canvas.width),
      y: Math.min(Math.max(0, (event.clientY - rect.top) * scaleY), canvas.height),
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
    const currentRoom = joinedRoomRef.current;
    if (socket && currentRoom) {
      socket.emit("draw-live", {
        roomId: currentRoom,
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
    const currentRoom = joinedRoomRef.current;
    if (!socket || !currentRoom) {
      setRoomStatus("Join a room first");
      return;
    }

    const localStrokeId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localStroke: StrokePayload = {
      id: localStrokeId,
      createdAt: new Date().toISOString(),
      points,
      color: brushColor,
      brushSize,
      roomId: currentRoom,
      clientStrokeId: localStrokeId,
      isUndone: false,
    };

    pendingLocalStrokesRef.current.push(localStroke);
    activeStrokesRef.current.push(localStroke);

    socket.emit("save-stroke", {
      points: localStroke.points,
      color: localStroke.color,
      brushSize: localStroke.brushSize,
      roomId: localStroke.roomId,
      clientStrokeId: localStrokeId,
    } satisfies DrawStrokePayload);

    undoneStrokesRef.current = [];
  };

  const clearCanvas = () => {
    const currentRoom = joinedRoomRef.current;
    if (!currentRoom) {
      setRoomStatus("Join a room first");
      return;
    }

    clearCanvasLocal();
    activeStrokesRef.current = [];
    undoneStrokesRef.current = [];
    pendingLocalStrokesRef.current = [];
    pendingServerUndoMatchesRef.current = [];

    const socket = socketRef.current;
    if (socket) {
      socket.emit("clear-canvas", { roomId: currentRoom } satisfies ClearCanvasPayload);
    }
  };

  const handleUndo = () => {
    const currentRoom = joinedRoomRef.current;
    if (!currentRoom) {
      setRoomStatus("Join a room first");
      return;
    }

    let shouldEmitUndoToServer = true;
    const localActive = activeStrokesRef.current;
    if (localActive.length > 0) {
      const strokeToUndo = localActive[localActive.length - 1];
      activeStrokesRef.current = localActive.slice(0, -1);
      undoneStrokesRef.current = [...undoneStrokesRef.current, strokeToUndo];

      if (strokeToUndo.id.startsWith("local-")) {
        shouldEmitUndoToServer = false;
        pendingLocalStrokesRef.current = pendingLocalStrokesRef.current.filter((pendingStroke) => {
          return pendingStroke.id !== strokeToUndo.id;
        });
        pendingServerUndoMatchesRef.current.push(strokeToUndo.id);
      }

      redrawFromStrokes(activeStrokesRef.current);
    }

    const socket = socketRef.current;
    if (socket && shouldEmitUndoToServer) {
      socket.emit("undo-stroke", { roomId: currentRoom } satisfies RoomPayload);
    }
  };

  const handleRedo = () => {
    const currentRoom = joinedRoomRef.current;
    if (!currentRoom) {
      setRoomStatus("Join a room first");
      return;
    }

    const strokeToRestore = undoneStrokesRef.current.pop();
    if (!strokeToRestore) {
      return;
    }

    activeStrokesRef.current = [...activeStrokesRef.current, strokeToRestore];

    if (strokeToRestore.id.startsWith("local-")) {
      pendingServerUndoMatchesRef.current = pendingServerUndoMatchesRef.current.filter(
        (pendingClientStrokeId) => pendingClientStrokeId !== strokeToRestore.id,
      );

      if (!pendingLocalStrokesRef.current.some((stroke) => stroke.id === strokeToRestore.id)) {
        pendingLocalStrokesRef.current.push(strokeToRestore);
      }
    }

    redrawFromStrokes(activeStrokesRef.current);

    const socket = socketRef.current;
    if (socket) {
      socket.emit("redo-stroke", { roomId: currentRoom } satisfies RoomPayload);
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

  const displayedUsers = roomUsers.length
    ? roomUsers.map((user, index) => ({
        id: user.userId,
        label:
          user.userId === currentUserPresenceKeyRef.current
            ? "You"
            : `User ${index + 1}`,
      }))
    : [{ id: "you-fallback", label: "You" }];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">Synapse</div>
        <div className="topbar__room">Room: {joinedRoom || "None"}</div>
        <div className="topbar__users">
          Users: {joinedRoom ? roomUsersCount : 0}
          <button type="button" className="topbar__logout" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar__section">
            <h2 className="sidebar__title">Users</h2>
            <div className="user-list">
              {displayedUsers.map((user, index) => (
                <div
                  key={user.id}
                  className={`user-row${user.id === currentUserPresenceKeyRef.current || (index === 0 && displayedUsers.length === 1) ? " user-row--active" : ""}`}
                >
                  <div className="user-avatar">{user.label.charAt(0)}</div>
                  <span className="user-name">{user.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar__section sidebar__section--controls">
            <p className="sidebar__label">Join a room</p>
            <div className="room-controls">
              <input
                type="text"
                value={roomInput}
                onChange={(event) => setRoomInput(event.target.value)}
                placeholder="Enter room ID"
                className="room-input"
              />
              <button type="button" onClick={handleJoinRoom} className="join-button">
                Join Room
              </button>
            </div>
            <p className="sidebar__meta">Status: {isConnected ? "Connected" : "Disconnected"}</p>
            <p className="sidebar__meta">Socket ID: {socketId || "None"}</p>
            <p className="sidebar__meta">Room Status: {roomStatus || "No room activity yet"}</p>
          </div>
        </aside>

        <main className="board-area">
          <div className="board-card">
            <div className="whiteboard-shell">
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

            <div className="toolbar">
              <div className="toolbar__colors">
                {BRUSH_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch${brushColor === color ? " color-swatch--active" : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setBrushColor(color)}
                    aria-label={`Select ${color} brush color`}
                  />
                ))}
                <input
                  type="color"
                  value={brushColor}
                  onChange={(event) => setBrushColor(event.target.value)}
                  className="color-picker"
                  aria-label="Choose custom brush color"
                />
              </div>

              <div className="toolbar__divider" />

              <label className="toolbar__slider" aria-label="Brush size">
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={brushSize}
                  onChange={(event) => setBrushSize(Number(event.target.value))}
                />
                <span>{brushSize}px</span>
              </label>

              <div className="toolbar__divider" />

              <button type="button" onClick={handleUndo} className="toolbar__button">
                Undo
              </button>
              <button type="button" onClick={handleRedo} className="toolbar__button">
                Redo
              </button>
              <button type="button" onClick={clearCanvas} className="toolbar__button toolbar__button--danger">
                Clear
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;