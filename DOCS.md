# Aphelion Poker - Technical Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Technical Stack](#technical-stack)
4. [Game Rules & Logic](#game-rules--logic)
5. [Data Models & Types](#data-models--types)
6. [Socket.io API Reference](#socketio-api-reference)
7. [Component Architecture](#component-architecture)
8. [Hand Evaluation Algorithm](#hand-evaluation-algorithm)
9. [State Management](#state-management)
10. [Development Guide](#development-guide)
11. [Deployment Guide](#deployment-guide)
12. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

Aphelion Poker is a **real-time multiplayer Texas Hold'em poker application** built on a hybrid architecture combining Next.js for the frontend with a custom Socket.io server for game logic.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   React     │  │  Socket.io  │  │   Next.js   │              │
│  │ Components  │◄─┤   Client    │─►│   Pages     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket (Real-time)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Server Layer                             │
│  ┌──────────────────────────────────────────────────────┐      │
│  │              Socket.io Event Handlers                 │      │
│  │  - create_room  - join_room  - start_game            │      │
│  │  - player_action  - new_hand  - disconnect           │      │
│  └──────────────────────┬───────────────────────────────┘      │
│                         │                                        │
│                         ▼                                        │
│  ┌──────────────────────────────────────────────────────┐      │
│  │              Game Manager (gameManager.ts)            │      │
│  │  - Room Management  - Game State  - Hand Evaluation   │      │
│  └──────────────────────────────────────────────────────┘      │
│                         │                                        │
│                         ▼                                        │
│  ┌──────────────────────────────────────────────────────┐      │
│  │              In-Memory State Storage                  │      │
│  │  Map<roomCode, Room>  -  Map<playerId, roomCode>     │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Hybrid Server Architecture**: Next.js handles SSR/routing while a custom Socket.io server manages real-time game state
2. **In-Memory State**: Game state stored in memory for optimal performance (suitable for single-server deployments)
3. **Event-Driven Communication**: All game actions flow through Socket.io events
4. **Player View Isolation**: Server filters state before sending to ensure players only see their own cards

---

## Project Structure

```
Poker/
├── server.ts                    # Main server entry point (hybrid Next.js + Socket.io)
├── next.config.ts               # Next.js configuration
├── tsconfig.json                # TypeScript config for client
├── tsconfig.server.json         # TypeScript config for server
├── render.yaml                  # Render.com deployment config
│
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── layout.tsx           # Root layout with fonts
│   │   ├── page.tsx             # Lobby page (create/join rooms)
│   │   ├── page.module.css      # Lobby styles
│   │   ├── globals.css          # Global styles with dark theme
│   │   └── room/[code]/         # Dynamic room pages
│   │       └── page.tsx         # Game room page
│   │
│   ├── components/              # React UI components
│   │   ├── Card/                # Playing card display
│   │   │   ├── Card.tsx
│   │   │   └── Card.module.css
│   │   │
│   │   ├── Controls/            # Player action controls
│   │   │   ├── Controls.tsx
│   │   │   └── Controls.module.css
│   │   │
│   │   ├── PlayerSeat/          # Player display component
│   │   │   ├── PlayerSeat.tsx
│   │   │   └── PlayerSeat.module.css
│   │   │
│   │   └── Table/               # Main poker table UI
│   │       ├── Table.tsx
│   │       └── Table.module.css
│   │
│   ├── game/                    # Core game logic (shared)
│   │   ├── GameState.ts         # Game state interfaces and types
│   │   ├── Card.ts              # Card definitions and utilities
│   │   ├── Deck.ts              # Deck management class
│   │   └── HandEvaluator.ts     # Poker hand evaluation logic
│   │
│   ├── server/                  # Server-side game management
│   │   └── gameManager.ts       # Core game state management
│   │
│   └── lib/                     # Client-side utilities
│       └── socket.ts            # Socket.io client wrapper
│
├── dist/                        # Compiled server code (gitignored)
├── .next/                       # Next.js build output (gitignored)
└── public/                      # Static assets
```

---

## Technical Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.1 | React framework with SSR, App Router |
| React | 19.2.3 | UI library |
| TypeScript | ^5 | Type-safe JavaScript |
| Socket.io Client | ^4.8.3 | WebSocket client for real-time communication |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | - | Runtime environment |
| Socket.io | ^4.8.3 | WebSocket server for real-time multiplayer |
| TypeScript | ^5 | Type-safe server code |
| uuid | ^13.0.0 | Unique identifier generation (future use) |

### Development Tools

| Tool | Purpose |
|------|---------|
| ts-node | Direct TypeScript execution for server |
| ESLint | Code linting |
| Next.js built-in | Bundle optimization, hot reload |

---

## Game Rules & Logic

### Texas Hold'em Rules Implemented

#### Blinds Structure
- **Small Blind**: 10 chips
- **Big Blind**: 20 chips
- **Starting Chips**: 1,000 per player

#### Game Phases
```
waiting → preflop → flop → turn → river → showdown → (new hand)
```

1. **Waiting**: Room lobby, players joining
2. **Preflop**: Two hole cards dealt, blinds posted
3. **Flop**: Three community cards revealed
4. **Turn**: Fourth community card revealed
5. **River**: Fifth community card revealed
6. **Showdown**: Remaining players reveal cards, winner determined

#### Player Actions

| Action | Description | Conditions |
|--------|-------------|------------|
| **Fold** | Surrender hand | Always available when it's your turn |
| **Check** | Pass action without betting | Only when no bet to call |
| **Call** | Match current bet | Must have chips to call (or go all-in) |
| **Raise** | Increase the bet | Must have chips, minimum raise applies |
| **All-in** | Bet all remaining chips | Always available |

#### Dealer Button & Betting Order
- Dealer button rotates clockwise after each hand
- Small blind: Left of dealer
- Big blind: Left of small blind
- First to act (preflop): Left of big blind
- First to act (post-flop): Left of dealer

#### Win Conditions
1. **Last Player Standing**: All others fold
2. **Showdown**: Best 5-card hand wins from 7 available cards (2 hole + 5 community)

---

## Data Models & Types

### GameState Interface

Located in `src/game/GameState.ts:18-32`

```typescript
export interface GameState {
    roomCode: string;           // Unique 6-character room identifier
    phase: GamePhase;           // Current game phase
    players: Player[];          // Array of players in room
    communityCards: Card[];     // 0-5 community cards
    pot: number;                // Total chips in pot
    currentBet: number;         // Current highest bet
    dealerIndex: number;        // Index of dealer button position
    currentPlayerIndex: number; // Index of player whose turn it is
    minRaise: number;           // Minimum raise amount
    smallBlind: number;         // Small blind amount (default: 10)
    bigBlind: number;           // Big blind amount (default: 20)
    winners: Winner[];          // Winners from last hand
    lastAction: LastAction;     // Most recent action taken
}
```

### Player Interface

Located in `src/game/GameState.ts:5-16`

```typescript
export interface Player {
    id: string;           // Unique socket ID
    name: string;         // Player display name
    chips: number;        // Current chip count
    cards: Card[];        // Hole cards (0-2)
    bet: number;          // Current round bet
    folded: boolean;      // Has folded this hand
    allIn: boolean;       // Is all-in
    isDealer: boolean;    // Has dealer button
    isCurrentTurn: boolean; // Is this player's turn
    connected: boolean;   // Connection status
}
```

### Card Interface

Located in `src/game/Card.ts:4-7`

```typescript
export interface Card {
    suit: Suit;   // 'hearts' | 'diamonds' | 'clubs' | 'spades'
    rank: Rank;   // '2'-'10' | 'J' | 'Q' | 'K' | 'A'
}
```

### PlayerAction Type

```typescript
export type PlayerAction = {
    type: 'fold' | 'check' | 'call' | 'raise' | 'all_in';
    amount?: number;  // Required for 'raise'
};
```

---

## Socket.io API Reference

### Client → Server Events

#### `create_room`
Create a new game room.

**Payload:**
```typescript
{ playerName: string }
```

**Response Event:** `room_created`
```typescript
{
    roomCode: string;
    state: GameState;
    playerId: string;
}
```

#### `join_room`
Join an existing room.

**Payload:**
```typescript
{
    roomCode: string;  // Case-insensitive
    playerName: string;
}
```

**Response Event:** `room_joined` (success) or `error` (failure)
```typescript
// Success
{
    roomCode: string;
    state: GameState;
    playerId: string;
}

// Error
{ message: string }
```

#### `start_game`
Start the game (host only).

**Payload:** None

**Broadcast:** All clients receive `game_update` with new state.

#### `player_action`
Submit a player action.

**Payload:**
```typescript
{
    type: 'fold' | 'check' | 'call' | 'raise' | 'all_in';
    amount?: number;  // Required for raise
}
```

**Response Event:** `game_update` (success) or `error` (failure)

#### `new_hand`
Request to start a new hand (after showdown).

**Payload:** None

**Broadcast:** All clients receive `game_update` with new state.

### Server → Client Events

#### `room_created`
Emitted when a room is successfully created.

#### `room_joined`
Emitted when a player successfully joins a room.

#### `game_update`
Emitted after any game state change.

**Payload:**
```typescript
{ state: GameState }  // Player-filtered state (hides other players' cards)
```

#### `error`
Emitted when an action fails.

**Payload:**
```typescript
{ message: string }
```

---

## Component Architecture

### Component Tree

```
app/layout.tsx
├── app/page.tsx (Lobby)
│   └── (Forms for create/join room)
│
└── app/room/[code]/page.tsx (Game Room)
    ├── components/Table/Table.tsx
    │   ├── components/PlayerSeat/PlayerSeat.tsx (x8)
    │   │   └── components/Card/Card.tsx (x2)
    │   └── components/Card/Card.tsx (Community cards x5)
    │
    └── components/Controls/Controls.tsx
```

### Key Components

#### Table (`src/components/Table/Table.tsx`)
The main game table component that:
- Renders all 8 player seats positioned around the table
- Displays community cards in the center
- Shows the current pot and game phase
- Handles "Start Game" and "New Hand" buttons
- Determines which controls to show based on game state

#### PlayerSeat (`src/components/PlayerSeat/PlayerSeat.tsx`)
Displays individual player information:
- Player name and chip count
- Dealer button indicator
- Current turn indicator
- Player's cards (face-up for own cards, face-down for others during play)
- Folded/All-in status
- Last action taken

#### Controls (`src/components/Controls/Controls.tsx`)
Action buttons for the current player:
- Fold (always available)
- Check (when no bet to call)
- Call (when there's a bet to match)
- Raise (with slider/input for amount)
- All-in (when player has chips)

#### Card (`src/components/Card/Card.tsx`)
Visual representation of a playing card:
- Rank and suit display
- Color-coded (red for hearts/diamonds, black for clubs/spades)
- Face-down state for hidden cards

---

## Hand Evaluation Algorithm

### Hand Rankings (Highest to Lowest)

| Rank | Description | Example |
|------|-------------|---------|
| Royal Flush | A, K, Q, J, 10 of same suit | A* K* Q* J* 10* |
| Straight Flush | Five sequential cards, same suit | 9* 8* 7* 6* 5* |
| Four of a Kind | Four cards of same rank | K* K* K* K* 5* |
| Full House | Three of a kind + pair | Q* Q* Q* 7* 7* |
| Flush | Five cards, same suit | A* J* 9* 6* 3* |
| Straight | Five sequential cards | 10 9 8 7 6 |
| Three of a Kind | Three cards of same rank | J* J* J* A* 2* |
| Two Pair | Two different pairs | A* A* 9* 9* 4* |
| Pair | Two cards of same rank | 10* 10* K* Q* 3* |
| High Card | Highest card wins | A* J* 9* 5* 2* |

### Algorithm Details

Located in `src/game/HandEvaluator.ts:31-95`

1. **Combination Generation**: Uses `getCombinations()` to generate all 21 possible 5-card combinations from 7 cards (2 hole + 5 community)

2. **Evaluation Steps**:
   - Count rank frequencies (pairs, trips, quads)
   - Check for flush (all same suit)
   - Check for straight (5 sequential values, including wheel A-2-3-4-5)
   - Determine hand rank based on above checks

3. **Tie-Breaking**:
   - Compare rank values first
   - Then compare high cards in order
   - Handles all tie scenarios including kickers

### Special Cases Handled

- **Wheel (A-2-3-4-5)**: Ace plays as low for straight
- **Split Pots**: Multiple winners with equal hands
- **Kicker Comparison**: Proper tie-breaking for identical hands

---

## State Management

### Server-Side State Management

#### Room Storage
```typescript
const rooms = new Map<string, Room>();
const playerRooms = new Map<string, string>();
```

Each `Room` contains:
- `state`: The current `GameState`
- `deck`: A `Deck` instance for dealing
- `hostId`: The room creator's socket ID
- `playersActedThisRound`: Set tracking which players have acted

#### Player View Filtering
```typescript
export function getPlayerView(state: GameState, playerId: string): GameState
```

This function ensures each player only receives:
- Their own hole cards visible
- Other players' cards hidden (unless in showdown)
- All community cards visible

### Client-Side State Management

- Uses React `useState` for local component state
- Socket event listeners update global `GameState`
- `sessionStorage` for persistent player name and ID

---

## Development Guide

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Local Development

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:3000`

3. **Development Features:**
   - Hot reload for both client and server
   - TypeScript type checking
   - ESLint for code quality

### Building for Production

1. **Build:**
   ```bash
   npm run build
   ```
   This compiles:
   - Next.js app to `.next/`
   - Server TypeScript to `dist/`

2. **Start Production Server:**
   ```bash
   npm start
   ```

### Type Safety

The project uses TypeScript in strict mode. Key type files:
- `tsconfig.json` - Client-side configuration
- `tsconfig.server.json` - Server-side configuration

### Code Style

- ESLint configured with Next.js rules
- Run `npm run lint` to check

---

## Deployment Guide

### Render.com Deployment

The project includes `render.yaml` for automatic deployment configuration.

#### Steps:

1. **Fork the repository** to your GitHub account

2. **Connect to Render.com:**
   - Sign up/login at [render.com](https://render.com)
   - Click "New +" → "Web Service"

3. **Configure:**
   - Connect your forked GitHub repository
   - Render auto-detects `render.yaml`
   - Set environment variables if needed

4. **Deploy:**
   - Render automatically builds and deploys
   - Your app will be available at `https://your-app.onrender.com`

#### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Set to `production` for deployment |

### Manual Deployment

For other platforms (Heroku, Railway, etc.):

1. Set build command: `npm run build`
2. Set start command: `npm start`
3. Ensure platform supports WebSockets

---

## Troubleshooting

### Common Issues

#### "Room not found" Error
- Verify room code is entered correctly (6 characters, case-insensitive)
- Room may have expired if all players disconnected

#### Game State Not Updating
- Check browser console for WebSocket connection errors
- Ensure server is running
- Try refreshing the page (uses sessionStorage to reconnect)

#### TypeScript Compilation Errors
- Ensure all dependencies are installed: `npm install`
- Check Node.js version compatibility (18+)

#### Port Already in Use
- Change port: `PORT=3001 npm run dev`
- Or kill process using port 3000

### Debug Mode

Enable detailed logging by modifying `server.ts`:

```typescript
io.on('connection', (socket: Socket) => {
    console.log(`[DEBUG] Client connected: ${socket.id}`);
    // Add more logging as needed
});
```

---

## License

This project is private and proprietary.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2025 | Initial release |
