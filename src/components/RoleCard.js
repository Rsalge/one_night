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
        'Werewolf': 'Wake up and find the other Werewolf. Lone wolf may peek at a center card.',
        'Seer': 'Wake up and look at another player\'s card or two center cards.',
        'Robber': 'Wake up and swap your card with another player\'s card.',
        'Troublemaker': 'Wake up and swap two other players\' cards.',
        'Villager': 'Sleep soundly through the night.',
        'Mason': 'Wake up and find the other Mason.',
        'Minion': 'Wake up and see who the Werewolves are.',
        'Drunk': 'Wake up and blindly swap your card with a center card.',
        'Insomniac': 'Wake up last and check your card.',
        'Hunter': 'If you are eliminated, the player you voted for also dies.',
        'Tanner': 'You win if you get eliminated.',
        'Alpha Wolf': 'Wake with wolves, then swap the center Werewolf card onto a non-wolf player.',
        'Mystic Wolf': 'Wake with wolves, then peek at one player\'s card.',
        'Dream Wolf': 'You are a Werewolf, but you don\'t wake up with the other wolves.',
        'Apprentice Seer': 'Wake up and peek at one center card.',
        'Paranormal Investigator': 'Investigate up to 2 players. Careful — seeing a wolf or Tanner changes you!',
        'Witch': 'View a center card, then optionally swap it with any player\'s card.',
        'Sentinel': 'Place a shield on one player\'s card, protecting it from being viewed or swapped.',
        'Revealer': 'Flip another player\'s card. If it\'s a wolf or Tanner, it stays face-up!'
    };
    return descriptions[role] || 'Perform your night action.';
}
