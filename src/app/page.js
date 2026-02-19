'use client';

import { useState, useEffect, useRef } from 'react';
import Login from '@/components/Login';
import Lobby from '@/components/Lobby';
import GameTable from '@/components/GameTable';
import DayPhase from '@/components/DayPhase';
import GameResults from '@/components/GameResults';
import { getSocket } from '@/lib/socket';

function getSessionId() {
  let sid = sessionStorage.getItem('onw_sessionId');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('onw_sessionId', sid);
  }
  return sid;
}

function saveSession(playerName, roomCode) {
  sessionStorage.setItem('onw_playerName', playerName);
  sessionStorage.setItem('onw_roomCode', roomCode);
}

function clearSession() {
  sessionStorage.removeItem('onw_playerName');
  sessionStorage.removeItem('onw_roomCode');
}

function getSavedSession() {
  const playerName = sessionStorage.getItem('onw_playerName');
  const roomCode = sessionStorage.getItem('onw_roomCode');
  const sessionId = sessionStorage.getItem('onw_sessionId');
  if (playerName && roomCode && sessionId) {
    return { playerName, roomCode, sessionId };
  }
  return null;
}

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isInLobby, setIsInLobby] = useState(false);
  const [initialPlayers, setInitialPlayers] = useState([]);
  const [initialRoles, setInitialRoles] = useState([]);
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState('LOBBY');
  const [dayPlayers, setDayPlayers] = useState([]);
  const [voteResults, setVoteResults] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const hasAttemptedRejoin = useRef(false);

  useEffect(() => {
    const socket = getSocket();

    socket.on('connect', () => {
      console.log('Connected to server');

      // Attempt rejoin on connect if we have a saved session
      if (!hasAttemptedRejoin.current) {
        hasAttemptedRejoin.current = true;
        const saved = getSavedSession();
        if (saved) {
          console.log('Attempting rejoin...', saved);
          socket.emit('rejoin_game', {
            sessionId: saved.sessionId,
            roomCode: saved.roomCode,
            playerName: saved.playerName
          });
        }
      }
    });

    socket.on('game_created', ({ roomCode, players, selectedRoles }) => {
      setRoomCode(roomCode);
      setInitialPlayers(players || []);
      setInitialRoles(selectedRoles || []);
      setIsHost(true);
      setIsInLobby(true);
      setPhase('LOBBY');

      // Handle session persistence
      const name = sessionStorage.getItem('onw_playerName') || playerName;
      saveSession(name, roomCode);
      socket.emit('set_session', { sessionId: getSessionId(), roomCode });
    });

    socket.on('joined_room', ({ roomCode, players, selectedRoles }) => {
      setRoomCode(roomCode);
      setInitialPlayers(players || []);
      setInitialRoles(selectedRoles || []);
      setIsInLobby(true);
      setPhase('LOBBY');

      // Check if we're host
      const me = players?.find(p => p.id === socket.id);
      setIsHost(me?.isHost || false);

      // Handle session persistence
      const name = sessionStorage.getItem('onw_playerName') || playerName;
      saveSession(name, roomCode);
      socket.emit('set_session', { sessionId: getSessionId(), roomCode });
    });

    socket.on('error', ({ message }) => {
      // If rejoin failed, silently clear session and show login
      if (message.includes('Session not found') || message.includes('Room not found. Game may have ended.')) {
        clearSession();
        return;
      }
      alert(message);
    });

    socket.on('game_started', (data) => {
      setGameData(data);
      setPhase('NIGHT');
      setIsInLobby(false);
      if (data.roomCode) {
        setRoomCode(data.roomCode);
      }
    });

    socket.on('phase_change', ({ phase, players }) => {
      setPhase(phase);
      if (players) setDayPlayers(players);
    });

    socket.on('vote_results', (results) => {
      setVoteResults(results);
      setPhase('RESULTS');
    });

    socket.on('return_to_lobby', ({ players, selectedRoles }) => {
      setInitialPlayers(players);
      setInitialRoles(selectedRoles || []);
      setGameData(null);
      setVoteResults(null);
      setDayPlayers([]);
      setPhase('LOBBY');
      setIsInLobby(true);
      const myId = socket.id;
      const me = players.find(p => p.id === myId);
      setIsHost(me?.isHost || false);
    });

    return () => {
      socket.off('connect');
      socket.off('game_created');
      socket.off('joined_room');
      socket.off('error');
      socket.off('game_started');
      socket.off('phase_change');
      socket.off('vote_results');
      socket.off('return_to_lobby');
    };
  }, []);

  const handleCreate = (name) => {
    setPlayerName(name);
    sessionStorage.setItem('onw_playerName', name);
    const socket = getSocket();
    socket.emit('create_game', { name });
  };

  const handleJoin = (name, code) => {
    setPlayerName(name);
    sessionStorage.setItem('onw_playerName', name);
    const socket = getSocket();
    socket.emit('join_game', { name, roomCode: code });
  };

  // Results screen
  if (phase === 'RESULTS' && voteResults) {
    return <GameResults results={voteResults} isHost={isHost} roomCode={roomCode} />;
  }

  // Day phase — voting
  if (phase === 'DAY') {
    return <DayPhase players={dayPlayers} roomCode={roomCode} />;
  }

  // Night phase — game table
  if (gameData && phase === 'NIGHT') {
    return <GameTable role={gameData.role} players={gameData.players} centerCardsCount={gameData.centerCardsCount} roomCode={gameData.roomCode} />;
  }

  // Lobby
  if (isInLobby) {
    return <Lobby playerName={playerName} roomCode={roomCode} initialPlayers={initialPlayers} initialRoles={initialRoles} />;
  }

  // Login
  return <Login onCreate={handleCreate} onJoin={handleJoin} />;
}
