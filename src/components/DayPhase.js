'use client';

import styles from './GameTable.module.css';

export default function DayPhase() {
    return (
        <div className={styles.container}>
            <h2 className="title">Day Phase</h2>
            <p style={{ textAlign: 'center' }}>Time to discuss! Who is the Werewolf?</p>
            <div className={styles.info}>
                <p>Timer: 5:00</p>
                <button className="btn">Vote Now (Coming Soon)</button>
            </div>
        </div>
    );
}
