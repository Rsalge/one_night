# 🐺 One Night - Codebase Analysis

## 🎯 Purpose of the Game
The `one_night` project is a fully digitized, real-time multiplayer implementation of the popular social deduction board game **One Night Ultimate Werewolf**, including roles from the **Daybreak** expansion (e.g., Alpha Wolf, Mystic Wolf, Revealer, Sentinel). 

The game automates the traditionally complex "moderator" role. Players join a custom lobby using a 4-character room code, are assigned secret roles, and then transition through the "Night Phase." During the Night Phase, the server sequences and coordinates all private role actions (looking at cards, swapping, shielding, etc.) in a strict order. After the Night Phase, players enter the "Day Phase" to discuss their findings and ultimately vote to eliminate a suspected werewolf. The custom game logic auto-resolves win conditions based on the top vote and role-specific rules (e.g., Tanner win condition).

## 🛠️ Technical Details of the Implementation

### Languages
* **JavaScript**: The entire application (both frontend and backend) is written in JavaScript.

### Frameworks & Libraries
* **Next.js (v16.1.6)**: Serves as the React framework handling the frontend UI and routing (utilizing the App Router `src/app`).
* **React (v19.2.3)**: Used for building the interactive component-based UI (`src/components/`).
* **Express.js (v5.2.1)**: Underpins the custom backend API and WebSocket server, working alongside Next.js.
* **Socket.io (v4.8.3)**: The backbone of the application's real-time events. It is used to broadcast and handle granular game state updates, manage lobbies, reconnect user sessions, and sync the Night Phase turn order.

### Vendors & Deployment
* **Vercel**: The `README.md` references deployment on Vercel. However, deploying a stateful WebSocket server on Vercel's serverless infrastructure typically requires a third-party managed WebSocket/pub-sub vendor (like Pusher or Redis), which is currently lacking in the codebase.
* **Jest (v30.2.0)**: Used as the testing framework (`gameLogic.test.js`).

### Architecture
* **Custom NextServer + Express**: The Next.js request handler is hooked up within an Express/Node HTTP server (`server.js`) so that `Socket.io` can bind to the same port.
* **Pure Game Logic Segregation**: Core game mechanics (role resolution instructions, win condition evaluation, turn sequences) are successfully decoupled from the networking layer into `gameLogic.js`.

## ⚠️ Concerns with the Current State of the Codebase

1. **In-Memory State Limits Scalability**
   In `server.js`, all active rooms and player sessions are stored in an in-memory `Map()`. While this works for a single Node.js instance, it means the application **cannot be horizontally scaled** across multiple servers. If deployed onto serverless platforms (like Vercel functions/Edge), the state will reset constantly, instantly dropping players from active games.
   * **Recommendation:** Migrate state storage out of memory using a persistent store like Redis (along with the `@socket.io/redis-adapter` for multi-instance syncing) or a database (PostgreSQL/MongoDB).

2. **Monolithic `server.js` File**
   At 650+ lines, the `server.js` file handles HTTP routing, Next.js page serving, game connection events, session tracking, night phase advancement, voting logic, and reconnect logic synchronously.
   * **Recommendation:** This is a "God class" anti-pattern. The socket event listeners and room management controllers should be extracted into isolated modules (e.g., `src/server/connectionHandler.js`, `src/server/gameLoopHandler.js`).

3. **Security: Lack of Input Sanitization and Rate Limiting**
   There are no explicit security measures preventing malicious clients from spoofing Socket.io event payloads. A bad actor could potentially emit unexpected `cast_vote`, `update_roles`, or `night_action` events. Room codes are easily guessable 4-character strings (`Math.random().toString(36).substring(2, 6)`), meaning players might accidentally brute-force enter ongoing lobbies. There are also no checks capping the number of rooms that can be spawned, making the server vulnerable to DOS attacks.

4. **Brittle Timeout & Reconnect Logic**
   The server relies on precise `setTimeout` actions for 30-second server grace periods when tracking disconnects (`game.disconnectTimers[sessionId]`). In environments where the event loop can stall or Node.js processes sleep, timeouts are unreliable. Timeouts for automated night sequences also don't adequately account for massive latency differences across players connecting from weak networks.

5. **Test Coverage Gap**
   While `gameLogic.js` has a corresponding test file, the intricate networking layer (`server.js`) and UI components (`src/components/`) appear under-tested or completely untested. Given the complexity of edge cases with multiplayer reconnects, this will lead to frustrating bugs during live gameplay.

6. **Hardcoded Configurations**
   Constants like the 30-second disconnect timeout, 3-second generic delays before night phases, and role string lists are largely hardcoded into the event routing system instead of being stored in a configurable central `.env` or constants config file.
