// ==================== ROLE TYPES ====================
// These match the One Night backend's role system

export type Team = 'villager' | 'werewolf' | 'tanner';

// Role names as stored in the One Night backend (string-based, not kebab-case)
export type RoleId =
  | 'Werewolf'
  | 'Alpha Wolf'
  | 'Mystic Wolf'
  | 'Dream Wolf'
  | 'Minion'
  | 'Villager'
  | 'Seer'
  | 'Apprentice Seer'
  | 'Paranormal Investigator'
  | 'Robber'
  | 'Witch'
  | 'Troublemaker'
  | 'Drunk'
  | 'Insomniac'
  | 'Mason'
  | 'Hunter'
  | 'Tanner'
  | 'Revealer'
  | 'Sentinel';

export interface RoleDefinition {
  id: RoleId;
  name: string;
  team: Team;
  wakeOrder: number | null;
  maxCount: number;
  description: string;
  ability: string;
  strategy: string;
  emoji: string;
}

// ==================== PLAYER TYPES ====================
// Matches One Night backend's Player model

export interface Player {
  id: string;           // Socket ID
  name: string;         // Player display name (max 15 chars)
  isHost: boolean;
  role?: string | null;
  originalRole?: string | null;
  disconnected?: boolean;
  sessionId?: string | null;
}

// ==================== GAME STATE TYPES ====================

// One Night backend uses uppercase states
export type GameState = 'LOBBY' | 'NIGHT' | 'DAY' | 'RESULTS';

// Frontend phases (we'll map backend states to these)
// Note: 'voting' is combined with 'day' in One Night backend
export type GamePhase = 'lobby' | 'role_reveal' | 'night' | 'day' | 'results';

// Night turn info from backend
export interface NightTurn {
  activeRole: string | null;
  activePlayerIds: string[];
  flavor: string;
  isInteractive: boolean;
}

// Action result types from One Night backend (type-based system)
export interface ActionResult {
  type: 'view' | 'view_center' | 'swap_view' | 'swap' | 'swap_center' | 'info' | 'pi_result' | 'witch_result' | 'reveal';
  // For 'view' type
  role?: string;
  name?: string;
  // For 'view_center' type
  cards?: string[];
  // For 'swap_view' type
  newRole?: string;
  // For 'swap' and 'info' types
  message?: string;
  // For 'pi_result' type
  viewed?: Array<{ name: string; role: string }>;
  becameRole?: string | null;
  // For 'witch_result' type
  viewedCard?: string;
  swapped?: boolean;
  targetName?: string;
  shielded?: boolean;
  // For 'reveal' type
  staysRevealed?: boolean;
}

// Vote results from backend
export interface VoteResults {
  eliminated: Array<{ id: string; name: string; role: string }>;
  winners: string[];  // 'Village', 'Werewolf', 'Tanner'
  winReason: string;
  voteBreakdown: Record<string, string>;  // voterName -> targetName
  roleReveal: Array<{
    id: string;
    name: string;
    originalRole: string;
    finalRole: string;
  }>;
  centerCards: string[];
  nightLog: Array<{ role: string; description: string }>;
  playerResults: Array<{ id: string; didWin: boolean }>;
}

// ==================== SOCKET EVENT TYPES ====================
// These match the One Night backend's actual socket events

export interface ServerToClientEvents {
  // Room events
  game_created: (data: { roomCode: string; players: Player[]; selectedRoles: string[] }) => void;
  joined_room: (data: { roomCode: string; players: Player[]; selectedRoles: string[] }) => void;
  update_players: (players: Player[]) => void;
  roles_updated: (data: { selectedRoles: string[] }) => void;
  
  // Game start
  game_started: (data: {
    role: string;
    players: Array<{ id: string; name: string }>;
    centerCardsCount: number;
    roomCode: string;
  }) => void;
  
  // Night phase
  night_turn: (turn: NightTurn) => void;
  action_result: (result: ActionResult) => void;
  
  // Day/voting phase
  phase_change: (data: { phase: 'DAY'; players: Array<{ id: string; name: string }> }) => void;
  vote_update: (data: { votedCount: number; totalPlayers: number }) => void;
  vote_results: (results: VoteResults) => void;
  
  // Lobby return
  return_to_lobby: (data: { players: Player[]; selectedRoles: string[] }) => void;
  
  // Error
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  // Room management
  create_game: (data: { name: string }) => void;
  join_game: (data: { name: string; roomCode: string }) => void;
  
  // Session management
  set_session: (data: { sessionId: string; roomCode: string }) => void;
  rejoin_game: (data: { sessionId: string; roomCode: string; playerName: string }) => void;
  
  // Game control
  start_game: (data: { roomCode: string }) => void;
  update_roles: (data: { roomCode: string; selectedRoles: string[] }) => void;
  
  // Night actions
  night_action: (data: { roomCode: string; action: string; targetIds: (string | number)[] }) => void;
  acknowledge_night: (data: { roomCode: string }) => void;
  
  // Voting
  cast_vote: (data: { roomCode: string; voteTarget: string }) => void;
  
  // Restart
  restart_game: (data: { roomCode: string }) => void;
}

// ==================== HELPER TYPES ====================

// For the night action UI - transformed from backend data
export interface NightActionPrompt {
  role: string;
  prompt: string;
  options: NightActionOption[];
  canSelectMultiple: boolean;
  maxSelections: number;
}

export interface NightActionOption {
  type: 'player' | 'center';
  id: string | number;
  label: string;
}

// Transformed game result for results screen
export interface GameResult {
  eliminated: Array<{ id: string; name: string; role: string }>;
  winners: string[];
  winReason: string;
  voteBreakdown: Record<string, string>;
  roleReveal: Array<{
    id: string;
    name: string;
    originalRole: string;
    finalRole: string;
  }>;
  centerCards: string[];
  nightLog: Array<{ role: string; description: string }>;
  playerResults: Array<{ id: string; didWin: boolean }>;
  myResult?: { didWin: boolean };
}

// ==================== STATS TYPES ====================

export interface PlayerStats {
  gamesPlayed: number;
  teamStats: Record<Team, { wins: number; losses: number }>;
  roleStats: Record<string, { wins: number; losses: number; gamesPlayed: number }>;
  killCount: number;
  survivalCount: number;
  correctVotes: number;
}
