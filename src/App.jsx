import React, { useEffect, useMemo, useState } from "react";

const QUESTIONS = [
  { q: "Which language is mainly used for styling web pages?", options: ["Python","CSS","SQL","Java"], correct: 1 },
  { q: "Which SQL command is used to retrieve data?", options: ["GET","FETCH","SELECT","READ"], correct: 2 },
  { q: "What does CPU stand for?", options: ["Central Processing Unit","Computer Personal Unit","Central Program Utility","Control Processing User"], correct: 0 },
  { q: "Which is a JavaScript library?", options: ["React","Django","Laravel","Spring"], correct: 0 },
  { q: "Which data structure follows FIFO?", options: ["Stack","Queue","Tree","Graph"], correct: 1 },
  { q: "What is the full form of DBMS?", options: ["Data Backup Management System","Database Management System","Database Memory Service","Digital Base Management Software"], correct: 1 },
  { q: "Which tool is commonly used for data visualization?", options: ["Power BI","Git","Node","Docker"], correct: 0 },
  { q: "Which HTTP method is commonly used to submit/create data?", options: ["GET","POST","HEAD","OPTIONS"], correct: 1 }
];

const CHANNEL = "quiz-room-local-v1";
const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
// hii prolay
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

function makePlayer(name) {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const questionOrder = shuffle(QUESTIONS.map((_, i) => i), seed);
  const optionOrders = {};
  questionOrder.forEach((qi, n) => {
    optionOrders[qi] = shuffle(QUESTIONS[qi].options.map((_, i) => i), seed + n * 7919);
  });
  return {
    id: crypto.randomUUID(),
    name,
    questionOrder,
    optionOrders,
    current: 0,
    score: 0,
    answered: {},
    finished: false
  };
}

function loadRoom(code) {
  try { return JSON.parse(localStorage.getItem("quiz-room-" + code) || "null"); }
  catch { return null; }
}

function saveRoom(room) {
  localStorage.setItem("quiz-room-" + room.code, JSON.stringify(room));
  bc?.postMessage({ type: "room-update", code: room.code });
}

