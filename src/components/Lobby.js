'use client';

import { useEffect, useState } from 'react';
import styles from './Lobby.module.css';
import { getSocket } from '@/lib/socket';

export default function Lobby({ playerName, roomCode, initialPlayers = [] }) {
    const [players, setPlayers] = useState(initialPlayers);

    useEffect(() => {
        const socket = getSocket();

        // Listen for player list updates
        socket.on('update_players', (playerList) => {
            setPlayers(playerList);
        });

        return () => {
            socket.off('update_players');
        };
    }, []);

    const handleStartGame = () => {
        const socket = getSocket();
        socket.emit('start_game', { roomCode });
    };

    const isHost = players.find(p => p.name === playerName)?.isHost;

    return (
        <div className={styles.container}>
            <h2 className="title">Lobby</h2>
            <div className={styles.roomCodeDisplay}>
                Room Code: <strong>{roomCode}</strong>
            </div>
            <div className={styles.playerList}>
                {players.map((p) => (
                    <div key={p.id} className={styles.playerCard}>
                        <div className={styles.avatar}>
                            {/* Placeholder for future AI art/avatar */}
                            {p.name[0].toUpperCase()}
                        </div>
                        <span className={styles.name}>{p.name}</span>
                        {p.isHost && <span className={styles.hostBadge}>HOST</span>}
                    </div>
                ))}
                {players.length === 0 && <p className={styles.waiting}>Waiting for players...</p>}
            </div>

            <div className={styles.controls}>
                <p>You are: <strong>{playerName}</strong></p>
                {isHost && (
                    <button className="btn" onClick={handleStartGame}>Start Game</button>
                )}
                {!isHost && <p className={styles.waiting}>Waiting for host to start...</p>}
            </div>
        </div>
    );
}
