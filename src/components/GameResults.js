'use client';

import styles from './GameResults.module.css';

export default function GameResults({ results }) {
    const { eliminated, winners, winReason, voteBreakdown, roleReveal, centerCards } = results;

    const isWerewolfWin = winners.includes('Werewolf');
    const isVillageWin = winners.includes('Village');
    const isTannerWin = winners.includes('Tanner');

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

    return (
        <div className={styles.container}>
            <div className={`${styles.banner} ${bannerClass}`}>
                <span className={styles.emoji}>{bannerEmoji}</span>
                <h2>{winners.join(' & ')} Win{winners.length === 1 && !winners[0].endsWith('s') ? 's' : ''}!</h2>
                <p className={styles.reason}>{winReason}</p>
            </div>

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
                            <span className={styles.roleName}>{p.originalRole}</span>
                            {p.originalRole !== p.finalRole && (
                                <span className={styles.swapped}>→ {p.finalRole}</span>
                            )}
                        </div>
                    ))}
                </div>
                {centerCards && (
                    <div className={styles.centerReveal}>
                        <span className={styles.centerLabel}>Center Cards:</span>
                        {centerCards.map((c, i) => (
                            <span key={i} className={styles.centerCard}>{c}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
