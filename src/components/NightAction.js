'use client';

import { useState } from 'react';
import styles from './NightAction.module.css';
import { getSocket } from '@/lib/socket';

export default function NightAction({ role, players, roomCode, onActionComplete }) {
    const [selectedPlayers, setSelectedPlayers] = useState([]);
    const [selectedCenter, setSelectedCenter] = useState([]);
    const [resultMessage, setResultMessage] = useState('');
    const [actionTaken, setActionTaken] = useState(false);

    const socket = getSocket();

    const handlePlayerClick = (playerId) => {
        if (actionTaken) return;

        // Role specific max selections
        let max = 1;
        if (role === 'Troublemaker') max = 2;
        if (role === 'Seer' && selectedCenter.length > 0) return; // Seer can't mix

        // Toggle logic
        if (selectedPlayers.includes(playerId)) {
            setSelectedPlayers(selectedPlayers.filter(id => id !== playerId));
        } else {
            if (selectedPlayers.length < max) {
                setSelectedPlayers([...selectedPlayers, playerId]);
            }
        }
    };

    const handleCenterClick = (idx) => {
        if (actionTaken) return;
        if (role !== 'Seer' && role !== 'Drunk' && role !== 'Werewolf') return;

        let max = 1;
        if (role === 'Seer') max = 2;
        if (selectedPlayers.length > 0) return; // Can't mix

        if (selectedCenter.includes(idx)) {
            setSelectedCenter(selectedCenter.filter(i => i !== idx));
        } else {
            if (selectedCenter.length < max) {
                setSelectedCenter([...selectedCenter, idx]);
            }
        }
    };

    const submitAction = () => {
        let targetIds = [];
        if (selectedPlayers.length > 0) targetIds = selectedPlayers;
        else if (selectedCenter.length > 0) targetIds = selectedCenter;

        if (targetIds.length === 0) return;

        // Validate count
        if (role === 'Seer' && targetIds.length === 0) return; // Must pick something
        if (role === 'Troublemaker' && selectedPlayers.length !== 2) return;
        if (role === 'Robber' && selectedPlayers.length !== 1) return;
        if (role === 'Drunk' && selectedCenter.length !== 1) return;

        socket.emit('night_action', { roomCode, action: 'act', targetIds });
        setActionTaken(true);

        // Listen for result
        socket.once('action_result', (res) => {
            if (!res) {
                setResultMessage('Action failed or invalid.');
                return;
            }

            let msg = '';
            if (res.type === 'view') msg = `You saw: ${res.role}`;
            if (res.type === 'view_center') msg = `Center cards: ${res.cards.join(', ')}`;
            if (res.type === 'swap_view') msg = `You are now the ${res.newRole}`;
            if (res.type === 'swap') msg = res.message;
            if (res.type === 'swap_center') msg = res.message;
            if (res.type === 'view_center_single') msg = `Center card: ${res.card}`;

            setResultMessage(msg);
            if (onActionComplete) onActionComplete();
        });
    };

    const handleDone = () => {
        socket.emit('end_night', { roomCode });
        setResultMessage("Waiting for other players...");
    };

    return (
        <div className={styles.container}>
            {!actionTaken && (
                <div className={styles.instructions}>
                    <h3>Role Action: {role}</h3>
                    <p className={styles.hint}>{getHint(role)}</p>
                </div>
            )}

            {resultMessage && <div className={styles.result}>{resultMessage}</div>}

            {!actionTaken && !resultMessage && (
                <div className={styles.targets}>
                    <h4>Select Players</h4>
                    <div className={styles.playerGrid}>
                        {players.map(p => (
                            <button
                                key={p.id}
                                className={`${styles.targetBtn} ${selectedPlayers.includes(p.id) ? styles.selected : ''}`}
                                onClick={() => handlePlayerClick(p.id)}
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>

                    {(role === 'Seer' || role === 'Drunk' || role === 'Werewolf') && (
                        <>
                            <h4>Center Cards</h4>
                            <div className={styles.centerGrid}>
                                {[0, 1, 2].map(i => (
                                    <button
                                        key={i}
                                        className={`${styles.targetBtn} ${selectedCenter.includes(i) ? styles.selected : ''}`}
                                        onClick={() => handleCenterClick(i)}
                                    >
                                        Card {i + 1}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    <button className="btn" onClick={submitAction}>Confirm Action</button>
                </div>
            )}

            {(actionTaken || role === 'Villager' || role === 'Mason' || role === 'Hunter' || role === 'Tanner' || role === 'Insomniac' || role === 'Minion') && (
                <button className={`btn ${styles.doneBtn}`} onClick={handleDone} disabled={resultMessage === "Waiting for other players..."}>
                    {resultMessage === "Waiting for other players..." ? "Waiting..." : "End Night Phase"}
                </button>
            )}
        </div>
    );
}

function getHint(role) {
    const hints = {
        'Seer': 'Select 1 player OR 2 center cards to view.',
        'Robber': 'Select 1 player to swap with.',
        'Troublemaker': 'Select 2 players to swap.',
        'Drunk': 'Select 1 center card to swap with.',
        'Werewolf': 'View your pack. If alone, view 1 center card.',
        'Villager': 'No action. Sleep.',
        'Mason': 'Wake up and find the other Mason.',
        'Minion': 'Wake up and find the Werewolves.',
        'Insomniac': 'Wake up at the end to check your role.',
        'Hunter': 'No night action.',
        'Tanner': 'No night action.'
    };
    return hints[role] || 'Perform your action.';
}
