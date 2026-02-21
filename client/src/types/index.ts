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

// ==================== AUTH TYPES ====================

export interface User {
  id: number;
  username: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

// ==================== PLAYER TYPES ====================
// Matches One Night backend's Player model

export interface Player {
  id: string;           // Socket ID
  name: string;         // Player display name (max 20 chars)
  isHost: boolean;
  role?: string | null;
  originalRole?: string | null;
  disconnected?: boolean;
  userId?: number | null;
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
  playerResults: Array<{ id: string; odid?: number; didWin: boolean }>;
}

// ==================== SOCKET EVENT TYPES ====================
// These match the One Night backend's actual socket events

export interface ServerToClientEvents {
  // Room events
  game_created: (data: { roomCode: string; players: Player[]; selectedRoles: string[] }) => void;
  joined_room: (data: { roomCode: string; players: Player[]; selectedRoles: string[] }) => void;
  update_players: (players: Player[]) => void;
  roles_updated: (data: { selectedRoles: string[] }) => void;
  role_ready_update: (data: { readyCount: number; totalPlayers: number; confirmedPlayerIds: string[] }) => void;
  role_ready_warning: (data: { message: string; secondsRemaining: number }) => void;

  // Reconnection
  rejoined_game: (data: {
    roomCode: string;
    players: Player[] | Array<{ id: string; name: string }>;
    selectedRoles: string[];
    state: GameState;
    myRole?: string;
    centerCardsCount?: number;
    isHost: boolean;
  }) => void;
  no_active_game: () => void;

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
  // Room management (no name parameter - uses authenticated username)
  create_game: () => void;
  join_game: (data: { roomCode: string }) => void;
  leave_game: () => void;

  // Reconnection
  reconnect_to_game: () => void;

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

  // Role ready confirmation
  confirm_role_ready: (data: { roomCode: string }) => void;
  force_start_night: (data: { roomCode: string }) => void;
}

// Auth socket events (separate namespace)
export interface AuthServerToClientEvents {
  // None needed - using callbacks
}

export interface AuthClientToServerEvents {
  register: (data: { username: string; password: string }, callback: (response: AuthResponse) => void) => void;
  login: (data: { username: string; password: string }, callback: (response: AuthResponse) => void) => void;
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
  playerResults: Array<{ id: string; odid?: number; didWin: boolean }>;
  myResult?: { didWin: boolean };
}

// ==================== STATS TYPES ====================

export interface TeamStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface RoleStats {
  role: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface PlayerStats {
  userId: number;
  username: string;
  avatarUrl?: string | null;
  gamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  currentStreak: number;
  bestWinStreak: number;
  firstGameAt: string | null;
  lastPlayedAt: string | null;
  memberSince: string;
  teamStats: Record<string, TeamStats>;
  roleStats: RoleStats[];
  killCount: number;
  survivalCount: number;
  survivalRate: number;
  correctVotes: number;
  votingAccuracy: number;
  avgGameDuration: number | null;
  bestRole: { role: string; winRate: number } | null;
  worstRole: { role: string; winRate: number } | null;
  mostPlayedRole: { role: string; gamesPlayed: number } | null;
}
