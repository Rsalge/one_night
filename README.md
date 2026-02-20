# One Night Werewolf

A real-time multiplayer implementation of One Night Ultimate Werewolf using Socket.IO.

## About the Game

One Night Ultimate Werewolf is a fast-paced social deduction game for 3-10 players. Each player receives a secret role card, and there are always 3 extra cards in the center of the table that no one sees.

The game has three phases:
1. **Night Phase**: Players with special abilities wake up one at a time (in a specific order) and perform their actions - viewing cards, swapping roles, or gaining information.
2. **Day Phase**: Everyone discusses what happened during the night. Players may tell the truth, bluff, or try to deduce who the Werewolves are.
3. **Voting**: All players simultaneously vote for who to eliminate. The player(s) with the most votes are eliminated.

**Win Conditions**:
- **Village Team** wins if at least one Werewolf is eliminated
- **Werewolf Team** wins if no Werewolves are eliminated
- **Tanner** wins if they are eliminated (even if Werewolves also win)
- If there are no Werewolves and no one is eliminated, Village wins

## Tech Stack

- **Frontend**: Vite + React 19 + TypeScript + Tailwind CSS v4
- **Backend**: Express + Socket.IO
- **Database**: PostgreSQL 16 + Prisma 7
- **Runtime**: Node.js 24+

## Prerequisites

- Node.js 24 or higher
- Docker (for PostgreSQL)
- npm

## Local Development Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd one_night

# 2. Start PostgreSQL with Docker
docker run --name one_night_postgres \
  -e POSTGRES_DB=one_night_dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:16

# 3. Install dependencies
npm install
cd client && npm install && cd ..

# 4. Create environment file
cat > .env << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/one_night_dev
PORT=3000
NODE_ENV=development
EOF

# 5. Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev

# 6. Start the backend server (Terminal 1)
npm run dev

# 7. Start the frontend dev server (Terminal 2)
npm run dev:client

# 8. Open your browser
# http://localhost:5173
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the backend server on port 3000 |
| `npm run dev:client` | Start the Vite frontend dev server on port 5173 |
| `npm run build` | Generate Prisma client and build frontend for production |
| `npm start` | Start the production server |

## Project Structure

```
one_night/
├── client/                 # Vite + React + TypeScript frontend
│   ├── src/
│   │   ├── context/        # React context (GameContext)
│   │   ├── hooks/          # Custom hooks (useSocket)
│   │   ├── pages/          # Page components (Home, Lobby, Game)
│   │   ├── components/     # Reusable UI components
│   │   └── types/          # TypeScript types and role definitions
│   └── vite.config.ts      # Vite config (proxies to backend)
├── src/
│   ├── server/             # Server-side logic
│   │   └── gameStore.js    # Prisma database operations
│   └── lib/
│       └── db.js           # Prisma client setup
├── prisma/
│   └── schema.prisma       # Database schema (Game, Player)
├── server.js               # Express + Socket.IO server
├── gameLogic.js            # Game mechanics and rules
└── package.json
```

## Roles

| Role | Team | Night Order | Description |
|------|------|-------------|-------------|
| Werewolf | Werewolf | 2 | Wakes with other Werewolves. If alone, may view one center card. |
| Alpha Wolf | Werewolf | 2 | Werewolf who also exchanges a center card with another player. |
| Mystic Wolf | Werewolf | 2 | Werewolf who may also look at another player's card. |
| Minion | Werewolf | 3 | Knows who the Werewolves are, but they don't know the Minion. Wins with Werewolves. |
| Mason | Village | 4 | Wakes with other Masons to identify each other. |
| Seer | Village | 5 | Views another player's card OR two center cards. |
| Apprentice Seer | Village | 6 | Views one center card. |
| Robber | Village | 7 | Swaps card with another player and views new card. |
| Witch | Village | 8 | Views a center card and may swap it with any player's card. |
| Troublemaker | Village | 9 | Swaps two other players' cards (without viewing). |
| Village Idiot | Village | 10 | Moves all players' cards one position left or right. |
| Drunk | Village | 11 | Exchanges card with a center card (doesn't view it). |
| Insomniac | Village | 12 | Wakes at end of night to view own card (to see if it changed). |
| Revealer | Village | 13 | Flips another player's card face-up (unless Werewolf/Tanner). |
| Sentinel | Village | 14 | Places a shield on another player's card, preventing changes. |
| Villager | Village | - | No special ability. |
| Hunter | Village | - | If eliminated, the player they voted for also dies. |
| Tanner | Tanner | - | Wins if eliminated. Loses if survives. |
| Doppelganger | Variable | 1 | Copies another player's role and performs that role's action. |
