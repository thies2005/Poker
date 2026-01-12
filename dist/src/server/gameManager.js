"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoom = createRoom;
exports.joinRoom = joinRoom;
exports.startGame = startGame;
exports.handleAction = handleAction;
exports.getRoomState = getRoomState;
exports.getFullRoomState = getFullRoomState;
exports.newHand = newHand;
exports.playerDisconnected = playerDisconnected;
exports.playerReconnected = playerReconnected;
const GameState_1 = require("../game/GameState");
const Deck_1 = require("../game/Deck");
const HandEvaluator_1 = require("../game/HandEvaluator");
const rooms = new Map();
const playerRooms = new Map(); // playerId -> roomCode
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}
function createRoom(hostId, hostName) {
    let roomCode = generateRoomCode();
    while (rooms.has(roomCode)) {
        roomCode = generateRoomCode();
    }
    const state = (0, GameState_1.createInitialGameState)(roomCode);
    const host = {
        id: hostId,
        name: hostName,
        chips: 1000,
        cards: [],
        bet: 0,
        folded: false,
        allIn: false,
        isDealer: true,
        isCurrentTurn: false,
        connected: true
    };
    state.players.push(host);
    rooms.set(roomCode, { state, deck: new Deck_1.Deck(), hostId, playersActedThisRound: new Set() });
    playerRooms.set(hostId, roomCode);
    return { roomCode, state: (0, GameState_1.getPlayerView)(state, hostId) };
}
function joinRoom(roomCode, playerId, playerName) {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) {
        return { success: false, error: 'Room not found' };
    }
    if (room.state.phase !== 'waiting') {
        return { success: false, error: 'Game already in progress' };
    }
    if (room.state.players.length >= 8) {
        return { success: false, error: 'Room is full' };
    }
    if (room.state.players.find(p => p.id === playerId)) {
        return { success: true, state: (0, GameState_1.getPlayerView)(room.state, playerId) };
    }
    const player = {
        id: playerId,
        name: playerName,
        chips: 1000,
        cards: [],
        bet: 0,
        folded: false,
        allIn: false,
        isDealer: false,
        isCurrentTurn: false,
        connected: true
    };
    room.state.players.push(player);
    playerRooms.set(playerId, roomCode.toUpperCase());
    return { success: true, state: (0, GameState_1.getPlayerView)(room.state, playerId) };
}
function startGame(roomCode, playerId) {
    const room = rooms.get(roomCode);
    if (!room)
        return { success: false, error: 'Room not found' };
    if (room.hostId !== playerId)
        return { success: false, error: 'Only host can start' };
    if (room.state.players.length < 2)
        return { success: false, error: 'Need at least 2 players' };
    startNewHand(room);
    return { success: true };
}
function startNewHand(room) {
    room.deck.reset();
    room.state.communityCards = [];
    room.state.pot = 0;
    room.state.currentBet = 0;
    room.state.winners = [];
    room.state.lastAction = null;
    // Reset player states
    room.state.players.forEach(p => {
        p.cards = [];
        p.bet = 0;
        p.folded = false;
        p.allIn = false;
    });
    // Move dealer button
    room.state.dealerIndex = (room.state.dealerIndex + 1) % room.state.players.length;
    room.state.players.forEach((p, i) => p.isDealer = i === room.state.dealerIndex);
    // Post blinds
    const sbIndex = (room.state.dealerIndex + 1) % room.state.players.length;
    const bbIndex = (room.state.dealerIndex + 2) % room.state.players.length;
    postBlind(room, sbIndex, room.state.smallBlind);
    postBlind(room, bbIndex, room.state.bigBlind);
    room.state.currentBet = room.state.bigBlind;
    room.state.minRaise = room.state.bigBlind;
    // Deal hole cards to all active players
    room.state.players.forEach(p => {
        p.cards = room.deck.deal(2);
    });
    // Reset players acted tracker for new hand
    room.playersActedThisRound.clear();
    room.state.phase = 'preflop';
    room.state.currentPlayerIndex = (bbIndex + 1) % room.state.players.length;
    updateCurrentTurn(room);
}
function postBlind(room, playerIndex, amount) {
    const player = room.state.players[playerIndex];
    const actualAmount = Math.min(amount, player.chips);
    player.chips -= actualAmount;
    player.bet = actualAmount;
    room.state.pot += actualAmount;
    if (player.chips === 0)
        player.allIn = true;
}
function updateCurrentTurn(room) {
    room.state.players.forEach((p, i) => p.isCurrentTurn = i === room.state.currentPlayerIndex && !p.folded && !p.allIn);
}
function handleAction(roomCode, playerId, action) {
    const room = rooms.get(roomCode);
    if (!room)
        return { success: false, error: 'Room not found' };
    const playerIndex = room.state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1)
        return { success: false, error: 'Player not in room' };
    if (playerIndex !== room.state.currentPlayerIndex)
        return { success: false, error: 'Not your turn' };
    const player = room.state.players[playerIndex];
    if (player.folded || player.allIn)
        return { success: false, error: 'Cannot act' };
    const toCall = room.state.currentBet - player.bet;
    switch (action.type) {
        case 'fold':
            player.folded = true;
            room.state.lastAction = { playerId, action: 'fold' };
            room.playersActedThisRound.add(playerId);
            break;
        case 'check':
            if (toCall > 0)
                return { success: false, error: 'Cannot check, must call or fold' };
            room.state.lastAction = { playerId, action: 'check' };
            room.playersActedThisRound.add(playerId);
            break;
        case 'call':
            if (toCall === 0)
                return { success: false, error: 'Nothing to call, check instead' };
            const callAmount = Math.min(toCall, player.chips);
            player.chips -= callAmount;
            player.bet += callAmount;
            room.state.pot += callAmount;
            if (player.chips === 0)
                player.allIn = true;
            room.state.lastAction = { playerId, action: 'call', amount: callAmount };
            room.playersActedThisRound.add(playerId);
            break;
        case 'raise':
            const raiseAmount = action.amount || room.state.minRaise;
            const totalBet = room.state.currentBet + raiseAmount;
            const toAdd = totalBet - player.bet;
            if (toAdd > player.chips)
                return { success: false, error: 'Not enough chips' };
            if (raiseAmount < room.state.minRaise && toAdd < player.chips)
                return { success: false, error: 'Raise too small' };
            player.chips -= toAdd;
            player.bet = totalBet;
            room.state.pot += toAdd;
            room.state.currentBet = totalBet;
            room.state.minRaise = raiseAmount;
            if (player.chips === 0)
                player.allIn = true;
            room.state.lastAction = { playerId, action: 'raise', amount: raiseAmount };
            // Reset acted tracking when someone raises - others need to act again
            room.playersActedThisRound.clear();
            room.playersActedThisRound.add(playerId);
            break;
        case 'all_in':
            const allInAmount = player.chips;
            player.bet += allInAmount;
            room.state.pot += allInAmount;
            player.chips = 0;
            player.allIn = true;
            if (player.bet > room.state.currentBet) {
                room.state.minRaise = player.bet - room.state.currentBet;
                room.state.currentBet = player.bet;
                // Reset acted tracking when someone raises (all-in that raises)
                room.playersActedThisRound.clear();
            }
            room.state.lastAction = { playerId, action: 'all_in', amount: allInAmount };
            room.playersActedThisRound.add(playerId);
            break;
    }
    checkRoundComplete(room);
    return { success: true };
}
function checkRoundComplete(room) {
    const activePlayers = room.state.players.filter(p => !p.folded);
    // Only one player left
    if (activePlayers.length === 1) {
        room.state.winners = [{
                playerId: activePlayers[0].id,
                amount: room.state.pot,
                handDescription: 'Last player standing'
            }];
        activePlayers[0].chips += room.state.pot;
        room.state.phase = 'ended';
        return;
    }
    // Check if all active players are all-in - if so, run to showdown
    const playersWhoCanAct = room.state.players.filter(p => !p.folded && !p.allIn);
    if (playersWhoCanAct.length === 0) {
        // All remaining players are all-in - deal remaining cards and go to showdown
        while (room.state.phase !== 'river' && room.state.phase !== 'showdown') {
            advancePhase(room);
        }
        // Make sure we get to showdown
        if (room.state.phase !== 'showdown') {
            determineWinner(room);
        }
        return;
    }
    // Find next player to act
    const playersToAct = room.state.players.filter(p => !p.folded && !p.allIn && p.bet < room.state.currentBet);
    // Move to next player
    do {
        room.state.currentPlayerIndex = (room.state.currentPlayerIndex + 1) % room.state.players.length;
    } while ((room.state.players[room.state.currentPlayerIndex].folded ||
        room.state.players[room.state.currentPlayerIndex].allIn) &&
        playersWhoCanAct.length > 0);
    updateCurrentTurn(room);
    // Check if betting round is complete (everyone has acted and bets are equal)
    const allBetsEqual = playersToAct.length === 0;
    const eligiblePlayers = room.state.players.filter(p => !p.folded && !p.allIn);
    const allActed = eligiblePlayers.length === 0 || eligiblePlayers.every(p => room.playersActedThisRound.has(p.id));
    if (allBetsEqual && allActed) {
        advancePhase(room);
    }
}
function advancePhase(room) {
    // Reset bets for new round
    room.state.players.forEach(p => p.bet = 0);
    room.state.currentBet = 0;
    room.state.minRaise = room.state.bigBlind;
    // Clear acted tracking for new round
    room.playersActedThisRound.clear();
    switch (room.state.phase) {
        case 'preflop':
            room.state.communityCards = room.deck.deal(3);
            room.state.phase = 'flop';
            break;
        case 'flop':
            room.state.communityCards.push(...room.deck.deal(1));
            room.state.phase = 'turn';
            break;
        case 'turn':
            room.state.communityCards.push(...room.deck.deal(1));
            room.state.phase = 'river';
            break;
        case 'river':
            determineWinner(room);
            return;
    }
    // Set first to act (after dealer)
    room.state.currentPlayerIndex = (room.state.dealerIndex + 1) % room.state.players.length;
    while (room.state.players[room.state.currentPlayerIndex].folded || room.state.players[room.state.currentPlayerIndex].allIn) {
        room.state.currentPlayerIndex = (room.state.currentPlayerIndex + 1) % room.state.players.length;
    }
    updateCurrentTurn(room);
}
function determineWinner(room) {
    room.state.phase = 'showdown';
    const activePlayers = room.state.players.filter(p => !p.folded);
    const handResults = activePlayers.map(p => ({
        player: p,
        result: (0, HandEvaluator_1.evaluateHand)(p.cards, room.state.communityCards)
    }));
    handResults.sort((a, b) => (0, HandEvaluator_1.compareHands)(b.result, a.result));
    // Find all winners (ties)
    const winners = handResults.filter(hr => (0, HandEvaluator_1.compareHands)(hr.result, handResults[0].result) === 0);
    const winAmount = Math.floor(room.state.pot / winners.length);
    room.state.winners = winners.map(w => {
        w.player.chips += winAmount;
        return {
            playerId: w.player.id,
            amount: winAmount,
            handDescription: w.result.description
        };
    });
}
function getRoomState(roomCode, playerId) {
    const room = rooms.get(roomCode);
    if (!room)
        return null;
    return (0, GameState_1.getPlayerView)(room.state, playerId);
}
function getFullRoomState(roomCode) {
    const room = rooms.get(roomCode);
    return (room === null || room === void 0 ? void 0 : room.state) || null;
}
function newHand(roomCode) {
    const room = rooms.get(roomCode);
    if (!room)
        return false;
    if (room.state.phase !== 'showdown' && room.state.phase !== 'ended')
        return false;
    startNewHand(room);
    return true;
}
function playerDisconnected(playerId) {
    const roomCode = playerRooms.get(playerId);
    if (!roomCode)
        return null;
    const room = rooms.get(roomCode);
    if (!room)
        return null;
    const player = room.state.players.find(p => p.id === playerId);
    if (player) {
        player.connected = false;
        if (room.state.phase !== 'waiting') {
            player.folded = true;
        }
    }
    // If all players disconnected, remove room
    if (room.state.players.every(p => !p.connected)) {
        rooms.delete(roomCode);
    }
    return roomCode;
}
function playerReconnected(playerId, roomCode) {
    const room = rooms.get(roomCode);
    if (!room)
        return false;
    const player = room.state.players.find(p => p.id === playerId);
    if (player) {
        player.connected = true;
        return true;
    }
    return false;
}
