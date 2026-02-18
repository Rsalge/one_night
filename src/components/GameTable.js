'use client';

import { useState, useEffect } from 'react';
import RoleCard from './RoleCard';
import NightAction from './NightAction';
import styles from './GameTable.module.css';
import { getSocket } from '@/lib/socket';

export default function GameTable({ role, players, centerCardsCount, roomCode }) {
    // Filter out self from tappable players for logic (though Troublemaker can pick anyone? usually other players)
    // Logic says "swap with another player" or "swap two other players"
    // So we pass all OTHER players.
    // wait, we need to know OUR id to filter. The players list from server includes us?
    // Server sends: game.players.map(pl => {id, name})
    // We don't know our own ID easily unless we store it or check socket.
    // Let's assume the players list includes us and we filter in UI or let user pick (but usually self is invalid for these actions)

    // We need socket id to identify self.
    const [myId, setMyId] = useState(null);

    useEffect(() => {
        const socket = getSocket();
        if (socket) setMyId(socket.id);
    }, []);

    const otherPlayers = players.filter(p => p.id !== myId);

    return (
        <div className={styles.container}>
            <h2 className="title">Night Phase</h2>
            <div className={styles.area}>
                <RoleCard role={role} />
            </div>

            <NightAction
                role={role}
                players={otherPlayers}
                roomCode={roomCode}
            />

            <div className={styles.info}>
                <p>Other Players: {otherPlayers.length}</p>
                <p>Center Cards: {centerCardsCount}</p>
            </div>
        </div>
    );
}
