'use client';

import { useEffect, useState } from 'react';
import styles from './Lobby.module.css';
import { getSocket } from '@/lib/socket';

const ALL_AVAILABLE_ROLES = [
    'Werewolf', 'Werewolf', 'Seer', 'Robber', 'Troublemaker',
    'Villager', 'Villager', 'Villager', 'Mason', 'Mason',
    'Minion', 'Drunk', 'Insomniac', 'Hunter', 'Tanner'
];

// Map role to emoji for visual flair
const ROLE_EMOJI = {
    'Werewolf': '🐺', 'Seer': '🔮', 'Robber': '🦹', 'Troublemaker': '🔀',
    'Villager': '🧑‍🌾', 'Mason': '🧱', 'Minion': '👹', 'Drunk': '🍺',
    'Insomniac': '😳', 'Hunter': '🏹', 'Tanner': '🪵'
};

export default function Lobby({ playerName, roomCode, initialPlayers = [], initialRoles = [] }) {
    const [players, setPlayers] = useState(initialPlayers);
    const [selectedRoles, setSelectedRoles] = useState(
        initialRoles.length > 0 ? initialRoles : [...ALL_AVAILABLE_ROLES]
    );
    const [showRoles, setShowRoles] = useState(false);

    useEffect(() => {
        const socket = getSocket();

        socket.on('update_players', (playerList) => {
            setPlayers(playerList);
        });

        socket.on('roles_updated', ({ selectedRoles }) => {
            setSelectedRoles(selectedRoles);
        });

        return () => {
            socket.off('update_players');
            socket.off('roles_updated');
        };
    }, []);

    const isHost = players.find(p => p.name === playerName)?.isHost;
    const needed = players.length + 3;

    const handleStartGame = () => {
        if (selectedRoles.length < needed) {
            alert(`Need at least ${needed} roles (${players.length} players + 3 center cards)`);
            return;
        }
        const socket = getSocket();
        socket.emit('start_game', { roomCode });
    };

    const toggleRole = (index) => {
        if (!isHost) return;

        const roleName = ALL_AVAILABLE_ROLES[index];
        // Find this role in selectedRoles
        const selectedIndex = selectedRoles.findIndex((r, si) => {
            // Match the N-th occurrence
            const rolesBefore = ALL_AVAILABLE_ROLES.slice(0, index).filter(x => x === roleName).length;
            const selectedBefore = selectedRoles.slice(0, si).filter(x => x === roleName).length;
            return r === roleName && selectedBefore === rolesBefore;
        });

        let newRoles;
        if (selectedIndex !== -1) {
            // Remove it
            newRoles = [...selectedRoles];
            newRoles.splice(selectedIndex, 1);
        } else {
            // Add it
            newRoles = [...selectedRoles, roleName];
        }

        setSelectedRoles(newRoles);

        const socket = getSocket();
        socket.emit('update_roles', { roomCode, selectedRoles: newRoles });
    };

    // Check if a specific role instance (by index in ALL_AVAILABLE_ROLES) is selected
    const isRoleSelected = (index) => {
        const roleName = ALL_AVAILABLE_ROLES[index];
        const occurrenceBefore = ALL_AVAILABLE_ROLES.slice(0, index).filter(x => x === roleName).length;
        const countInSelected = selectedRoles.filter(x => x === roleName).length;
        return countInSelected > occurrenceBefore;
    };

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
                            {p.name[0].toUpperCase()}
                        </div>
                        <span className={styles.name}>{p.name}</span>
                        {p.isHost && <span className={styles.hostBadge}>HOST</span>}
                    </div>
                ))}
                {players.length === 0 && <p className={styles.waiting}>Waiting for players...</p>}
            </div>

            {/* Role Selection */}
            <div className={styles.roleSection}>
                <button
                    className={styles.roleToggle}
                    onClick={() => setShowRoles(!showRoles)}
                >
                    🎭 Roles in Play ({selectedRoles.length})
                    <span className={styles.chevron}>{showRoles ? '▲' : '▼'}</span>
                </button>

                {showRoles && (
                    <div className={styles.roleGrid}>
                        {ALL_AVAILABLE_ROLES.map((role, idx) => {
                            const selected = isRoleSelected(idx);
                            return (
                                <button
                                    key={idx}
                                    className={`${styles.roleChip} ${selected ? styles.roleSelected : styles.roleUnselected}`}
                                    onClick={() => toggleRole(idx)}
                                    disabled={!isHost}
                                >
                                    <span className={styles.roleEmoji}>{ROLE_EMOJI[role]}</span>
                                    <span>{role}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {showRoles && (
                    <p className={styles.roleHint}>
                        {isHost
                            ? `Select at least ${needed} roles (${players.length} players + 3 center)`
                            : 'Only the host can change roles'}
                    </p>
                )}
            </div>

            <div className={styles.controls}>
                <p>You are: <strong>{playerName}</strong></p>
                {isHost && (
                    <button
                        className="btn"
                        onClick={handleStartGame}
                        disabled={selectedRoles.length < needed}
                    >
                        Start Game
                    </button>
                )}
                {!isHost && <p className={styles.waiting}>Waiting for host to start...</p>}
            </div>
        </div>
    );
}
