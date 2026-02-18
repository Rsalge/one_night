'use client';

import { useState } from 'react';
import styles from './Login.module.css';

export default function Login({ onCreate, onJoin }) {
    const [name, setName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [mode, setMode] = useState('create'); // 'create' or 'join'

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        if (mode === 'create') {
            onCreate(name.trim());
        } else {
            if (!roomCode.trim()) return;
            onJoin(name.trim(), roomCode.trim());
        }
    };

    return (
        <div className={styles.container}>
            <h1 className="title">One Night Werewolf</h1>

            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${mode === 'create' ? styles.activeTab : ''}`}
                    onClick={() => setMode('create')}
                >
                    Create Game
                </button>
                <button
                    className={`${styles.tab} ${mode === 'join' ? styles.activeTab : ''}`}
                    onClick={() => setMode('join')}
                >
                    Join Game
                </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
                <input
                    type="text"
                    className={styles.input}
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={15}
                />

                {mode === 'join' && (
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="Room Code (e.g. ABCD)"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        maxLength={4}
                    />
                )}

                <button type="submit" className="btn" disabled={!name.trim() || (mode === 'join' && !roomCode.trim())}>
                    {mode === 'create' ? 'Create Room' : 'Join Room'}
                </button>
            </form>
        </div>
    );
}
