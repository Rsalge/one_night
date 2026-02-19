'use client';

import { useState } from 'react';
import styles from './NightAction.module.css';
import { getSocket } from '@/lib/socket';

export default function NightAction({ role, players, roomCode, centerCardsCount = 3 }) {
    const [selectedPlayers, setSelectedPlayers] = useState([]);
    const [selectedCenter, setSelectedCenter] = useState([]);
    const [submitted, setSubmitted] = useState(false);

    const socket = getSocket();

    // Roles that show a player grid
    const PLAYER_ROLES = [
        'Seer', 'Robber', 'Troublemaker',
        'Sentinel', 'Alpha Wolf', 'Mystic Wolf',
        'Paranormal Investigator', 'Witch', 'Revealer'
    ];

    // Roles that show center card grid
    const CENTER_ROLES = [
        'Seer', 'Drunk', 'Werewolf',
        'Apprentice Seer', 'Witch'
    ];

    const handlePlayerClick = (playerId) => {
        if (submitted) return;

        let max = 1;
        if (role === 'Troublemaker') max = 2;
        if (role === 'Paranormal Investigator') max = 2;
        if (role === 'Seer' && selectedCenter.length > 0) return;
        // Witch: can select 0 or 1 player (in addition to a center card)
        if (role === 'Witch' && selectedCenter.length === 0) return; // Must select center first

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
        if (!CENTER_ROLES.includes(role)) return;

        let max = 1;
        if (role === 'Seer') max = 2;
        // Seer: can't pick center if player already selected
        if (role === 'Seer' && selectedPlayers.length > 0) return;

        if (selectedCenter.includes(idx)) {
            setSelectedCenter(selectedCenter.filter(i => i !== idx));
        } else {
            if (selectedCenter.length < max) {
                setSelectedCenter([...selectedCenter, idx]);
            }
        }
    };

    const canSubmit = () => {
        if (role === 'Sentinel') return selectedPlayers.length === 1;
        if (role === 'Werewolf') return selectedCenter.length === 1;
        if (role === 'Alpha Wolf') return selectedPlayers.length === 1;
        if (role === 'Mystic Wolf') return selectedPlayers.length === 1;
        if (role === 'Seer') return selectedPlayers.length === 1 || selectedCenter.length === 2;
        if (role === 'Apprentice Seer') return selectedCenter.length === 1;
        if (role === 'Paranormal Investigator') return selectedPlayers.length >= 1 && selectedPlayers.length <= 2;
        if (role === 'Robber') return selectedPlayers.length === 1;
        if (role === 'Witch') return selectedCenter.length === 1; // Player swap is optional
        if (role === 'Troublemaker') return selectedPlayers.length === 2;
        if (role === 'Drunk') return selectedCenter.length === 1;
        if (role === 'Revealer') return selectedPlayers.length === 1;
        return false;
    };

    const submitAction = () => {
        if (!canSubmit()) return;

        let targetIds = [];

        if (role === 'Witch') {
            // Witch: always sends [centerIdx, ...optionalPlayerId]
            targetIds = [...selectedCenter, ...selectedPlayers];
        } else if (selectedPlayers.length > 0) {
            targetIds = selectedPlayers;
        } else if (selectedCenter.length > 0) {
            targetIds = selectedCenter;
        }

        socket.emit('night_action', { roomCode, action: 'act', targetIds });
        setSubmitted(true);
    };

    const hints = {
        'Sentinel': 'Place a shield on another player. Their card cannot be viewed or moved tonight.',
        'Werewolf': 'You are the lone wolf. Select 1 center card to peek at.',
        'Alpha Wolf': 'Choose a non-wolf player to swap with the center Werewolf card.',
        'Mystic Wolf': 'Select 1 player to secretly view their card.',
        'Seer': 'Select 1 player to view OR 2 center cards.',
        'Apprentice Seer': 'Select 1 center card to peek at.',
        'Paranormal Investigator': 'Select 1-2 players to investigate. If you see a Werewolf or Tanner, you become that role!',
        'Robber': 'Select 1 player to swap cards with.',
        'Witch': 'Select 1 center card to view, then optionally a player to swap it with.',
        'Troublemaker': 'Select 2 other players to swap their cards.',
        'Drunk': 'Select 1 center card to blindly swap with.',
        'Revealer': 'Select 1 player to flip their card. If it\u2019s a Werewolf or Tanner, it stays face-up!'
    };

    // Build center card array dynamically
    const centerIndices = Array.from({ length: centerCardsCount }, (_, i) => i);

    return (
        <div className={styles.container}>
            <div className={styles.instructions}>
                <h3>Your Turn!</h3>
                <p className={styles.hint}>{hints[role]}</p>
            </div>

            {!submitted && (
                <div className={styles.targets}>
                    {/* Player targets */}
                    {PLAYER_ROLES.includes(role) && (
                        <>
                            <h4>Players</h4>
                            <div className={styles.playerGrid}>
                                {players.map(p => (
                                    <button
                                        key={p.id}
                                        className={`${styles.targetBtn} ${selectedPlayers.includes(p.id) ? styles.selected : ''}`}
                                        onClick={() => handlePlayerClick(p.id)}
                                        disabled={
                                            (role === 'Seer' && selectedCenter.length > 0) ||
                                            (role === 'Witch' && selectedCenter.length === 0)
                                        }
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Center card targets */}
                    {CENTER_ROLES.includes(role) && (
                        <>
                            <h4>Center Cards</h4>
                            <div className={styles.centerGrid}>
                                {centerIndices.map(i => (
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
