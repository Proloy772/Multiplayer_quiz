# Multiplayer Quiz Room — Real Multiplayer (Socket.IO)

This version replaced the old `localStorage` + `BroadcastChannel` approach with a
real Node/Express + Socket.IO backend, so players on **different computers or
phones** can play together in the same room. The score, question order, and game
state are all managed authoritatively on the server.

## Run locally

```bash
npm install
npm run dev
```

This starts the Socket.IO server on port 3001 and the Vite dev server (usually
port 5173) at the same time, with the dev server proxying `/socket.io` requests
to the backend. Open the printed localhost URL in multiple browser tabs, or on
multiple devices on the same network (use your computer's local IP instead of
`localhost`) to test multiplayer.

## Production build (single server)

```bash
npm run build   # builds the React app into dist/
npm run start   # starts server/index.js, which also serves dist/
```

In production there's just **one process**: the Express/Socket.IO server also
serves the built static frontend, so there's nothing else to configure.

## Deploy to Render

### Option A — Blueprint (recommended)
This repo includes a `render.yaml`. In the Render dashboard:
1. Push this project to a GitHub repo.
2. Click **New +** → **Blueprint**, and point it at your repo.
3. Render will read `render.yaml` and create a single **Web Service** for you.
4. Click **Apply** / **Deploy**.

### Option B — Manual Web Service
1. Push this project to a GitHub (or GitLab) repo.
2. In Render, click **New +** → **Web Service**, and connect the repo.
3. Set:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
4. Deploy. Render assigns a public URL (e.g. `https://your-app.onrender.com`) —
   share that URL and room codes with friends on any device.

Notes:
- Render sets the `PORT` environment variable automatically; the server already
  reads `process.env.PORT`, so no extra config is needed there.
- On Render's free tier, the service spins down after inactivity and takes a
  few seconds to wake up on the next visit — normal for the free plan, not a bug.
- Room state currently lives in server memory. If the service restarts (e.g.
  redeploy, free-tier spin-down while a game is mid-way), active rooms are lost.
  For persistence across restarts you'd add Redis or a database — not needed
  for casual/local games.
