import { Card, RANK_VALUES } from './Card';

export type HandRank =
    | 'royal_flush'
    | 'straight_flush'
    | 'four_of_a_kind'
    | 'full_house'
    | 'flush'
    | 'straight'
    | 'three_of_a_kind'
    | 'two_pair'
    | 'pair'
    | 'high_card';

export interface HandResult {
    rank: HandRank;
    rankValue: number;
    highCards: number[];
    description: string;
}

function getCombinations<T>(arr: T[], size: number): T[][] {
    if (size === 0) return [[]];
    if (arr.length === 0) return [];
    const [first, ...rest] = arr;
    const withFirst = getCombinations(rest, size - 1).map(combo => [first, ...combo]);
    const withoutFirst = getCombinations(rest, size);
    return [...withFirst, ...withoutFirst];
}

function evaluateFiveCards(cards: Card[]): HandResult {
    const values = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);

    const isFlush = suits.every(s => s === suits[0]);

    // Check for straight (including A-2-3-4-5)
    const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
    let isStraight = false;
    let straightHigh = 0;

    if (uniqueValues.length >= 5) {
        for (let i = 0; i <= uniqueValues.length - 5; i++) {
            if (uniqueValues[i] - uniqueValues[i + 4] === 4) {
                isStraight = true;
                straightHigh = uniqueValues[i];
                break;
            }
        }
        // Check wheel (A-2-3-4-5)
        if (!isStraight && uniqueValues.includes(14) && uniqueValues.includes(2) &&
            uniqueValues.includes(3) && uniqueValues.includes(4) && uniqueValues.includes(5)) {
            isStraight = true;
            straightHigh = 5;
        }
    }

    // Count ranks
    const rankCounts: Record<number, number> = {};
    values.forEach(v => { rankCounts[v] = (rankCounts[v] || 0) + 1; });
    const counts = Object.entries(rankCounts)
        .map(([val, count]) => ({ value: parseInt(val), count }))
        .sort((a, b) => b.count - a.count || b.value - a.value);

    // Determine hand
    if (isFlush && isStraight && straightHigh === 14) {
        return { rank: 'royal_flush', rankValue: 10, highCards: [14], description: 'Royal Flush' };
    }
    if (isFlush && isStraight) {
        return { rank: 'straight_flush', rankValue: 9, highCards: [straightHigh], description: `Straight Flush, ${straightHigh} high` };
    }
    if (counts[0].count === 4) {
        return { rank: 'four_of_a_kind', rankValue: 8, highCards: [counts[0].value, counts[1].value], description: `Four of a Kind, ${rankName(counts[0].value)}s` };
    }
    if (counts[0].count === 3 && counts[1]?.count === 2) {
        return { rank: 'full_house', rankValue: 7, highCards: [counts[0].value, counts[1].value], description: `Full House, ${rankName(counts[0].value)}s full of ${rankName(counts[1].value)}s` };
    }
    if (isFlush) {
        return { rank: 'flush', rankValue: 6, highCards: values.slice(0, 5), description: `Flush, ${rankName(values[0])} high` };
    }
    if (isStraight) {
        return { rank: 'straight', rankValue: 5, highCards: [straightHigh], description: `Straight, ${rankName(straightHigh)} high` };
    }
    if (counts[0].count === 3) {
        return { rank: 'three_of_a_kind', rankValue: 4, highCards: [counts[0].value, ...values.filter(v => v !== counts[0].value).slice(0, 2)], description: `Three of a Kind, ${rankName(counts[0].value)}s` };
    }
    if (counts[0].count === 2 && counts[1]?.count === 2) {
        const kicker = values.find(v => v !== counts[0].value && v !== counts[1].value) || 0;
        return { rank: 'two_pair', rankValue: 3, highCards: [counts[0].value, counts[1].value, kicker], description: `Two Pair, ${rankName(counts[0].value)}s and ${rankName(counts[1].value)}s` };
    }
    if (counts[0].count === 2) {
        return { rank: 'pair', rankValue: 2, highCards: [counts[0].value, ...values.filter(v => v !== counts[0].value).slice(0, 3)], description: `Pair of ${rankName(counts[0].value)}s` };
    }
    return { rank: 'high_card', rankValue: 1, highCards: values.slice(0, 5), description: `High Card, ${rankName(values[0])}` };
}

function rankName(value: number): string {
    if (value === 14) return 'Ace';
    if (value === 13) return 'King';
    if (value === 12) return 'Queen';
    if (value === 11) return 'Jack';
    return value.toString();
}

export function evaluateHand(holeCards: Card[], communityCards: Card[]): HandResult {
    const allCards = [...holeCards, ...communityCards];
    if (allCards.length < 5) {
        return { rank: 'high_card', rankValue: 0, highCards: [], description: 'Not enough cards' };
    }

    const combinations = getCombinations(allCards, 5);
    let bestHand: HandResult | null = null;

    for (const combo of combinations) {
        const result = evaluateFiveCards(combo);
        if (!bestHand || compareHands(result, bestHand) > 0) {
            bestHand = result;
        }
    }

    return bestHand!;
}

export function compareHands(a: HandResult, b: HandResult): number {
    if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
    for (let i = 0; i < Math.max(a.highCards.length, b.highCards.length); i++) {
        const diff = (a.highCards[i] || 0) - (b.highCards[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}
