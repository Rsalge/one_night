import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSocket, useAuthSocket } from '../hooks/useSocket';
import type {
  Player,
  GamePhase,
  NightTurn,
  ActionResult,
  GameResult,
  NightActionPrompt,
  NightActionOption,
  AuthResponse,
} from '../types';

interface GameContextValue {
  // Auth
  isAuthenticated: boolean;
  username: string | null;
  userId: number | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  authConnected: boolean;

  // Connection
  isConnected: boolean;
  socketId: string | null;

  // Room
  roomCode: string | null;
  players: Player[];
  isHost: boolean;
  selectedRoles: string[];

  // Game state
  phase: GamePhase;
  myRole: string | null;
  originalRole: string | null;
  nightTurn: NightTurn | null;
  nightAction: NightActionPrompt | null;
  actionResult: ActionResult | null;
  gameResult: GameResult | null;
  error: string | null;

  // Vote tracking
  voteCount: { voted: number; total: number };
  hasVoted: boolean;

  // Role ready tracking
  roleReadyCount: { ready: number; total: number; confirmedPlayerIds: string[] };

  // Actions
  createGame: () => void;
  joinGame: (code: string) => void;
  startGame: () => void;
  selectRoles: (roles: string[]) => void;
  submitNightAction: (targetIds: (string | number)[]) => void;
  acknowledgeNightResult: () => void;
  castVote: (targetId: string) => void;
  restartGame: () => void;
  clearError: () => void;
  leaveGame: () => void;
  confirmRoleReady: () => void;
  forceStartNight: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { isConnected, emit, on, getSocketId } = useSocket();
  const { socket: authSocket, isConnected: authConnected } = useAuthSocket();

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('token'));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem('username'));
  const [userId, setUserId] = useState<number | null>(() => {
    const stored = localStorage.getItem('userId');
    return stored ? parseInt(stored, 10) : null;
  });

  // Room state
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [socketId, setSocketId] = useState<string | null>(null);

  // Game state
  const [phase, setPhase] = useState<GamePhase>('lobby');
  const [myRole, setMyRole] = useState<string | null>(null);
  const [originalRole, setOriginalRole] = useState<string | null>(null);
  const [nightTurn, setNightTurn] = useState<NightTurn | null>(null);
  const [nightAction, setNightAction] = useState<NightActionPrompt | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Vote tracking
  const [voteCount, setVoteCount] = useState({ voted: 0, total: 0 });
  const [hasVoted, setHasVoted] = useState(false);

  // Role ready tracking
  const [roleReadyCount, setRoleReadyCount] = useState({ ready: 0, total: 0, confirmedPlayerIds: [] as string[] });

  // Track socket ID
  useEffect(() => {
    if (isConnected) {
      const id = getSocketId();
      setSocketId(id);
    }
  }, [isConnected, getSocketId]);

  // Auth methods
  const login = useCallback(async (loginUsername: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!authSocket) return { success: false, error: 'Not connected' };

    return new Promise((resolve) => {
      authSocket.emit('login', { username: loginUsername, password }, (response: AuthResponse) => {
        if (response.success && response.token && response.user) {
          localStorage.setItem('token', response.token);
          localStorage.setItem('username', response.user.username);
          localStorage.setItem('userId', response.user.id.toString());
          setUsername(response.user.username);
          setUserId(response.user.id);
          setIsAuthenticated(true);
          // Trigger page reload to reconnect socket with new token
          window.location.reload();
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  }, [authSocket]);

  const register = useCallback(async (registerUsername: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!authSocket) return { success: false, error: 'Not connected' };

    return new Promise((resolve) => {
      authSocket.emit('register', { username: registerUsername, password }, (response: AuthResponse) => {
        if (response.success && response.token && response.user) {
          localStorage.setItem('token', response.token);
          localStorage.setItem('username', response.user.username);
          localStorage.setItem('userId', response.user.id.toString());
          setUsername(response.user.username);
          setUserId(response.user.id);
          setIsAuthenticated(true);
          // Trigger page reload to reconnect socket with new token
          window.location.reload();
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  }, [authSocket]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    setUsername(null);
    setUserId(null);
    setIsAuthenticated(false);
    setRoomCode(null);
    setPlayers([]);
    setPhase('lobby');
    window.location.reload();
  }, []);

  // Build night action prompt from night turn
  const buildNightActionPrompt = useCallback((turn: NightTurn, gamePlayers: Player[]): NightActionPrompt | null => {
    if (!turn.isInteractive || !turn.activeRole) return null;

    const role = turn.activeRole;
    const prompt = turn.flavor;
    const options: NightActionOption[] = [];
    let canSelectMultiple = false;
    let maxSelections = 1;

    // Get current socket ID
    const myId = getSocketId();

    // Build options based on role
    switch (role) {
      case 'Seer':
        // Can view 1 player OR 2 center cards
        gamePlayers.forEach(p => {
          if (p.id !== myId) {
            options.push({ type: 'player', id: p.id, label: p.name });
          }
        });
        options.push({ type: 'center', id: 0, label: 'Center Card 1' });
        options.push({ type: 'center', id: 1, label: 'Center Card 2' });
        options.push({ type: 'center', id: 2, label: 'Center Card 3' });
        canSelectMultiple = true;
        maxSelections = 2;
        break;

      case 'Apprentice Seer':
        options.push({ type: 'center', id: 0, label: 'Center Card 1' });
        options.push({ type: 'center', id: 1, label: 'Center Card 2' });
        options.push({ type: 'center', id: 2, label: 'Center Card 3' });
        break;

      case 'Werewolf':
        options.push({ type: 'center', id: 0, label: 'Center Card 1' });
        options.push({ type: 'center', id: 1, label: 'Center Card 2' });
        options.push({ type: 'center', id: 2, label: 'Center Card 3' });
        break;

      case 'Robber':
      case 'Mystic Wolf':
      case 'Sentinel':
      case 'Alpha Wolf':
      case 'Revealer':
        gamePlayers.forEach(p => {
          if (p.id !== myId) {
            options.push({ type: 'player', id: p.id, label: p.name });
          }
        });
        break;

      case 'Troublemaker':
        gamePlayers.forEach(p => {
          if (p.id !== myId) {
            options.push({ type: 'player', id: p.id, label: p.name });
          }
        });
        canSelectMultiple = true;
        maxSelections = 2;
        break;

      case 'Paranormal Investigator':
        gamePlayers.forEach(p => {
          if (p.id !== myId) {
            options.push({ type: 'player', id: p.id, label: p.name });
          }
        });
        canSelectMultiple = true;
        maxSelections = 2;
        break;

      case 'Drunk':
        options.push({ type: 'center', id: 0, label: 'Center Card 1' });
        options.push({ type: 'center', id: 1, label: 'Center Card 2' });
        options.push({ type: 'center', id: 2, label: 'Center Card 3' });
        break;

      case 'Witch':
        options.push({ type: 'center', id: 0, label: 'Center Card 1' });
        options.push({ type: 'center', id: 1, label: 'Center Card 2' });
        options.push({ type: 'center', id: 2, label: 'Center Card 3' });
        gamePlayers.forEach(p => {
          options.push({ type: 'player', id: p.id, label: `Swap to ${p.name}` });
        });
        canSelectMultiple = true;
        maxSelections = 2;
        break;

      default:
        gamePlayers.forEach(p => {
          if (p.id !== myId) {
            options.push({ type: 'player', id: p.id, label: p.name });
          }
        });
    }

    return { role, prompt, options, canSelectMultiple, maxSelections };
  }, [getSocketId]);

  // Socket event handlers
  useEffect(() => {
    if (!isConnected) return;

    // Game created (host)
    const unsubGameCreated = on('game_created', (data) => {
      setRoomCode(data.roomCode);
      setPlayers(data.players);
      setSelectedRoles(data.selectedRoles);
      setIsHost(true);
      setPhase('lobby');
    });

    // Joined room (non-host)
    const unsubJoinedRoom = on('joined_room', (data) => {
      setRoomCode(data.roomCode);
      setPlayers(data.players);
      setSelectedRoles(data.selectedRoles);
      setPhase('lobby');
    });

    // Rejoined game (reconnection)
    const unsubRejoinedGame = on('rejoined_game', (data) => {
      setRoomCode(data.roomCode);
      setPlayers(data.players as Player[]);
      setSelectedRoles(data.selectedRoles);
      setIsHost(data.isHost);

      if (data.state === 'LOBBY') {
        setPhase('lobby');
      } else if (data.state === 'NIGHT') {
        setPhase('night');
        if (data.myRole) {
          setMyRole(data.myRole);
          setOriginalRole(data.myRole);
        }
      } else if (data.state === 'DAY') {
        setPhase('day');
        if (data.myRole) {
          setMyRole(data.myRole);
          setOriginalRole(data.myRole);
        }
      }
    });

    // No active game found
    const unsubNoActiveGame = on('no_active_game', () => {
      // User has no active game to reconnect to
      setRoomCode(null);
    });

    // Players updated
    const unsubUpdatePlayers = on('update_players', (newPlayers) => {
      setPlayers(newPlayers);
      const myId = getSocketId();
      const me = newPlayers.find(p => p.id === myId);
      if (me) {
        setIsHost(me.isHost);
      }
    });

    // Roles updated (by host)
    const unsubRolesUpdated = on('roles_updated', (data) => {
      setSelectedRoles(data.selectedRoles);
    });

    // Game started - receive role
    const unsubGameStarted = on('game_started', (data) => {
      setMyRole(data.role);
      setOriginalRole(data.role);
      setPlayers(data.players.map(p => ({ ...p, name: p.name, isHost: false })));
      setPhase('role_reveal');
      setNightTurn(null);
      setActionResult(null);
      setGameResult(null);
      setHasVoted(false);
      setVoteCount({ voted: 0, total: data.players.length });
      setRoleReadyCount({ ready: 0, total: data.players.length, confirmedPlayerIds: [] });
    });

    // Role ready update
    const unsubRoleReadyUpdate = on('role_ready_update', (data) => {
      setRoleReadyCount({
        ready: data.readyCount,
        total: data.totalPlayers,
        confirmedPlayerIds: data.confirmedPlayerIds || []
      });
    });

    // Night turn
    const unsubNightTurn = on('night_turn', (turn) => {
      setNightTurn(turn);
      setPhase('night');
      setActionResult(null);

      if (turn.isInteractive && turn.activePlayerIds.includes(getSocketId() ?? '')) {
        const prompt = buildNightActionPrompt(turn, players);
        setNightAction(prompt);
      } else {
        setNightAction(null);
      }
    });

    // Action result
    const unsubActionResult = on('action_result', (result) => {
      setActionResult(result || { type: 'info', message: 'Action completed with no effect.' });

      // Update myRole if it changed (e.g., Robber, PI)
      if (result && result.newRole) {
        setMyRole(result.newRole);
      }
      if (result && result.becameRole) {
        setMyRole(result.becameRole);
      }
    });

    // Phase change to DAY
    const unsubPhaseChange = on('phase_change', (data) => {
      if (data.phase === 'DAY') {
        setPhase('day');
        setNightTurn(null);
        setNightAction(null);
        setActionResult(null);
        setHasVoted(false);
        setVoteCount({ voted: 0, total: data.players.length });
      }
    });

    // Vote update
    const unsubVoteUpdate = on('vote_update', (data) => {
      setVoteCount({ voted: data.votedCount, total: data.totalPlayers });
    });

    // Vote results
    const unsubVoteResults = on('vote_results', (results) => {
      setPhase('results');
      const myId = getSocketId();
      const myResult = results.playerResults.find(r => r.id === myId);
      setGameResult({
        ...results,
        myResult,
      });
    });

    // Return to lobby
    const unsubReturnToLobby = on('return_to_lobby', (data) => {
      setPlayers(data.players);
      setSelectedRoles(data.selectedRoles);
      setPhase('lobby');
      setMyRole(null);
      setOriginalRole(null);
      setNightTurn(null);
      setNightAction(null);
      setActionResult(null);
      setGameResult(null);
      setHasVoted(false);
    });

    // Error
    const unsubError = on('error', (data) => {
      setError(data.message);
    });

    return () => {
      unsubGameCreated();
      unsubJoinedRoom();
      unsubRejoinedGame();
      unsubNoActiveGame();
      unsubUpdatePlayers();
      unsubRolesUpdated();
      unsubGameStarted();
      unsubRoleReadyUpdate();
      unsubNightTurn();
      unsubActionResult();
      unsubPhaseChange();
      unsubVoteUpdate();
      unsubVoteResults();
      unsubReturnToLobby();
      unsubError();
    };
  }, [on, getSocketId, players, buildNightActionPrompt, isConnected]);

  // Try to reconnect to active game on connect
  useEffect(() => {
    if (isConnected && isAuthenticated) {
      emit('reconnect_to_game');
    }
  }, [isConnected, isAuthenticated, emit]);

  // Actions
  const createGame = useCallback(() => {
    emit('create_game');
  }, [emit]);

  const joinGame = useCallback((code: string) => {
    emit('join_game', { roomCode: code.toUpperCase() });
  }, [emit]);

  const startGame = useCallback(() => {
    if (roomCode) {
      emit('start_game', { roomCode });
    }
  }, [emit, roomCode]);

  const selectRoles = useCallback((roles: string[]) => {
    if (roomCode) {
      setSelectedRoles(roles);
      emit('update_roles', { roomCode, selectedRoles: roles });
    }
  }, [emit, roomCode]);

  const submitNightAction = useCallback((targetIds: (string | number)[]) => {
    if (roomCode && nightTurn?.activeRole) {
      emit('night_action', {
        roomCode,
        action: nightTurn.activeRole,
        targetIds
      });
    }
  }, [emit, roomCode, nightTurn]);

  const acknowledgeNightResult = useCallback(() => {
    if (roomCode) {
      emit('acknowledge_night', { roomCode });
      setActionResult(null);
      setNightAction(null);
    }
  }, [emit, roomCode]);

  const castVote = useCallback((targetId: string) => {
    if (roomCode && !hasVoted) {
      emit('cast_vote', { roomCode, voteTarget: targetId });
      setHasVoted(true);
    }
  }, [emit, roomCode, hasVoted]);

  const restartGame = useCallback(() => {
    if (roomCode) {
      emit('restart_game', { roomCode });
    }
  }, [emit, roomCode]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const leaveGame = useCallback(() => {
    emit('leave_game');
    setRoomCode(null);
    setPlayers([]);
    setIsHost(false);
    setSelectedRoles([]);
    setPhase('lobby');
    setMyRole(null);
    setOriginalRole(null);
    setNightTurn(null);
    setNightAction(null);
    setActionResult(null);
    setGameResult(null);
  }, [emit]);

  const confirmRoleReady = useCallback(() => {
    if (roomCode) {
      emit('confirm_role_ready', { roomCode });
    }
  }, [emit, roomCode]);

  const forceStartNight = useCallback(() => {
    if (roomCode) {
      emit('force_start_night', { roomCode });
    }
  }, [emit, roomCode]);

  const value: GameContextValue = {
    // Auth
    isAuthenticated,
    username,
    userId,
    login,
    register,
    logout,
    authConnected,

    // Connection
    isConnected,
    socketId,

    // Room
    roomCode,
    players,
    isHost,
    selectedRoles,

    // Game state
    phase,
    myRole,
    originalRole,
    nightTurn,
    nightAction,
    actionResult,
    gameResult,
    error,
    voteCount,
    hasVoted,
    roleReadyCount,

    // Actions
    createGame,
    joinGame,
    startGame,
    selectRoles,
    submitNightAction,
    acknowledgeNightResult,
    castVote,
    restartGame,
    clearError,
    leaveGame,
    confirmRoleReady,
    forceStartNight,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
