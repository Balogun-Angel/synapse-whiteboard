# 🧠 Synapse

A real-time collaborative whiteboard platform that enables users to create secure whiteboards, share invite links, and draw together in real time.

🌐 **Live Demo:** http://3.14.84.70

---

## ✨ Features

* 🔐 User authentication with JWT
* 🎨 Real-time collaborative drawing
* 🏠 Create and join whiteboard rooms
* 🔒 Public and private rooms with optional passwords
* 🔗 Shareable invite links
* 👥 Live room participation and user presence
* ⚡ Redis-powered WebSocket scaling
* 🐳 Dockerized application architecture
* ☁️ AWS EC2 deployment with Nginx and PM2

---

## 🛠️ Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Socket.IO Client

### Backend

* Node.js
* Express
* TypeScript
* Socket.IO
* JWT Authentication

### Infrastructure

* Redis
* Docker
* Docker Compose
* AWS EC2
* Nginx
* PM2

---

## 🚀 Getting Started

Clone the repository:

```bash
git clone https://github.com/Balogun-Angel/synapse-whiteboard.git
cd synapse-whiteboard
```

Install dependencies:

```bash
cd server
npm install

cd ../client
npm install
```

Run the application:

```bash
docker compose up --build
```

Frontend:

```text
http://localhost:8080
```

Backend:

```text
http://localhost:5000
```

---

## 🔐 Environment Variables

Create a `.env` file inside the `server` directory:

```env
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
REDIS_URL=redis://redis:6379
```

---

## 🔮 Future Improvements

* Whiteboard persistence
* Cursor indicators
* Export as PNG/PDF
* Infinite canvas
* Whiteboard history

---

## 👩‍💻 Author

**Angel Balogun**

GitHub: https://github.com/Balogun-Angel
