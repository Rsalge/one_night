# AGENTS.md - One Night Ultimate Werewolf

## Project Overview

Real-time multiplayer implementation of One Night Ultimate Werewolf using Socket.IO.
Monorepo structure with Express/Socket.IO backend and Vite/React/TypeScript frontend.

- **Backend**: Node.js 24+, Express 5, Socket.IO 4, Prisma 7, PostgreSQL 16
- **Frontend**: Vite 7, React 19, TypeScript 5.9, Tailwind CSS 4
- **Testing**: Jest 30

## Build & Development Commands

### Installation
```bash
npm install                    # Install backend dependencies
cd client && npm install       # Install frontend dependencies
```

### Development (run in separate terminals)
```bash
npm run dev                    # Start backend server (port 3000)
npm run dev:client             # Start Vite frontend dev server (port 5173)
```

### Production Build
```bash
npm run build                  # Generates Prisma client + builds frontend
npm start                      # Start production server
```

### Database (Prisma)
```bash
npx prisma generate            # Generate Prisma client after schema changes
npx prisma migrate dev         # Create and apply migrations
npx prisma studio              # Open database GUI
```

## Testing

Tests use Jest and are located in `gameLogic.test.js` (backend game logic only).

```bash
# Run all tests
npm test

# Run a single test by name pattern
npm test -- --testNamePattern="Seer views player"

# Run tests matching a describe block
npm test -- --testNamePattern="processNightAction"

# Run specific test file
npm test -- gameLogic.test.js

# Run with coverage
npm test -- --coverage
```

**Note**: Only `gameLogic.js` has test coverage. Server and UI are untested.

## Linting & Type Checking

```bash
cd client && npm run lint      # ESLint (TypeScript + React)
cd client && npx tsc --noEmit  # TypeScript type checking
```

ESLint config (`client/eslint.config.js`):
- `@eslint/js` recommended rules
- `typescript-eslint` recommended rules
- `eslint-plugin-react-hooks` for hooks rules
- `eslint-plugin-react-refresh` for Vite HMR

TypeScript (`client/tsconfig.app.json`):
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`

## Code Style Guidelines

### Backend (JavaScript - CommonJS)

```javascript
// Use require/module.exports (CommonJS)
const { PrismaClient } = require('@prisma/client');

// JSDoc comments for exported functions
/**
 * Process an interactive night action.
 * Mutates game state and appends to game.nightLog.
 * Returns the result to send to the player, or null.
 */
function processNightAction(game, player, action, targetIds) {
    // Implementation
}

module.exports = { processNightAction };
```

### Frontend (TypeScript - ES Modules)

```typescript
// Type-only imports use 'type' keyword
import type { Player, GamePhase } from '../types';

// Named exports preferred over default exports
export function useSocket() { ... }
export function RoleCard({ roleId }: RoleCardProps) { ... }

// Interface for component props
interface RoleCardProps {
  roleId: string;
  selected?: boolean;
  onClick?: () => void;
}

// Context pattern: Provider + hook
export function GameProvider({ children }: { children: ReactNode }) { ... }
export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
```

### Formatting
- 2-space indentation
- Single quotes for strings
- Semicolons in backend JS, optional in frontend TS
- Template literals for string interpolation

### Import Order
1. External packages (react, socket.io, etc.)
2. Internal modules (relative imports)
3. Type imports (with `type` keyword)

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `RoleCard`, `GameProvider` |
| Hooks | camelCase with `use` prefix | `useSocket`, `useGame` |
| Context | `*Context` + `use*` hook | `GameContext`, `useGame` |
| Socket events | snake_case | `create_game`, `night_action`, `cast_vote` |
| Role IDs | Title Case with spaces | `Alpha Wolf`, `Mystic Wolf`, `Paranormal Investigator` |
| Files (components) | PascalCase.tsx | `RoleCard.tsx`, `Home.tsx` |
| Files (utilities) | camelCase.ts/js | `useSocket.ts`, `gameStore.js` |
| Database models | PascalCase | `Game`, `Player` |
| Game states | UPPER_CASE | `LOBBY`, `NIGHT`, `DAY`, `RESULTS` |

## Architecture

### Key Files
- `server.js` - Express + Socket.IO server, event handlers
- `gameLogic.js` - Pure game logic (testable, no side effects)
- `src/server/gameStore.js` - Prisma database operations
- `client/src/context/GameContext.tsx` - Client state management
- `client/src/types/index.ts` - TypeScript type definitions
- `prisma/schema.prisma` - Database schema

### Game Logic Isolation
`gameLogic.js` contains pure functions with no side effects:
- `getNextNightTurn(game)` - Determine next night phase
- `autoResolveRole(game, role)` - Handle passive role actions
- `processNightAction(game, player, action, targetIds)` - Process interactive actions

These functions mutate the game object passed to them and return results.

### Socket.IO Events
Client-to-server: `create_game`, `join_game`, `start_game`, `night_action`, `cast_vote`
Server-to-client: `game_created`, `joined_room`, `night_turn`, `action_result`, `vote_results`

### Database Transactions
Use Prisma transactions for atomic operations:
```javascript
return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ ... });
    // Multiple related operations
    return tx.game.update({ ... });
});
```

## Error Handling

### Backend
```javascript
socket.on('join_game', async ({ name, roomCode }) => {
    try {
        const game = await gameStore.joinGame(room, name, socket.id);
        socket.emit('joined_room', { ... });
    } catch (err) {
        console.error("Join game error:", err);
        socket.emit('error', { message: err.message || 'Failed to join game' });
    }
});
```

### Frontend
- Errors stored in `GameContext` state
- Display via error state in components
- Clear with `clearError()` action
