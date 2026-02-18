'use client';

import { useState } from 'react';
import styles from './NightAction.module.css';
import { getSocket } from '@/lib/socket';

export default function NightAction({ role, players, roomCode }) {
    const [selectedPlayers, setSelectedPlayers] = useState([]);
    const [selectedCenter, setSelectedCenter] = useState([]);
    const [submitted, setSubmitted] = useState(false);

    const socket = getSocket();

    const handlePlayerClick = (playerId) => {
        if (submitted) return;

        let max = 1;
        if (role === 'Troublemaker') max = 2;
        if (role === 'Seer' && selectedCenter.length > 0) return;

        if (selectedPlayers.includes(playerId)) {
            setSelectedPlayers(selectedPlayers.filter(id => id !== playerId));
        } else {
            if (selectedPlayers.length < max) {
                setSelectedPlayers([...selectedPlayers, playerId]);
            }
        }
    };

    const handleCenterClick = (idx) => {
        if (submitted) return;
        if (role !== 'Seer' && role !== 'Drunk') return;

        let max = 1;
        if (role === 'Seer') max = 2;
        if (selectedPlayers.length > 0) return;

        if (selectedCenter.includes(idx)) {
            setSelectedCenter(selectedCenter.filter(i => i !== idx));
        } else {
            if (selectedCenter.length < max) {
                setSelectedCenter([...selectedCenter, idx]);
            }
        }
    };

    const canSubmit = () => {
        if (role === 'Seer') return selectedPlayers.length === 1 || selectedCenter.length === 2;
        if (role === 'Robber') return selectedPlayers.length === 1;
        if (role === 'Troublemaker') return selectedPlayers.length === 2;
        if (role === 'Drunk') return selectedCenter.length === 1;
        return false;
    };

    const submitAction = () => {
        if (!canSubmit()) return;

        let targetIds = [];
        if (selectedPlayers.length > 0) targetIds = selectedPlayers;
        else if (selectedCenter.length > 0) targetIds = selectedCenter;

        socket.emit('night_action', { roomCode, action: 'act', targetIds });
        setSubmitted(true);
    };

    const hints = {
        'Seer': 'Select 1 player to view OR 2 center cards.',
        'Robber': 'Select 1 player to swap cards with.',
        'Troublemaker': 'Select 2 other players to swap their cards.',
        'Drunk': 'Select 1 center card to blindly swap with.'
    };

    return (
        <div className={styles.container}>
            <div className={styles.instructions}>
                <h3>Your Turn!</h3>
                <p className={styles.hint}>{hints[role]}</p>
            </div>

            {!submitted && (
                <div className={styles.targets}>
                    {/* Player targets — show for Seer, Robber, Troublemaker */}
                    {(role === 'Seer' || role === 'Robber' || role === 'Troublemaker') && (
                        <>
                            <h4>Players</h4>
                            <div className={styles.playerGrid}>
                                {players.map(p => (
                                    <button
                                        key={p.id}
                                        className={`${styles.targetBtn} ${selectedPlayers.includes(p.id) ? styles.selected : ''}`}
                                        onClick={() => handlePlayerClick(p.id)}
                                        disabled={role === 'Seer' && selectedCenter.length > 0}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Center card targets — show for Seer and Drunk */}
                    {(role === 'Seer' || role === 'Drunk') && (
                        <>
                            <h4>Center Cards</h4>
                            <div className={styles.centerGrid}>
                                {[0, 1, 2].map(i => (
                                    <button
                                        key={i}
                                        className={`${styles.targetBtn} ${selectedCenter.includes(i) ? styles.selected : ''}`}
                                        onClick={() => handleCenterClick(i)}
                                        disabled={role === 'Seer' && selectedPlayers.length > 0}
                                    >
                                        Card {i + 1}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    <button
                        className={`btn ${styles.confirmBtn}`}
                        onClick={submitAction}
                        disabled={!canSubmit()}
                    >
                        Confirm Action
                    </button>
                </div>
            )}

            {submitted && (
                <div className={styles.waiting}>Processing...</div>
            )}
        </div>
    );
}
