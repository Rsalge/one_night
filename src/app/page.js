'use client';

import { useState, useEffect } from 'react';
import Login from '@/components/Login';
import Lobby from '@/components/Lobby';
import GameTable from '@/components/GameTable';
import DayPhase from '@/components/DayPhase';
import GameResults from '@/components/GameResults';
import { getSocket } from '@/lib/socket';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isInLobby, setIsInLobby] = useState(false);
  const [initialPlayers, setInitialPlayers] = useState([]);
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState('LOBBY');
  const [dayPlayers, setDayPlayers] = useState([]);
  const [voteResults, setVoteResults] = useState(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('game_created', ({ roomCode, players }) => {
      setRoomCode(roomCode);
      setInitialPlayers(players || []);
      setIsInLobby(true);
    });

    socket.on('joined_room', ({ roomCode, players }) => {
      setRoomCode(roomCode);
      setInitialPlayers(players || []);
      setIsInLobby(true);
    });

    socket.on('error', ({ message }) => {
      alert(message);
    });

    socket.on('game_started', (data) => {
      setGameData(data);
      setPhase('NIGHT');
    });

    socket.on('phase_change', ({ phase, players }) => {
      setPhase(phase);
      if (players) setDayPlayers(players);
    });

    socket.on('vote_results', (results) => {
      setVoteResults(results);
      setPhase('RESULTS');
    });

    return () => {
      socket.off('connect');
      socket.off('game_created');
      socket.off('joined_room');
      socket.off('error');
      socket.off('game_started');
      socket.off('phase_change');
      socket.off('vote_results');
    };
  }, []);

  const handleCreate = (name) => {
    setPlayerName(name);
    const socket = getSocket();
    socket.emit('create_game', { name });
  };

  const handleJoin = (name, code) => {
    setPlayerName(name);
    const socket = getSocket();
    socket.emit('join_game', { name, roomCode: code });
  };

  // Results screen
  if (phase === 'RESULTS' && voteResults) {
    return <GameResults results={voteResults} />;
  }

  // Day phase — voting
  if (phase === 'DAY') {
    return <DayPhase players={dayPlayers} roomCode={roomCode} />;
  }

  // Night phase — game table
  if (gameData && (phase === 'NIGHT' || phase === 'LOBBY')) {
    return <GameTable role={gameData.role} players={gameData.players} centerCardsCount={gameData.centerCardsCount} roomCode={gameData.roomCode} />;
  }

  // Lobby
  if (isInLobby) {
    return <Lobby playerName={playerName} roomCode={roomCode} initialPlayers={initialPlayers} />;
  }

  // Login
  return <Login onCreate={handleCreate} onJoin={handleJoin} />;
}
