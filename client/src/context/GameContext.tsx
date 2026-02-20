import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSocket } from '../hooks/useSocket';
import type {
  Player,
  GamePhase,
  NightTurn,
  ActionResult,
  GameResult,
  NightActionPrompt,
  NightActionOption,
} from '../types';

// Generate a unique session ID for reconnection
function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Helper to get/create session ID
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('onw_sessionId');
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem('onw_sessionId', sessionId);
  }
  return sessionId;
}

interface GameContextValue {
  // Connection
  isConnected: boolean;
  socketId: string | null;

  // Player
  playerName: string | null;
  setPlayerName: (name: string) => void;

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

  // Actions
  createGame: (name: string) => void;
  joinGame: (name: string, code: string) => void;
  startGame: () => void;
  selectRoles: (roles: string[]) => void;
  submitNightAction: (targetIds: (string | number)[]) => void;
  acknowledgeNightResult: () => void;
  castVote: (targetId: string) => void;
  restartGame: () => void;
  clearError: () => void;
  leaveGame: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { isConnected, emit, on, getSocketId } = useSocket();

  // Player state
  const [playerName, setPlayerNameState] = useState<string | null>(() =>
    sessionStorage.getItem('onw_playerName')
  );
  const [socketId, setSocketId] = useState<string | null>(null);

  // Room state
  const [roomCode, setRoomCode] = useState<string | null>(() =>
    sessionStorage.getItem('onw_roomCode')
  );
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

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

  // Track socket ID
  useEffect(() => {
    if (isConnected) {
      const id = getSocketId();
      setSocketId(id);
    }
  }, [isConnected, getSocketId]);

  // Set player name and persist
  const setPlayerName = useCallback((name: string) => {
    setPlayerNameState(name);
    sessionStorage.setItem('onw_playerName', name);
  }, []);

  // Build night action prompt from night turn
  const buildNightActionPrompt = useCallback((turn: NightTurn, gamePlayers: Player[]): NightActionPrompt | null => {
    if (!turn.isInteractive || !turn.activeRole) return null;

    const role = turn.activeRole;
    let prompt = turn.flavor;
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
        maxSelections = 2; // Either 1 player or 2 center cards
        break;

      case 'Apprentice Seer':
        // Can view 1 center card
        options.push({ type: 'center', id: 0, label: 'Center Card 1' });
        options.push({ type: 'center', id: 1, label: 'Center Card 2' });
        options.push({ type: 'center', id: 2, label: 'Center Card 3' });
        break;

      case 'Werewolf':
        // Lone wolf: view 1 center card
        options.push({ type: 'center', id: 0, label: 'Center Card 1' });
        options.push({ type: 'center', id: 1, label: 'Center Card 2' });
        options.push({ type: 'center', id: 2, label: 'Center Card 3' });
        break;

      case 'Robber':
      case 'Mystic Wolf':
      case 'Sentinel':
      case 'Alpha Wolf':
      case 'Revealer':
        // Target 1 other player
        gamePlayers.forEach(p => {
          if (p.id !== myId) {
            options.push({ type: 'player', id: p.id, label: p.name });
          }
        });
        break;

      case 'Troublemaker':
        // Target 2 other players
        gamePlayers.forEach(p => {
          if (p.id !== myId) {
            options.push({ type: 'player', id: p.id, label: p.name });
          }
        });
        canSelectMultiple = true;
        maxSelections = 2;
        break;

      case 'Paranormal Investigator':
        // View up to 2 players
        gamePlayers.forEach(p => {
          if (p.id !== myId) {
            options.push({ type: 'player', id: p.id, label: p.name });
          }
        });
        canSelectMultiple = true;
        maxSelections = 2;
        break;

      case 'Drunk':
        // Swap with 1 center card
        options.push({ type: 'center', id: 0, label: 'Center Card 1' });
        options.push({ type: 'center', id: 1, label: 'Center Card 2' });
        options.push({ type: 'center', id: 2, label: 'Center Card 3' });
        break;

      case 'Witch':
        // View 1 center card, optionally swap with player
        // This is complex - first select center, then optionally player
        options.push({ type: 'center', id: 0, label: 'Center Card 1' });
        options.push({ type: 'center', id: 1, label: 'Center Card 2' });
        options.push({ type: 'center', id: 2, label: 'Center Card 3' });
        gamePlayers.forEach(p => {
          options.push({ type: 'player', id: p.id, label: `Swap to ${p.name}` });
        });
        canSelectMultiple = true;
        maxSelections = 2; // 1 center + optionally 1 player
        break;

      default:
        // Generic: target any other player
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
    // Game created (host)
    const unsubGameCreated = on('game_created', (data) => {
      setRoomCode(data.roomCode);
      sessionStorage.setItem('onw_roomCode', data.roomCode);
      setPlayers(data.players);
      setSelectedRoles(data.selectedRoles);
      setIsHost(true);
      setPhase('lobby');

      // Set session for reconnection
      const sessionId = getSessionId();
      emit('set_session', { sessionId, roomCode: data.roomCode });
    });

    // Joined room (non-host)
    const unsubJoinedRoom = on('joined_room', (data) => {
      setRoomCode(data.roomCode);
      sessionStorage.setItem('onw_roomCode', data.roomCode);
      setPlayers(data.players);
      setSelectedRoles(data.selectedRoles);
      setPhase('lobby');

      // Set session for reconnection
      const sessionId = getSessionId();
      emit('set_session', { sessionId, roomCode: data.roomCode });
    });

    // Players updated
    const unsubUpdatePlayers = on('update_players', (newPlayers) => {
      setPlayers(newPlayers);
      // Check if we're now host
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
    });

    // Night turn
    const unsubNightTurn = on('night_turn', (turn) => {
      setNightTurn(turn);
      setPhase('night');
      setActionResult(null);

      // Build action prompt if it's our turn
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
      setNightAction(null);

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
      // If error mentions session, clear stored data
      if (data.message.toLowerCase().includes('session')) {
        sessionStorage.removeItem('onw_roomCode');
      }
    });

    return () => {
      unsubGameCreated();
      unsubJoinedRoom();
      unsubUpdatePlayers();
      unsubRolesUpdated();
      unsubGameStarted();
      unsubNightTurn();
      unsubActionResult();
      unsubPhaseChange();
      unsubVoteUpdate();
      unsubVoteResults();
      unsubReturnToLobby();
      unsubError();
    };
  }, [on, emit, getSocketId, players, buildNightActionPrompt]);

  // Attempt to rejoin on connect if we have stored session
  useEffect(() => {
    if (isConnected && roomCode && playerName) {
      const sessionId = sessionStorage.getItem('onw_sessionId');
      if (sessionId) {
        emit('rejoin_game', { sessionId, roomCode, playerName });
      }
    }
  }, [isConnected, roomCode, playerName, emit]);

  // Actions
  const createGame = useCallback((name: string) => {
    setPlayerName(name);
    emit('create_game', { name });
  }, [emit, setPlayerName]);

  const joinGame = useCallback((name: string, code: string) => {
    setPlayerName(name);
    emit('join_game', { name, roomCode: code.toUpperCase() });
  }, [emit, setPlayerName]);

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
    sessionStorage.removeItem('onw_roomCode');
    sessionStorage.removeItem('onw_sessionId');
    sessionStorage.removeItem('onw_playerName');
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
    setPlayerNameState(null);
  }, []);

  const value: GameContextValue = {
    isConnected,
    socketId,
    playerName,
    setPlayerName,
    roomCode,
    players,
    isHost,
    selectedRoles,
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
