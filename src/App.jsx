import React, { useEffect, useMemo, useState } from "react";
import { socket } from "./socket";

function App() {
  const [screen, setScreen] = useState("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [playerId, setPlayerId] = useState(null);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(120);
  const [connected, setConnected] = useState(socket.connected);

  const player = room?.players?.find((p) => p.id === playerId);
  const currentQuestion = player ? questions[player.questionOrder[player.current]] : null;

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onRoomUpdate = (updated) => {
      setRoom((prev) => (prev && prev.code === updated.code ? updated : prev ?? updated));
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room-update", onRoomUpdate);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room-update", onRoomUpdate);
    };
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, room?.endsAt, player?.finished, player?.current]);

  useEffect(() => {
    if (room?.status === "running" && screen === "lobby") setScreen("quiz");
    if (player?.finished && screen === "quiz") setScreen("results");
  }, [room?.status, player?.finished, screen]);

  function createRoom() {
    if (!name.trim()) return setError("Enter your name first.");
    setError("");
    socket.emit("create-room", { name: name.trim() }, (res) => {
      if (res?.error) return setError(res.error);
      setQuestions(res.questions);
      setRoom(res.room);
      setPlayerId(res.playerId);
      setCode(res.room.code);
      setScreen("lobby");
    });
  }

  function joinRoom() {
    if (!name.trim() || !code.trim()) return setError("Enter your name and room code.");
    setError("");
    socket.emit("join-room", { name: name.trim(), code: code.trim().toUpperCase() }, (res) => {
      if (res?.error) return setError(res.error);
      setQuestions(res.questions);
      setRoom(res.room);
      setPlayerId(res.playerId);
      setCode(res.room.code);
      setScreen("lobby");
    });
  }

  function startQuiz() {
    if (!room || room.host !== playerId) return;
    socket.emit("start-quiz", { code: room.code });
  }

  function answer(optionOriginalIndex) {
    if (!room || !player || player.finished || player.answered[player.current] !== undefined) return;
    socket.emit("answer", { code: room.code, optionIndex: optionOriginalIndex });
  }

  function finishPlayer() {
    if (!room || !player || player.finished) return;
    socket.emit("finish-player", { code: room.code });
  }

  function reset() {
    if (room) socket.emit("leave-room", { code: room.code });
    setScreen("home");
    setRoom(null);
    setPlayerId(null);
    setCode("");
    setError("");
  }

  const leaderboard = useMemo(() => [...(room?.players || [])].sort((a, b) => b.score - a.score), [room]);

  if (screen === "home")
    return (
      <main className="page">
        <section className="card hero">
          <h1>🎯 Multiplayer Quiz Room</h1>
          <p>Play with friends on any device — powered by a live Socket.IO server.</p>
          <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="row">
            <button onClick={createRoom}>Create Room</button>
            <input
              className="code"
              placeholder="ROOM CODE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button className="secondary" onClick={joinRoom}>
              Join Room
            </button>
          </div>
          {error && <div className="error">{error}</div>}
          {!connected && <small className="error">Connecting to server…</small>}
          <small>Share the room code with friends anywhere — no need to be on the same device.</small>
        </section>
      </main>
    );

  if (screen === "lobby" && room)
    return (
      <main className="page">
        <section className="card">
          <div className="top">
            <span>Room</span>
            <b className="room">{room.code}</b>
          </div>
          <h2>Waiting Room</h2>
          <p>Share this room code with the other players.</p>
          <div className="players">
            {room.players.map((p, i) => (
              <div className="player" key={p.id}>
                👤 {p.name} {room.host === p.id && <b>(Host)</b>}
              </div>
            ))}
          </div>
          {room.host === playerId ? (
            <button onClick={startQuiz}>Start Quiz</button>
          ) : (
            <p className="muted">Waiting for the host to start…</p>
          )}
          <button className="link" onClick={reset}>
            Leave
          </button>
        </section>
      </main>
    );

  if (screen === "quiz" && player && currentQuestion) {
    const qi = player.questionOrder[player.current];
    const order = player.optionOrders[qi];
    return (
      <main className="page">
        <section className="card quiz">
          <div className="top">
            <span>
              Question {player.current + 1}/{player.questionOrder.length}
            </span>
            <b className="timer">⏱ {timeLeft}s</b>
          </div>
          <div className="progress">
            <span style={{ width: `${(player.current / player.questionOrder.length) * 100}%` }} />
          </div>
          <h2>{currentQuestion.q}</h2>
          <div className="options">
            {order.map((originalIndex) => (
              <button key={originalIndex} onClick={() => answer(originalIndex)}>
                {currentQuestion.options[originalIndex]}
              </button>
            ))}
          </div>
          <p className="muted">Each player has a different question and option order.</p>
        </section>
        <section className="card mini">
          <b>Live leaderboard</b>
          {leaderboard.map((p, i) => (
            <div className="line" key={p.id}>
              <span>
                #{i + 1} {p.name}
              </span>
              <b>{p.score}</b>
            </div>
          ))}
        </section>
      </main>
    );
  }

  if (screen === "results")
    return (
      <main className="page">
        <section className="card">
          <h1>🏆 Results</h1>
          <h2>
            {player?.name}: {player?.score ?? 0} points
          </h2>
          <div className="leaderboard">
            {leaderboard.map((p, i) => (
              <div className="line" key={p.id}>
                <span>
                  <b>#{i + 1}</b> {p.name}
                </span>
                <b>{p.score}</b>
              </div>
            ))}
          </div>
          <button onClick={reset}>Back to Home</button>
        </section>
      </main>
    );

  return null;
}

export default App;
