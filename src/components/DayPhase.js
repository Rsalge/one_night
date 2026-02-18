'use client';

import { useState, useEffect } from 'react';
import styles from './DayPhase.module.css';
import { getSocket } from '@/lib/socket';

export default function DayPhase({ players, roomCode }) {
    const [selectedVote, setSelectedVote] = useState(null);
    const [hasVoted, setHasVoted] = useState(false);
    const [votedCount, setVotedCount] = useState(0);
    const [totalPlayers, setTotalPlayers] = useState(players?.length || 0);
    const [myId, setMyId] = useState(null);

    useEffect(() => {
        const socket = getSocket();
        if (socket) setMyId(socket.id);

        socket.on('vote_update', ({ votedCount, totalPlayers }) => {
            setVotedCount(votedCount);
            setTotalPlayers(totalPlayers);
        });

        return () => {
            socket.off('vote_update');
        };
    }, []);

    const handleVote = () => {
        if (!selectedVote || hasVoted) return;
        const socket = getSocket();
        socket.emit('cast_vote', { roomCode, voteTarget: selectedVote });
        setHasVoted(true);
    };

    const otherPlayers = players?.filter(p => p.id !== myId) || [];

    return (
        <div className={styles.container}>
            <h2 className="title">☀️ Day Phase</h2>

            <div className={styles.discussion}>
                <p>Discuss with your group — who is the Werewolf?</p>
                <p className={styles.subtext}>When ready, cast your vote below.</p>
            </div>

            {!hasVoted ? (
                <div className={styles.voteArea}>
                    <h3>Vote to Eliminate</h3>

                    <div className={styles.voteGrid}>
                        {otherPlayers.map(p => (
                            <button
                                key={p.id}
                                className={`${styles.voteBtn} ${selectedVote === p.id ? styles.selected : ''}`}
                                onClick={() => setSelectedVote(p.id)}
                            >
                                <span className={styles.avatarSmall}>{p.name[0].toUpperCase()}</span>
                                <span>{p.name}</span>
                            </button>
                        ))}

                        {/* Vote for the middle */}
                        <button
                            className={`${styles.voteBtn} ${styles.middleBtn} ${selectedVote === 'middle' ? styles.selected : ''}`}
                            onClick={() => setSelectedVote('middle')}
                        >
                            <span className={styles.middleIcon}>⬤</span>
                            <span>The Middle</span>
                        </button>
                    </div>

                    <button
                        className={`btn ${styles.confirmVote}`}
                        onClick={handleVote}
                        disabled={!selectedVote}
                    >
                        Confirm Vote
                    </button>
                </div>
            ) : (
                <div className={styles.waitingVote}>
                    <div className={styles.spinner}></div>
                    <p>Vote cast! Waiting for others...</p>
                    <p className={styles.voteProgress}>{votedCount} / {totalPlayers} voted</p>
                </div>
            )}
        </div>
    );
}
