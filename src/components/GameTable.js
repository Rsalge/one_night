'use client';

import { useState, useEffect } from 'react';
import RoleCard from './RoleCard';
import NightAction from './NightAction';
import styles from './GameTable.module.css';
import { getSocket } from '@/lib/socket';

export default function GameTable({ role, players, centerCardsCount, roomCode }) {
    const [myId, setMyId] = useState(null);
    const [nightTurn, setNightTurn] = useState(null);
    const [actionResult, setActionResult] = useState(null);
    const [acknowledged, setAcknowledged] = useState(false);

    useEffect(() => {
        const socket = getSocket();
        if (socket) setMyId(socket.id);

        socket.on('night_turn', (data) => {
            setNightTurn(data);
            setActionResult(null);
            setAcknowledged(false);
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
                if (result.type === 'pi_result') {
                    const lines = result.viewed.map(v => `${v.name}: ${v.role}`).join(', ');
                    msg = result.becameRole
                        ? `Investigated: ${lines}. You are now ${result.becameRole}!`
                        : `Investigated: ${lines}`;
                }
                if (result.type === 'witch_result') {
                    msg = `Center card: ${result.viewedCard}.`;
                    if (result.swapped) msg += ` Swapped with ${result.targetName}.`;
                    else if (result.shielded) msg += ' Target was shielded \u2014 no swap.';
                    else msg += ' You chose not to swap.';
                }
                if (result.type === 'reveal') {
                    msg = result.staysRevealed
                        ? `${result.name}'s card is ${result.role} \u2014 stays face-up!`
                        : `${result.name}'s card is ${result.role} (flipped back).`;
                }
                setActionResult(msg);
                setAcknowledged(false);
            }
        });

        return () => {
            socket.off('night_turn');
            socket.off('action_result');
        };
    }, []);

    const handleAcknowledge = () => {
        const socket = getSocket();
        socket.emit('acknowledge_night', { roomCode });
        setAcknowledged(true);
    };

    const otherPlayers = players.filter(p => p.id !== myId);
    const isMyTurn = nightTurn && nightTurn.activePlayerIds?.includes(myId);
    const isInteractive = nightTurn?.isInteractive;

    return (
        <div className={styles.container}>
            <h2 className="title">\uD83C\uDF19 Night Phase</h2>

            <div className={styles.area}>
                <RoleCard role={role} />
            </div>

            {/* Flavor text banner \u2014 everyone sees this */}
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

            {/* Action result with acknowledge button */}
            {actionResult && !acknowledged && (
                <div className={styles.actionResult}>
                    <p>{actionResult}</p>
                    <button className={`btn ${styles.ackBtn}`} onClick={handleAcknowledge}>
                        Got it \uD83D\uDC4D
                    </button>
                </div>
            )}

            {/* After acknowledging, show go-back-to-sleep */}
            {actionResult && acknowledged && (
                <div className={styles.waiting}>
                    <div className={styles.spinner}></div>
                    <p>Go back to sleep...</p>
                </div>
            )}

            {/* Interactive action UI \u2014 only for the active role player */}
            {isMyTurn && isInteractive && !actionResult && (
                <NightAction
                    role={nightTurn.activeRole}
                    players={otherPlayers}
                    roomCode={roomCode}
                    centerCardsCount={centerCardsCount}
                />
            )}

            {/* Waiting message for non-active players */}
            {nightTurn && !isMyTurn && !actionResult && (
                <div className={styles.waiting}>
                    <div className={styles.spinner}></div>
                    <p>Close your eyes...</p>
                </div>
            )}

            <div className={styles.info}>
                <p>Players: {players.length} \u00B7 Center Cards: {centerCardsCount}</p>
            </div>
        </div>
    );
}
