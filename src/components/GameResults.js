'use client';

import { useEffect, useState } from 'react';
import styles from './GameResults.module.css';
import { getSocket } from '@/lib/socket';

const ROLE_EMOJI = {
    'Werewolf': '🐺', 'Seer': '🔮', 'Robber': '🦹', 'Troublemaker': '🔀',
    'Villager': '🧑‍🌾', 'Mason': '🧱', 'Minion': '👹', 'Drunk': '🍺',
    'Insomniac': '😳', 'Hunter': '🏹', 'Tanner': '🪵',
    'Alpha Wolf': '🐺', 'Mystic Wolf': '🔮', 'Dream Wolf': '💤',
    'Apprentice Seer': '🔭', 'Paranormal Investigator': '🕵️',
    'Witch': '🧙', 'Sentinel': '🛡️', 'Revealer': '👁️'
};

export default function GameResults({ results, isHost, roomCode }) {
    const { eliminated, winners, winReason, voteBreakdown, roleReveal, centerCards, nightLog, playerResults } = results;
    const [myId, setMyId] = useState(null);

    useEffect(() => {
        const socket = getSocket();
        if (socket) setMyId(socket.id);
    }, []);

    const isWerewolfWin = winners.includes('Werewolf');
    const isVillageWin = winners.includes('Village');
    const isTannerWin = winners.includes('Tanner');

    // Per-player result
    const myResult = playerResults?.find(p => p.id === myId);
    const didWin = myResult?.didWin || false;

    let bannerClass = styles.villageBanner;
    let bannerEmoji = '🏘️';
    if (isWerewolfWin && !isVillageWin) {
        bannerClass = styles.werewolfBanner;
        bannerEmoji = '🐺';
    }
    if (isTannerWin && !isVillageWin) {
        bannerClass = styles.tannerBanner;
        bannerEmoji = '🃏';
    }

    const handlePlayAgain = () => {
        const socket = getSocket();
        socket.emit('restart_game', { roomCode });
    };

    return (
        <div className={styles.container}>
            {/* Personal Win/Loss */}
            {myId && (
                <div className={didWin ? styles.youWin : styles.youLose}>
                    <span className={styles.bigEmoji}>{didWin ? '🎉' : '💀'}</span>
                    <h1>{didWin ? 'You Win!' : 'You Lose!'}</h1>
                </div>
            )}

            <div className={`${styles.banner} ${bannerClass}`}>
                <span className={styles.emoji}>{bannerEmoji}</span>
                <h2>{winners.join(' & ')} Win{winners.length === 1 && !winners[0].endsWith('s') ? 's' : ''}!</h2>
                <p className={styles.reason}>{winReason}</p>
            </div>

            {/* Night Event Log */}
            {nightLog && nightLog.length > 0 && (
                <div className={styles.section}>
                    <h3>🌙 Night Recap</h3>
                    <div className={styles.nightLog}>
                        {nightLog.map((entry, i) => (
                            <div key={i} className={styles.logRow}>
                                <span className={styles.logEmoji}>{ROLE_EMOJI[entry.role] || '❓'}</span>
                                <span className={styles.logRole}>{entry.role}</span>
                                <span className={styles.logArrow}>→</span>
                                <span className={styles.logDesc}>{entry.description}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {eliminated.length > 0 && (
                <div className={styles.section}>
                    <h3>💀 Eliminated</h3>
                    <div className={styles.eliminatedList}>
                        {eliminated.map(e => (
                            <div key={e.id} className={styles.eliminatedCard}>
                                <span className={styles.eliminatedName}>{e.name}</span>
                                <span className={styles.eliminatedRole}>{e.role}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {eliminated.length === 0 && (
                <div className={styles.section}>
                    <h3>No one was eliminated</h3>
                </div>
            )}

            <div className={styles.section}>
                <h3>🗳️ Vote Breakdown</h3>
                <div className={styles.voteTable}>
                    {Object.entries(voteBreakdown).map(([voter, target]) => (
                        <div key={voter} className={styles.voteRow}>
                            <span className={styles.voter}>{voter}</span>
                            <span className={styles.arrow}>→</span>
                            <span className={styles.target}>{target}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.section}>
                <h3>🎭 Role Reveal</h3>
                <div className={styles.roleGrid}>
                    {roleReveal.map(p => (
                        <div key={p.id} className={styles.roleCard}>
                            <span className={styles.playerName}>{p.name}</span>
                            <span className={styles.roleName}>{ROLE_EMOJI[p.originalRole]} {p.originalRole}</span>
                            {p.originalRole !== p.finalRole && (
                                <span className={styles.swapped}>→ {ROLE_EMOJI[p.finalRole]} {p.finalRole}</span>
                            )}
                        </div>
                    ))}
                </div>
                {centerCards && (
                    <div className={styles.centerReveal}>
                        <span className={styles.centerLabel}>Center Cards:</span>
                        {centerCards.map((c, i) => (
                            <span key={i} className={styles.centerCard}>{ROLE_EMOJI[c]} {c}</span>
                        ))}
                    </div>
                )}
            </div>

            {/* Play Again */}
            <div className={styles.playAgain}>
                {isHost ? (
                    <button className={`btn ${styles.playAgainBtn}`} onClick={handlePlayAgain}>
                        🔄 Play Again
                    </button>
                ) : (
                    <p className={styles.waitHost}>Waiting for host to start a new game...</p>
                )}
            </div>
        </div>
    );
}
