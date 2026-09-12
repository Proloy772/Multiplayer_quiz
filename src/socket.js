import { io } from "socket.io-client";

// Same-origin in production (server serves the built app).
// In dev, Vite proxies /socket.io to the local server (see vite.config.js).
export const socket = io({ autoConnect: true });
