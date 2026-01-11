'use client';

import React from 'react';
import { GameState } from '@/game/GameState';
import Card from '@/components/Card/Card';
import PlayerSeat from '@/components/PlayerSeat/PlayerSeat';
import styles from './Table.module.css';

interface TableProps {
    gameState: GameState;
    playerId: string;
    onStartGame: () => void;
    onNewHand: () => void;
}

export default function Table({ gameState, playerId, onStartGame, onNewHand }: TableProps) {
    const isHost = gameState.players[0]?.id === playerId;
    const hasGameStarted = gameState.phase !== 'waiting';
    const isGameOver = gameState.phase === 'showdown' || gameState.phase === 'ended';

    const copyRoomCode = () => {
        navigator.clipboard.writeText(gameState.roomCode);
    };

    return (
        <div className={styles['table-container']}>
            <div className={styles.header}>
                <div className={styles['room-code']}>
                    <span className={styles['room-code-label']}>Room Code:</span>
                    <span
                        className={styles['room-code-value']}
                        onClick={copyRoomCode}
                        title="Click to copy"
                    >
                        {gameState.roomCode}
                    </span>
                </div>

                {!hasGameStarted && isHost && gameState.players.length >= 2 && (
                    <button className="btn btn-primary" onClick={onStartGame}>
                        Start Game
                    </button>
                )}
            </div>

            <div className={styles['poker-table']}>
                <span className={styles['phase-indicator']}>
                    {gameState.phase === 'waiting' ? 'Waiting for players...' : gameState.phase}
                </span>

                <div className={styles['community-cards']}>
                    {gameState.communityCards.map((card, i) => (
                        <Card key={i} card={card} dealing={true} delay={i * 150} />
                    ))}
                </div>

                {gameState.pot > 0 && (
                    <div className={styles['pot-display']}>
                        <span className={styles['pot-icon']}>🏆</span>
                        <span>Pot: {gameState.pot.toLocaleString()}</span>
                    </div>
                )}

                <div className={styles['players-container']}>
                    {gameState.players.map((player) => (
                        <div key={player.id} className={styles['player-position']}>
                            <PlayerSeat
                                player={player}
                                isMe={player.id === playerId}
                                hasCards={hasGameStarted && !player.folded}
                                isWinner={gameState.winners.some(w => w.playerId === player.id)}
                            />
                        </div>
                    ))}
                </div>

                {isGameOver && gameState.winners.length > 0 && (
                    <div className={styles['winner-announcement']}>
                        <h2>🎉 Winner!</h2>
                        {gameState.winners.map(w => {
                            const winner = gameState.players.find(p => p.id === w.playerId);
                            return (
                                <div key={w.playerId}>
                                    <p><strong>{winner?.name}</strong> wins {w.amount} chips</p>
                                    <p className={styles['hand-description']}>{w.handDescription}</p>
                                </div>
                            );
                        })}
                        {isHost && (
                            <button className="btn btn-primary mt-lg" onClick={onNewHand}>
                                Deal Next Hand
                            </button>
                        )}
                    </div>
                )}
            </div>

            {!hasGameStarted && (
                <div className={styles['waiting-message']}>
                    <p>
                        <span className={styles['player-count']}>{gameState.players.length}</span> player(s) in room
                    </p>
                    <p className="mt-sm text-muted">
                        Share the room code with friends to join!
                    </p>
                </div>
            )}
        </div>
    );
}
