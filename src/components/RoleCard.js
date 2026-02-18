'use client';

import { useState } from 'react';
import styles from './RoleCard.module.css';

export default function RoleCard({ role, onClick }) {
    const [isRevealed, setIsRevealed] = useState(false);

    const handleClick = () => {
        setIsRevealed(!isRevealed);
        if (onClick) onClick();
    };

    return (
        <div className={`${styles.card} ${isRevealed ? styles.revealed : ''}`} onClick={handleClick}>
            <div className={styles.cardInner}>
                <div className={styles.cardFront}>
                    <div className={styles.roleIcon}>?</div>
                    <p>Tap to reveal</p>
                </div>
                <div className={styles.cardBack}>
                    <h3 className={styles.roleName}>{role}</h3>
                    <div className={styles.artPlaceholder}>
                        {/* Placeholder for AI Art */}
                        <div className={styles.artGen}>AI Art</div>
                    </div>
                    <p className={styles.description}>
                        {getRoleDescription(role)}
                    </p>
                </div>
            </div>
        </div>
    );
}

function getRoleDescription(role) {
    const descriptions = {
        'Werewolf': 'Wake up and find the other Werewolf.',
        'Seer': 'Wake up and look at another player\'s card or two center cards.',
        'Robber': 'Wake up and swap your card with another player\'s card.',
        'Troublemaker': 'Wake up and swap two other players\' cards.',
        'Villager': 'Sleep soundly via the night.',
        // Add others...
    };
    return descriptions[role] || 'Perform your night action.';
}
