'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom, joinRoom } from '@/lib/socket';
import styles from './page.module.css';

export default function LobbyPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await createRoom(playerName.trim());
      sessionStorage.setItem('playerId', result.playerId);
      sessionStorage.setItem('playerName', playerName.trim());
      router.push(`/room/${result.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await joinRoom(roomCode.trim().toUpperCase(), playerName.trim());
      sessionStorage.setItem('playerId', result.playerId);
      sessionStorage.setItem('playerName', playerName.trim());
      router.push(`/room/${result.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles['lobby-container']}>
      <div className={styles.logo}>
        <h1>♠️ Aphelion Poker</h1>
        <p className={styles.tagline}>Play with friends in real-time</p>
      </div>

      <div className={`${styles['form-container']} glass-panel animate-slide-up`}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'create' ? styles.active : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create Room
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'join' ? styles.active : ''}`}
            onClick={() => setActiveTab('join')}
          >
            Join Room
          </button>
        </div>

        {error && <div className={styles['error-message']}>{error}</div>}

        <form
          className={styles.form}
          onSubmit={activeTab === 'create' ? handleCreateRoom : handleJoinRoom}
        >
          <div className={styles['form-group']}>
            <label className={styles['form-label']}>Your Name</label>
            <input
              type="text"
              className="input"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>

          {activeTab === 'join' && (
            <div className={styles['form-group']}>
              <label className={styles['form-label']}>Room Code</label>
              <input
                type="text"
                className="input"
                placeholder="Enter 6-character code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{ textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'monospace' }}
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full mt-md"
            disabled={loading}
          >
            {loading ? 'Please wait...' : activeTab === 'create' ? 'Create Room' : 'Join Room'}
          </button>
        </form>
      </div>

      <div className={styles.features}>
        <div className={styles.feature}>
          <span className={styles['feature-icon']}>🎰</span>
          <span className={styles['feature-text']}>Texas Hold&apos;em</span>
        </div>
        <div className={styles.feature}>
          <span className={styles['feature-icon']}>👥</span>
          <span className={styles['feature-text']}>2-8 Players</span>
        </div>
        <div className={styles.feature}>
          <span className={styles['feature-icon']}>⚡</span>
          <span className={styles['feature-text']}>Real-time Play</span>
        </div>
      </div>
    </div>
  );
}
