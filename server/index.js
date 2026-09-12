import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const QUIZ_DURATION_MS = 120000;

const QUESTIONS = [
  { q: "Which language is mainly used for styling web pages?", options: ["Python", "CSS", "SQL", "Java"], correct: 1 },
  { q: "Which SQL command is used to retrieve data?", options: ["GET", "FETCH", "SELECT", "READ"], correct: 2 },
  { q: "What does CPU stand for?", options: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Control Processing User"], correct: 0 },
  { q: "Which is a JavaScript library?", options: ["React", "Django", "Laravel", "Spring"], correct: 0 },
  { q: "Which data structure follows FIFO?", options: ["Stack", "Queue", "Tree", "Graph"], correct: 1 },
  { q: "What is the full form of DBMS?", options: ["Data Backup Management System", "Database Management System", "Database Memory Service", "Digital Base Management Software"], correct: 1 },
  { q: "Which tool is commonly used for data visualization?", options: ["Power BI", "Git", "Node", "Docker"], correct: 0 },
  { q: "Which HTTP method is commonly used to submit/create data?", options: ["GET", "POST", "HEAD", "OPTIONS"], correct: 1 }
];

function shuffle(arr, seed) {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makePlayer(id, name) {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const questionOrder = shuffle(QUESTIONS.map((_, i) => i), seed);
  const optionOrders = {};
  questionOrder.forEach((qi, n) => {
    optionOrders[qi] = shuffle(QUESTIONS[qi].options.map((_, i) => i), seed + n * 7919);
  });
  return {
    id,
    name,
    questionOrder,
    optionOrders,
    current: 0,
    score: 0,
    answered: {},
    finished: false
  };
}

// Strip the `correct` answer key before sending questions to clients.
const PUBLIC_QUESTIONS = QUESTIONS.map(({ q, options }) => ({ q, options }));

function generateCode(rooms) {
  let code;
  do {
    code = Math.random().toString(36).slice(2, 7).toUpperCase();
  } while (rooms.has(code));
  return code;
}

const rooms = new Map(); // code -> room

function publicRoom(room) {
  // Nothing sensitive to hide here (answers are validated server-side), send as-is.
  return room;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

io.on("connection", (socket) => {
  socket.on("create-room", ({ name }, cb) => {
    if (!name || !name.trim()) return cb?.({ error: "Enter your name first." });
    const code = generateCode(rooms);
    const player = makePlayer(socket.id, name.trim());
    const room = { code, host: player.id, status: "waiting", endsAt: null, players: [player] };
    rooms.set(code, room);
    socket.join(code);
    socket.data.code = code;
    cb?.({ room: publicRoom(room), playerId: player.id, questions: PUBLIC_QUESTIONS });
  });

  socket.on("join-room", ({ name, code }, cb) => {
    const roomCode = (code || "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    if (!name || !name.trim()) return cb?.({ error: "Enter your name and room code." });
    if (!room) return cb?.({ error: "Room not found. Create a room first." });
    if (room.status !== "waiting") return cb?.({ error: "This quiz has already started." });
    const player = makePlayer(socket.id, name.trim());
    room.players.push(player);
    socket.join(roomCode);
    socket.data.code = roomCode;
    io.to(roomCode).emit("room-update", publicRoom(room));
    cb?.({ room: publicRoom(room), playerId: player.id, questions: PUBLIC_QUESTIONS });
  });

  socket.on("start-quiz", ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.host !== socket.id) return;
    room.status = "running";
    room.endsAt = Date.now() + QUIZ_DURATION_MS;
    io.to(code).emit("room-update", publicRoom(room));
  });

  socket.on("answer", ({ code, optionIndex }) => {
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.finished || player.answered[player.current] !== undefined) return;
    const qi = player.questionOrder[player.current];
    const correct = QUESTIONS[qi].correct;
    player.answered[player.current] = optionIndex;
    if (optionIndex === correct) player.score += 10;
    player.current += 1;
    if (player.current >= player.questionOrder.length) player.finished = true;
    io.to(code).emit("room-update", publicRoom(room));
  });

  socket.on("finish-player", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.finished) return;
    player.finished = true;
    io.to(code).emit("room-update", publicRoom(room));
  });

  socket.on("leave-room", ({ code }) => {
    leaveRoom(socket, code);
  });

  socket.on("disconnect", () => {
    leaveRoom(socket, socket.data.code);
  });
});

function leaveRoom(socket, code) {
  const room = rooms.get(code);
  if (!room) return;
  room.players = room.players.filter((p) => p.id !== socket.id);
  if (room.players.length === 0) {
    rooms.delete(code);
    return;
  }
  if (room.host === socket.id) {
    room.host = room.players[0].id; // promote the next player to host
  }
  io.to(code).emit("room-update", publicRoom(room));
}

// Serve the built frontend (npm run build -> dist/) in production.
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
