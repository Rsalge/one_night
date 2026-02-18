'use client';

import { useState, useEffect } from 'react';
import RoleCard from './RoleCard';
import NightAction from './NightAction';
import styles from './GameTable.module.css';
import { getSocket } from '@/lib/socket';

export default function GameTable({ role, players, centerCardsCount, roomCode }) {
    const [myId, setMyId] = useState(null);
    const [nightTurn, setNightTurn] = useState(null); // { activeRole, activePlayerIds, flavor, isInteractive }
    const [actionResult, setActionResult] = useState(null);

    useEffect(() => {
        const socket = getSocket();
        if (socket) setMyId(socket.id);

        socket.on('night_turn', (data) => {
            setNightTurn(data);
            setActionResult(null); // Reset result for new turn
        });

        socket.on('action_result', (result) => {
            if (result) {
                let msg = '';
                if (result.type === 'view') msg = `${result.name} is the ${result.role}`;
                if (result.type === 'view_center') msg = `Center cards: ${result.cards.join(', ')}`;
                if (result.type === 'swap_view') msg = `You swapped with ${result.name}. You are now the ${result.newRole}`;
                if (result.type === 'swap') msg = result.message;
                if (result.type === 'swap_center') msg = result.message;
                if (result.type === 'info') msg = result.message;
                setActionResult(msg);
            }
        });

        return () => {
            socket.off('night_turn');
            socket.off('action_result');
        };
    }, []);

    const otherPlayers = players.filter(p => p.id !== myId);
    const isMyTurn = nightTurn && nightTurn.activePlayerIds?.includes(myId);
    const isInteractive = nightTurn?.isInteractive;

    return (
        <div className={styles.container}>
            <h2 className="title">🌙 Night Phase</h2>

            <div className={styles.area}>
                <RoleCard role={role} />
            </div>

            {/* Flavor text banner — everyone sees this */}
            {nightTurn && (
                <div className={styles.narrator}>
                    <p className={styles.flavorText}>{nightTurn.flavor}</p>
                </div>
            )}

            {/* Waiting state before first turn arrives */}
            {!nightTurn && (
                <div className={styles.waiting}>
                    <p>Look at your card. The night will begin shortly...</p>
                </div>
            )}

            {/* Action result display */}
            {actionResult && (
                <div className={styles.actionResult}>
                    {actionResult}
                </div>
            )}

            {/* Interactive action UI — only for the active role player */}
            {isMyTurn && isInteractive && !actionResult && (
                <NightAction
                    role={nightTurn.activeRole}
                    players={otherPlayers}
                    roomCode={roomCode}
                />
            )}

            {/* Waiting message for non-active players */}
            {nightTurn && !isMyTurn && !actionResult && (
                <div className={styles.waiting}>
                    <div className={styles.spinner}></div>
                    <p>Close your eyes...</p>
                </div>
            )}

            {/* Player who just acted sees their result briefly */}
            {isMyTurn && actionResult && (
                <div className={styles.waiting}>
                    <p>Go back to sleep...</p>
                </div>
            )}

            <div className={styles.info}>
                <p>Players: {players.length} · Center Cards: {centerCardsCount}</p>
            </div>
        </div>
    );
}
