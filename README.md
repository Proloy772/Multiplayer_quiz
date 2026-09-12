# Multiplayer Quiz Room — No Firebase Version

## Run
1. Install Node.js (LTS).
2. Open this folder in VS Code.
3. Run:
   npm install
   npm run dev
4. Open the localhost address shown by Vite.

## Test multiplayer
Open the same localhost URL in 2–4 browser tabs.
Use different names. Create a room in tab 1 and enter the room code in the other tabs.
Each player gets a different question order and option order.

## Important
This version uses browser localStorage + BroadcastChannel, so it is designed for local testing on the same computer/browser profile.
It does NOT provide true internet multiplayer between different computers.
For that, the next step is a small Node/Socket.IO server or Firebase/Supabase backend.