function App() {
  const [screen, setScreen] = useState("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(120);

  const player = room?.players?.find(p => p.id === playerId);
  const currentQuestion = player ? QUESTIONS[player.questionOrder[player.current]] : null;

  useEffect(() => {
    const receive = (e) => {
      if (e.data?.type === "room-update" && e.data.code === room?.code) {
        const fresh = loadRoom(room.code);
        if (fresh) setRoom(fresh);
      }
    };
    bc?.addEventListener("message", receive);
    return () => bc?.removeEventListener("message", receive);
  }, [room?.code]);

  useEffect(() => {
    if (screen !== "quiz" || !room || !player || player.finished) return;
    const end = room.endsAt;
    const tick = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) finishPlayer();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [screen, room?.endsAt, player?.finished, player?.current]);

  function createRoom() {
    if (!name.trim()) return setError("Enter your name first.");
    const roomCode = Math.random().toString(36).slice(2, 7).toUpperCase();
    const p = makePlayer(name.trim());
    const newRoom = {
      code: roomCode,
      host: p.id,
      status: "waiting",
      endsAt: null,
      players: [p]
    };
    saveRoom(newRoom);
    setRoom(newRoom); setPlayerId(p.id); setCode(roomCode); setScreen("lobby"); setError("");
  }

  function joinRoom() {
    if (!name.trim() || !code.trim()) return setError("Enter your name and room code.");
    const existing = loadRoom(code.trim().toUpperCase());
    if (!existing) return setError("Room not found. Create a room first.");
    if (existing.status !== "waiting") return setError("This quiz has already started.");
    const p = makePlayer(name.trim());
    existing.players.push(p);
    saveRoom(existing);
    setRoom(existing); setPlayerId(p.id); setCode(existing.code); setScreen("lobby"); setError("");
  }

  function startQuiz() {
    if (!room || room.host !== playerId) return;
    const updated = {...room, status:"running", endsAt: Date.now() + 120000};
    saveRoom(updated);
    setRoom(updated); setScreen("quiz");
  }

  function answer(optionOriginalIndex) {
    if (!player || player.finished || player.answered[player.current] !== undefined) return;
    const qi = player.questionOrder[player.current];
    const correct = QUESTIONS[qi].correct;
    const updatedPlayer = {
      ...player,
      answered: {...player.answered, [player.current]: optionOriginalIndex},
      score: player.score + (optionOriginalIndex === correct ? 10 : 0),
      current: player.current + 1
    };
    if (updatedPlayer.current >= updatedPlayer.questionOrder.length) updatedPlayer.finished = true;
    const updatedRoom = {...room, players: room.players.map(p => p.id === playerId ? updatedPlayer : p)};
    saveRoom(updatedRoom); setRoom(updatedRoom);
    if (updatedPlayer.finished) setScreen("results");
  }

  function finishPlayer() {
    if (!room || !player || player.finished) return;
    const updatedPlayer = {...player, finished:true};
    const updatedRoom = {...room, players: room.players.map(p => p.id === playerId ? updatedPlayer : p)};
    saveRoom(updatedRoom); setRoom(updatedRoom); setScreen("results");
  }

  function reset() {
    setScreen("home"); setRoom(null); setPlayerId(null); setCode(""); setError("");
  }

  const leaderboard = useMemo(() => [...(room?.players || [])].sort((a,b) => b.score-a.score), [room]);

  if (screen === "home") return (
    <main className="page">
      <section className="card hero">
        <h1>🎯 Multiplayer Quiz Room</h1>
        <p>Run this project without Firebase. Open the app in multiple browser tabs to test multiplayer.</p>
        <input placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} />
        <div className="row">
          <button onClick={createRoom}>Create Room</button>
          <input className="code" placeholder="ROOM CODE" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/>
          <button className="secondary" onClick={joinRoom}>Join Room</button>
        </div>
        {error && <div className="error">{error}</div>}
        <small>For different computers/phones, a real backend server is required. This version is a no-configuration local multiplayer demo.</small>
      </section>
    </main>
  );

  if (screen === "lobby") return (
    <main className="page">
      <section className="card">
        <div className="top"><span>Room</span><b className="room">{room.code}</b></div>
        <h2>Waiting Room</h2>
        <p>Share this room code with the other players.</p>
        <div className="players">
          {room.players.map((p,i)=><div className="player" key={p.id}>👤 {p.name} {i===0 && <b>(Host)</b>}</div>)}
        </div>
        {room.host === playerId
          ? <button onClick={startQuiz}>Start Quiz</button>
          : <p className="muted">Waiting for the host to start…</p>}
        <button className="link" onClick={reset}>Leave</button>
      </section>
    </main>
  );

  if (screen === "quiz" && player && currentQuestion) {
    const qi = player.questionOrder[player.current];
    const order = player.optionOrders[qi];
    return (
      <main className="page">
        <section className="card quiz">
          <div className="top"><span>Question {player.current+1}/{player.questionOrder.length}</span><b className="timer">⏱ {timeLeft}s</b></div>
          <div className="progress"><span style={{width:`${(player.current/player.questionOrder.length)*100}%`}}/></div>
          <h2>{currentQuestion.q}</h2>
          <div className="options">
            {order.map(originalIndex => (
              <button key={originalIndex} onClick={()=>answer(originalIndex)}>
                {currentQuestion.options[originalIndex]}
              </button>
            ))}
          </div>
          <p className="muted">Each player has a different question and option order.</p>
        </section>
        <section className="card mini">
          <b>Live leaderboard</b>
          {leaderboard.map((p,i)=><div className="line" key={p.id}><span>#{i+1} {p.name}</span><b>{p.score}</b></div>)}
        </section>
      </main>
    );
  }

  if (screen === "results") return (
    <main className="page">
      <section className="card">
        <h1>🏆 Results</h1>
        <h2>{player?.name}: {player?.score ?? 0} points</h2>
        <div className="leaderboard">
          {leaderboard.map((p,i)=><div className="line" key={p.id}><span><b>#{i+1}</b> {p.name}</span><b>{p.score}</b></div>)}
        </div>
        <button onClick={reset}>Back to Home</button>
      </section>
    </main>
  );

  return null;
}

export default App;
