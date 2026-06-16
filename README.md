# 🧠 Synapse

**Real-time collaborative whiteboard for teams who think better together.**

Synapse is a full-stack web application that lets authenticated users create whiteboard rooms, share invite links, and draw on a shared canvas in real time — with live cursors, stroke sync, undo/redo, and presence awareness.

[![Live Demo](https://img.shields.io/badge/Live_Demo-3.14.84.70-6366f1?style=for-the-badge)](http://3.14.84.70)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square&logo=socket.io&logoColor=white)](https://socket.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![AWS](https://img.shields.io/badge/AWS-EC2-FF9900?style=flat-square&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/ec2/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

---

## 🌐 Live Demo

**[http://3.14.84.70](http://3.14.84.70)**

> Create an account, open the dashboard, start a whiteboard, and share the room link with a teammate to collaborate instantly.

---

## 📸 Screenshots

| Login | Dashboard |
|:---:|:---:|
| ![Login page](./docs/screenshots/login.png) | ![Dashboard](./docs/screenshots/dashboard.png) |
| *Secure JWT-based authentication* | *Create or join whiteboards from a polished landing page* |

| Create Whiteboard | Join Room |
|:---:|:---:|
| ![Create Whiteboard modal](./docs/screenshots/create-whiteboard.png) | ![Join Room modal](./docs/screenshots/join-room.png) |
| *Name your board, set visibility, optional password* | *Enter a room ID or paste an invite link* |

| Whiteboard Room |
|:---:|
| ![Whiteboard canvas](./docs/screenshots/whiteboard.png) |
| *Shared canvas with tools, live users, and invite link banner* |

> 💡 **Tip:** Add your screenshots to `docs/screenshots/` using the filenames above.

---

## 📖 About

Synapse was built to explore what it takes to ship a production-grade collaborative experience on the web — not just drawing pixels on a canvas, but coordinating **authentication**, **real-time state**, **persistence**, **horizontal scaling**, and **cloud deployment** in one cohesive product.

Users sign up, land on a dashboard, create or join rooms, and collaborate on a shared HTML5 canvas. Every stroke is broadcast live via WebSockets, persisted to PostgreSQL, and restored when new participants join. Redis powers Socket.IO scaling across instances, while Nginx and PM2 keep the production stack reliable on AWS EC2.

---

## ✨ Features

| Category | Capability |
|----------|------------|
| 🔐 **Authentication** | Register, log in, JWT access tokens, refresh tokens, secure logout |
| 🏠 **Dashboard** | Polished landing page with recent whiteboards and quick actions |
| ➕ **Create Rooms** | Generate unique room IDs with custom whiteboard names |
| 🔗 **Share Links** | Copy `/room/:roomId` invite URLs from the whiteboard view |
| 🚪 **Join Rooms** | Join via room ID, pasted link, or recent whiteboards table |
| 🔒 **Room Security** | Optional password & public/private toggle (UI; server enforcement planned) |
| 🎨 **Drawing Tools** | Brush colors, custom color picker, adjustable brush size |
| ↩️ **History** | Undo, redo, and clear canvas — synced across all clients |
| 👥 **Presence** | See active users per room with live count updates |
| ⚡ **Real-Time Sync** | Live stroke preview + persisted stroke batches via Socket.IO |
| 💾 **Persistence** | Strokes stored in PostgreSQL with indexed room queries |
| 📈 **Scalability** | Redis adapter for multi-instance Socket.IO pub/sub |
| 🐳 **DevOps** | Docker Compose, GitHub Actions CI/CD, EC2 + Nginx + PM2 |

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    subgraph Client["🖥️ Client (Browser)"]
        UI["React + Vite + TypeScript"]
        SocketC["Socket.IO Client"]
        UI --> SocketC
    end

    subgraph Edge["☁️ AWS EC2"]
        Nginx["Nginx Reverse Proxy"]
        PM2["PM2 Process Manager"]
    end

    subgraph Backend["⚙️ Node.js Backend"]
        Express["Express REST API"]
        SocketS["Socket.IO Server"]
        Auth["JWT Auth Middleware"]
        Express --> Auth
        SocketS --> Auth
    end

    subgraph Data["🗄️ Data Layer"]
        PG[("PostgreSQL")]
        Redis[("Redis")]
    end

    UI -->|"HTTP /auth/*"| Nginx
    SocketC -->|"WS /socket.io"| Nginx
    Nginx --> Express
    Nginx --> SocketS
    PM2 --> Express
    PM2 --> SocketS
    Express --> PG
    SocketS --> PG
    SocketS <-->|"Pub/Sub Adapter"| Redis
```

### Component Overview

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| Frontend | React, Vite, TypeScript | UI, routing, canvas rendering, auth state |
| Real-Time | Socket.IO Client | Live drawing, room events, presence |
| API | Express 5 | `/auth/*` REST endpoints, health checks |
| WebSockets | Socket.IO Server | Room join/leave, stroke sync, undo/redo |
| ORM | Prisma + PostgreSQL | Users, refresh tokens, stroke persistence |
| Cache / Scale | Redis | Socket.IO adapter for horizontal scaling |
| Proxy | Nginx | Static assets, API & WebSocket reverse proxy |
| Process | PM2 | Production backend process management |
| CI/CD | GitHub Actions | Automated deploy to EC2 on `main` push |

---

## 🔄 Application Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as React Frontend
    participant API as Express API
    participant WS as Socket.IO
    participant DB as PostgreSQL

    User->>FE: Register / Login
    FE->>API: POST /auth/login
    API->>DB: Validate credentials
    API-->>FE: Access + Refresh tokens

    User->>FE: Open Dashboard
    User->>FE: Create Whiteboard
    FE->>FE: Generate room ID
    FE->>FE: Navigate to /room/:roomId

    FE->>WS: Connect (JWT in handshake)
    FE->>WS: emit join-room
    WS->>DB: Load active strokes
    WS-->>FE: room-joined + load-strokes

    User->>FE: Draw on canvas
    FE->>WS: emit draw-live (preview)
    WS-->>FE: broadcast draw-live
    FE->>WS: emit save-stroke (on mouse up)
    WS->>DB: Persist stroke
    WS-->>FE: stroke-saved

    User->>FE: Copy invite link
    User->>FE: Share /room/:roomId
```

### User Journey

```
Login → Dashboard → Create / Join Room → Whiteboard → Share Link → Collaborate
```

---

## 📁 Project Structure

```
synapse-whiteboard/
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── App.tsx            # Whiteboard room + canvas + Socket.IO
│   │   ├── DashboardPage.tsx  # Landing dashboard + modals
│   │   ├── LoginPage.tsx      # Login screen
│   │   ├── SignupPage.tsx     # Registration screen
│   │   ├── auth.ts            # Token storage & refresh helpers
│   │   ├── main.tsx           # React Router setup
│   │   └── utils/             # Room ID helpers, recent whiteboards
│   ├── nginx.conf             # Production Nginx config (Docker)
│   └── Dockerfile
│
├── server/                    # Node.js backend
│   ├── src/
│   │   └── index.ts           # Express + Socket.IO + auth routes
│   ├── prisma/
│   │   ├── schema.prisma      # User, RefreshToken, Stroke models
│   │   └── migrations/
│   ├── scripts/
│   │   └── load-test-rooms.ts # Room load testing utility
│   └── Dockerfile
│
├── .github/workflows/
│   └── deploy.yml             # EC2 deploy on push to main
├── docker-compose.yml         # Full stack: frontend, backend, redis
└── README.md
```

---

## 🚀 Local Setup

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ (22 recommended) |
| npm | 9+ |
| PostgreSQL | 14+ |
| Redis | 7+ (optional locally; required for multi-instance scaling) |

### 1. Clone the repository

```bash
git clone https://github.com/your-username/synapse-whiteboard.git
cd synapse-whiteboard
```

### 2. Configure environment variables

Create a `.env` file in the project root (used by Docker) and/or `server/.env` for local backend development:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/synapse

# JWT
JWT_ACCESS_SECRET=your-super-secret-access-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Redis (optional for single-instance local dev)
REDIS_URL=redis://localhost:6379
```

Create `client/.env` for local frontend development:

```env
VITE_API_URL=http://localhost:5000/auth
```

### 3. Set up the database

```bash
cd server
npm install
npm run prisma:generate
npm run prisma:migrate
```

### 4. Start the backend

```bash
cd server
npm run dev
```

The API and WebSocket server run on **http://localhost:5000**.

### 5. Start the frontend

```bash
cd client
npm install
npm run dev
```

The Vite dev server runs on **http://localhost:5173**.

> **Note:** In production, Nginx proxies `/auth` and `/socket.io` to the backend. For local development without Nginx, set `VITE_API_URL` as shown above. Socket.IO connects through the same origin in production; for pure local dev you may need a Vite proxy or to run the production Docker stack.

### 6. Verify

1. Open `http://localhost:5173`
2. Create an account at `/signup`
3. Log in and land on `/dashboard`
4. Create a whiteboard and draw — open the room link in a second browser to test real-time sync

---

## 🐳 Docker Setup

Run the entire stack with Docker Compose:

```bash
# From project root — ensure .env exists with required variables
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | [http://localhost:8080](http://localhost:8080) |
| Backend API | [http://localhost:5000](http://localhost:5000) |
| Redis | `localhost:6379` |

### Docker services

```yaml
# docker-compose.yml overview
backend   → Node.js API + Socket.IO (port 5000)
frontend  → Nginx serving Vite build (port 8080)
redis     → Socket.IO Redis adapter (port 6379)
```

> PostgreSQL is expected via `DATABASE_URL` in `.env` (hosted or local instance outside Compose).

### Useful commands

```bash
docker compose up --build -d    # Run in background
docker compose logs -f backend  # Tail backend logs
docker compose down             # Stop all services
```

---

## 🔧 Environment Variables

### Server (`server/.env` or root `.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string for Prisma |
| `JWT_ACCESS_SECRET` | ✅ | Secret for signing short-lived access tokens (15 min) |
| `JWT_REFRESH_SECRET` | ✅ | Secret for signing refresh tokens (7 days) |
| `REDIS_URL` | ⚠️ | Redis URL for Socket.IO adapter (`redis://localhost:6379`) |

### Client (`client/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ❌ | Auth API base URL (default: `/auth` via Nginx) |

### GitHub Actions secrets (deployment)

| Secret | Description |
|--------|-------------|
| `EC2_HOST` | Public IP or hostname of the EC2 instance |
| `EC2_USER` | SSH username (e.g. `ubuntu`) |
| `EC2_SSH_KEY` | Private SSH key for deployment |

---

## ☁️ Deployment

Synapse is deployed on **AWS EC2** with:

| Component | Role |
|-----------|------|
| **Nginx** | Serves the React build and reverse-proxies `/auth/` and `/socket.io/` |
| **PM2** | Keeps the Node.js backend running (`synapse-backend`) |
| **PostgreSQL** | Managed/hosted database for users and strokes |
| **Redis** | Socket.IO scaling adapter |
| **GitHub Actions** | Auto-deploy on push to `main` |

### Deploy pipeline

```mermaid
flowchart LR
    Push["Push to main"] --> GHA["GitHub Actions"]
    GHA --> SSH["SSH into EC2"]
    SSH --> Pull["git pull"]
    Pull --> Build["npm run build (client)"]
    Build --> Nginx["sudo systemctl restart nginx"]
    Nginx --> PM2["pm2 restart synapse-backend"]
```

### Manual deploy steps (EC2)

```bash
cd ~/synapse-whiteboard
git pull origin main

cd client && npm run build
sudo systemctl restart nginx

cd ../server
pm2 restart synapse-backend
pm2 save
```

**Live instance:** [http://3.14.84.70](http://3.14.84.70)

---

## 🧪 Load Testing

A room load-test script is included for stress-testing Socket.IO room joins:

```bash
cd server
npm run test:rooms
```

---

## 🧩 Challenges & Learnings

| Challenge | What we learned |
|-----------|-----------------|
| **Real-time + persistence** | Separating `draw-live` (ephemeral preview) from `save-stroke` (durable) keeps the canvas responsive without flooding the database |
| **Optimistic undo/redo** | Client-side stroke tracking with server reconciliation avoids flicker when undoing strokes that haven't been persisted yet |
| **JWT + WebSockets** | Passing the access token in the Socket.IO handshake `auth` payload enables authenticated presence without cookie complexity |
| **Horizontal scaling** | The Redis adapter is essential when running multiple Node instances — without it, rooms split across processes can't communicate |
| **Production networking** | Relative paths (`/auth`, `/socket.io`) behind Nginx eliminate hardcoded API URLs and simplify EC2 deployment |
| **Stroke query performance** | Prisma indexes on `(roomId)`, `(roomId, createdAt)`, and `(roomId, isUndone, createdAt)` keep room history loads fast under load |

---

## 🛣️ Future Improvements

- [ ] **Room model in PostgreSQL** — persist room metadata (name, owner, visibility)
- [ ] **Server-side password hashing** — bcrypt room passwords with join-time verification
- [ ] **`/rooms/` REST API** — create, list, and manage rooms from the backend
- [ ] **Global online user count** — replace static dashboard footer with live metrics
- [ ] **Cursor presence** — show remote user cursors with name labels
- [ ] **Shape tools** — rectangles, circles, text, and image upload
- [ ] **Room permissions** — owner-only clear, moderator roles
- [ ] **Export** — download whiteboard as PNG or SVG
- [ ] **Mobile / touch** — optimized drawing for tablets and phones
- [ ] **E2E tests** — Playwright coverage for auth, room flow, and drawing

---

## 👤 Author

**Angel**

- 🌐 Live Demo: [http://3.14.84.70](http://3.14.84.70)
- 💻 GitHub: [@your-username](https://github.com/your-username)

> Replace `@your-username` with your GitHub handle before publishing.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with 💜 using React, Socket.IO, and a lot of real-time debugging
  <br />
  <strong>Synapse v1.2</strong>
</p>
