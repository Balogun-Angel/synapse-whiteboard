import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";
import {
  formatRelativeTime,
  getAuthUsername,
  getRecentWhiteboards,
  upsertRecentWhiteboard,
} from "./utils/recentWhiteboards";
import { buildRoomPath, generateRoomId, parseRoomIdFromInput } from "./utils/room";

type DashboardPageProps = {
  onLogout: () => void;
};

type CreateModalProps = {
  onClose: () => void;
  onCreate: (payload: { roomId: string; roomName: string }) => void;
};

type JoinModalProps = {
  onClose: () => void;
  onJoin: (roomId: string) => void;
};

function SynapseLogoIcon() {
  return (
    <svg
      className="dashboard-header__logo-icon"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="11" cy="13" r="2.5" fill="currentColor" />
      <circle cx="21" cy="13" r="2.5" fill="currentColor" />
      <circle cx="16" cy="21" r="2.5" fill="currentColor" />
      <path
        d="M11 13 L16 21 M21 13 L16 21 M11 13 L21 13"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="dashboard-action-card__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="dashboard-action-card__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg className="dashboard-footer__icon" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="7" cy="7" r="3" fill="currentColor" />
      <circle cx="14" cy="8" r="2.5" fill="currentColor" opacity="0.85" />
      <path
        d="M2 17c0-3 2.5-5 5-5s5 2 5 5M11 17c0-2.2 1.6-4 3.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg className="dashboard-footer__sparkle" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 2l1.2 4.2L15 7.5l-3.8 1.3L10 13l-1.2-4.2L5 7.5l3.8-1.3L10 2z"
        fill="currentColor"
      />
    </svg>
  );
}

