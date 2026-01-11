'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { GameState } from '@/game/GameState';
import { onGameUpdate, onError, startGame, sendAction, requestNewHand, rejoinRoom } from '@/lib/socket';
import Table from '@/components/Table/Table';
import Controls from '@/components/Controls/Controls';

interface RoomPageProps {
    params: Promise<{ code: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
    const { code } = use(params);
    const router = useRouter();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const storedPlayerName = sessionStorage.getItem('playerName');

        if (!storedPlayerName) {
            router.push('/');
            return;
        }

        // Try to rejoin the room with stored credentials
        const attemptRejoin = async () => {
            try {
                const result = await rejoinRoom(code, storedPlayerName);
                setPlayerId(result.playerId);
                setGameState(result.state);
                sessionStorage.setItem('playerId', result.playerId);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to connect');
            }
        };

        attemptRejoin();

        const unsubUpdate = onGameUpdate(({ state }) => {
            setGameState(state);
        });

        const unsubError = onError(({ message }) => {
            setError(message);
            setTimeout(() => setError(''), 3000);
        });

        return () => {
            unsubUpdate();
            unsubError();
        };
    }, [code, router]);

    if (!gameState || !playerId) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-gold animate-pulse">Loading game...</h2>
                    {error && <p className="text-ruby mt-md">{error}</p>}
                </div>
            </div>
        );
    }

    const handleStartGame = () => {
        startGame();
    };

    const handleNewHand = () => {
        requestNewHand();
    };

    const me = gameState.players.find(p => p.id === playerId);
    const isPlaying = gameState.phase !== 'waiting' && gameState.phase !== 'showdown' && gameState.phase !== 'ended';

    return (
        <div>
            {error && (
                <div style={{
                    position: 'fixed',
                    top: '1rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    zIndex: 1000
                }}>
                    {error}
                </div>
            )}

            <Table
                gameState={gameState}
                playerId={playerId}
                onStartGame={handleStartGame}
                onNewHand={handleNewHand}
            />

            {isPlaying && me && !me.folded && !me.allIn && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '0 1rem' }}>
                    <Controls
                        gameState={gameState}
                        playerId={playerId}
                        onAction={sendAction}
                    />
                </div>
            )}
        </div>
    );
}
