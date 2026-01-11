'use client';

import React, { useState } from 'react';
import { GameState, PlayerAction } from '@/game/GameState';
import styles from './Controls.module.css';

interface ControlsProps {
    gameState: GameState;
    playerId: string;
    onAction: (action: PlayerAction) => void;
}

export default function Controls({ gameState, playerId, onAction }: ControlsProps) {
    const me = gameState.players.find(p => p.id === playerId);
    const [raiseAmount, setRaiseAmount] = useState(gameState.minRaise);

    if (!me || me.folded || me.allIn) {
        return (
            <div className={styles.controls}>
                <p className={styles['status-text']}>
                    {me?.folded ? 'You folded this hand' : me?.allIn ? 'You are all in!' : 'Waiting...'}
                </p>
            </div>
        );
    }

    if (!me.isCurrentTurn) {
        return (
            <div className={styles.controls}>
                <p className={styles['status-text']}>
                    Waiting for {gameState.players[gameState.currentPlayerIndex]?.name || 'other player'}...
                </p>
            </div>
        );
    }

    const toCall = gameState.currentBet - me.bet;
    const canCheck = toCall === 0;
    const canCall = toCall > 0 && me.chips >= toCall;
    const canRaise = me.chips > toCall + gameState.minRaise;
    const maxRaise = me.chips - toCall;

    // Reset raise amount when turn starts
    if (raiseAmount < gameState.minRaise || raiseAmount > maxRaise) {
        const defaultRaise = Math.max(gameState.minRaise, Math.min(gameState.minRaise * 2, maxRaise));
        setRaiseAmount(defaultRaise);
    }

    const handleRaise = () => {
        onAction({ type: 'raise', amount: raiseAmount });
    };

    const handleAllIn = () => {
        onAction({ type: 'all_in' });
    };

    const setQuickBet = (multiplier: number) => {
        const amount = Math.min(gameState.pot * multiplier, maxRaise);
        setRaiseAmount(Math.max(gameState.minRaise, Math.floor(amount)));
    };

    return (
        <div className={styles.controls}>
            <p className={styles['your-turn']}>Your Turn!</p>

            <div className={styles['action-row']}>
                <button
                    className={`btn btn-danger ${styles['action-btn']}`}
                    onClick={() => onAction({ type: 'fold' })}
                >
                    Fold
                </button>

                {canCheck && (
                    <button
                        className={`btn btn-secondary ${styles['action-btn']}`}
                        onClick={() => onAction({ type: 'check' })}
                    >
                        Check
                    </button>
                )}

                {canCall && (
                    <button
                        className={`btn btn-success ${styles['action-btn']}`}
                        onClick={() => onAction({ type: 'call' })}
                    >
                        Call {toCall}
                    </button>
                )}

                <button
                    className={`btn btn-primary ${styles['action-btn']}`}
                    onClick={handleAllIn}
                >
                    All In ({me.chips})
                </button>
            </div>

            {canRaise && (
                <div className={styles['raise-controls']}>
                    <input
                        type="number"
                        className={`input ${styles['raise-input']}`}
                        value={raiseAmount}
                        min={gameState.minRaise}
                        max={maxRaise}
                        onChange={(e) => setRaiseAmount(Math.max(gameState.minRaise, Math.min(maxRaise, parseInt(e.target.value) || 0)))}
                    />

                    <input
                        type="range"
                        className={styles['raise-slider']}
                        value={raiseAmount}
                        min={gameState.minRaise}
                        max={maxRaise}
                        onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
                    />

                    <button
                        className="btn btn-primary"
                        onClick={handleRaise}
                    >
                        Raise to {toCall + raiseAmount}
                    </button>

                    <div className={styles['quick-bets']}>
                        <button className={styles['quick-bet-btn']} onClick={() => setQuickBet(0.5)}>½ Pot</button>
                        <button className={styles['quick-bet-btn']} onClick={() => setQuickBet(1)}>Pot</button>
                        <button className={styles['quick-bet-btn']} onClick={() => setQuickBet(2)}>2x Pot</button>
                    </div>
                </div>
            )}
        </div>
    );
}