function CreateWhiteboardModal({ onClose, onCreate }: CreateModalProps) {
  const [roomName, setRoomName] = useState("");
  const [optionalPassword, setOptionalPassword] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [status, setStatus] = useState("");

  const handleCreate = () => {
    const trimmedName = roomName.trim();
    if (!trimmedName) {
      setStatus("Please enter a whiteboard name");
      return;
    }

    const roomId = generateRoomId();
    onCreate({ roomId, roomName: trimmedName });

    if (optionalPassword) {
      // Password storage/validation will be added in a later phase.
      void optionalPassword;
    }

    if (isPrivate) {
      // Visibility handling will be added in a later phase.
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-whiteboard-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="create-whiteboard-title" className="modal-title">
          Create New Whiteboard
        </h2>

        <label className="modal-label" htmlFor="whiteboard-name">
          Whiteboard Name
        </label>
        <input
          id="whiteboard-name"
          type="text"
          value={roomName}
          onChange={(event) => setRoomName(event.target.value)}
          className="modal-input"
          placeholder="Whiteboard Name"
        />

        <label className="modal-label" htmlFor="optional-password">
          Optional Password
        </label>
        <input
          id="optional-password"
          type="password"
          value={optionalPassword}
          onChange={(event) => setOptionalPassword(event.target.value)}
          className="modal-input"
          placeholder="Optional Password"
        />

        <div className="modal-toggle-row">
          <span className={`modal-toggle-label${!isPrivate ? " modal-toggle-label--active" : ""}`}>
            Public
          </span>
          <button
            type="button"
            className={`modal-toggle${isPrivate ? " modal-toggle--on" : ""}`}
            aria-pressed={isPrivate}
            onClick={() => setIsPrivate((current) => !current)}
          >
            <span className="modal-toggle__thumb" />
          </button>
          <span className={`modal-toggle-label${isPrivate ? " modal-toggle-label--active" : ""}`}>
            Private
          </span>
        </div>

        {status ? <p className="modal-status">{status}</p> : null}

        <button type="button" className="modal-submit" onClick={handleCreate}>
          Create
        </button>
      </div>
    </div>
  );
}

function JoinRoomModal({ onClose, onJoin }: JoinModalProps) {
  const [roomInput, setRoomInput] = useState("");
  const [optionalPassword, setOptionalPassword] = useState("");
  const [status, setStatus] = useState("");

  const handleJoin = () => {
    const roomId = parseRoomIdFromInput(roomInput);
    if (!roomId) {
      setStatus("Please enter a room ID or link");
      return;
    }

    if (optionalPassword) {
      // Password verification will be added in a later phase.
      void optionalPassword;
    }

    onJoin(roomId);
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-room-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="join-room-title" className="modal-title">
          Join Existing Room
        </h2>

        <label className="modal-label" htmlFor="join-room-input">
          Room ID or Link
        </label>
        <input
          id="join-room-input"
          type="text"
          value={roomInput}
          onChange={(event) => setRoomInput(event.target.value)}
          className="modal-input"
          placeholder="Enter room ID or paste /room/... link"
        />

        <label className="modal-label" htmlFor="join-room-password">
          Room Password (if required)
        </label>
        <input
          id="join-room-password"
          type="password"
          value={optionalPassword}
          onChange={(event) => setOptionalPassword(event.target.value)}
          className="modal-input"
          placeholder="Optional Password"
        />

        {status ? <p className="modal-status">{status}</p> : null}

        <div className="modal-actions">
          <button type="button" className="modal-submit" onClick={handleJoin}>
            Join
          </button>
          <button type="button" className="modal-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardPage({ onLogout }: DashboardPageProps) {
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [recentWhiteboards, setRecentWhiteboards] = useState(() => getRecentWhiteboards());

  const recordRecentWhiteboard = (roomId: string, name: string) => {
    const createdBy = getAuthUsername();
    upsertRecentWhiteboard({
      roomId,
      name,
      createdBy,
      lastVisitedAt: new Date().toISOString(),
    });
    setRecentWhiteboards(getRecentWhiteboards());
  };

  const handleCreateWhiteboard = ({ roomId, roomName }: { roomId: string; roomName: string }) => {
    setIsCreateOpen(false);
    recordRecentWhiteboard(roomId, roomName);
    navigate(buildRoomPath(roomId), {
      state: { created: true, roomName },
    });
  };

  const handleJoinRoom = (roomId: string) => {
    setIsJoinOpen(false);
    recordRecentWhiteboard(roomId, roomId);
    navigate(buildRoomPath(roomId));
  };

  const handleEnterRecent = (roomId: string, name: string) => {
    recordRecentWhiteboard(roomId, name);
    navigate(buildRoomPath(roomId));
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__brand">
          <SynapseLogoIcon />
          <span className="dashboard-header__title">Synapse</span>
        </div>
        <button type="button" className="dashboard-header__logout" onClick={onLogout}>
          Logout
        </button>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-hero" aria-label="Synapse dashboard">
          <h1 className="dashboard-hero__title">Start Sketching in Real Time</h1>
          <p className="dashboard-hero__subtitle">Choose your Synapse path below:</p>

          <div className="dashboard-actions">
            <button
              type="button"
              className="dashboard-action-card dashboard-action-card--create"
              onClick={() => setIsCreateOpen(true)}
            >
              <PlusIcon />
              <span>Create New Whiteboard</span>
            </button>
            <button
              type="button"
              className="dashboard-action-card dashboard-action-card--join"
              onClick={() => setIsJoinOpen(true)}
            >
              <LinkIcon />
              <span>Join Existing Room</span>
            </button>
          </div>

          <div className="dashboard-recent">
            <h2 className="dashboard-recent__title">Recent Whiteboards</h2>
            <div className="dashboard-recent__table-wrap">
              <table className="dashboard-recent__table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Created By</th>
                    <th scope="col">Last Action</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentWhiteboards.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="dashboard-recent__empty">
                        No recent whiteboards yet. Create or join one to get started.
                      </td>
                    </tr>
                  ) : (
                    recentWhiteboards.map((board) => (
                      <tr key={board.roomId}>
                        <td className="dashboard-recent__name">{board.name}</td>
                        <td className="dashboard-recent__creator">{board.createdBy}</td>
                        <td>{formatRelativeTime(board.lastVisitedAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="dashboard-recent__enter"
                            onClick={() => handleEnterRecent(board.roomId, board.name)}
                          >
                            Enter
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <footer className="dashboard-footer">
            <div className="dashboard-footer__content">
              <PeopleIcon />
              <span>5 people online | Synapse v1.2</span>
            </div>
            <SparkleIcon />
          </footer>
        </section>
      </main>

      {isCreateOpen ? (
        <CreateWhiteboardModal
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreateWhiteboard}
        />
      ) : null}

      {isJoinOpen ? (
        <JoinRoomModal onClose={() => setIsJoinOpen(false)} onJoin={handleJoinRoom} />
      ) : null}
    </div>
  );
}

export default DashboardPage;
