import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';
import {
    createRoom,
    joinRoom,
    startGame,
    handleAction,
    getRoomState,
    getFullRoomState,
    newHand,
    playerDisconnected
} from './src/server/gameManager';
import { PlayerAction } from './src/game/GameState';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    io.on('connection', (socket: Socket) => {
        console.log(`Client connected: ${socket.id}`);
        let currentRoom: string | null = null;

        socket.on('create_room', ({ playerName }: { playerName: string }) => {
            const { roomCode, state } = createRoom(socket.id, playerName);
            currentRoom = roomCode;
            socket.join(roomCode);
            socket.emit('room_created', { roomCode, state, playerId: socket.id });
        });

        socket.on('join_room', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
            const result = joinRoom(roomCode.toUpperCase(), socket.id, playerName);
            if (result.success && result.state) {
                currentRoom = roomCode.toUpperCase();
                socket.join(currentRoom);
                socket.emit('room_joined', { roomCode: currentRoom, state: result.state, playerId: socket.id });

                // Notify all players in room of update
                const fullState = getFullRoomState(currentRoom);
                if (fullState) {
                    fullState.players.forEach(p => {
                        io.to(p.id).emit('game_update', { state: getRoomState(currentRoom!, p.id) });
                    });
                }
            } else {
                socket.emit('error', { message: result.error });
            }
        });

        socket.on('start_game', () => {
            if (!currentRoom) return;
            const result = startGame(currentRoom, socket.id);
            if (result.success) {
                broadcastGameState(currentRoom);
            } else {
                socket.emit('error', { message: result.error });
            }
        });

        socket.on('player_action', (action: PlayerAction) => {
            if (!currentRoom) return;
            const result = handleAction(currentRoom, socket.id, action);
            if (result.success) {
                broadcastGameState(currentRoom);
            } else {
                socket.emit('error', { message: result.error });
            }
        });

        socket.on('new_hand', () => {
            if (!currentRoom) return;
            if (newHand(currentRoom)) {
                broadcastGameState(currentRoom);
            }
        });

        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
            const roomCode = playerDisconnected(socket.id);
            if (roomCode) {
                broadcastGameState(roomCode);
            }
        });

        function broadcastGameState(roomCode: string) {
            const fullState = getFullRoomState(roomCode);
            if (fullState) {
                fullState.players.forEach(p => {
                    io.to(p.id).emit('game_update', { state: getRoomState(roomCode, p.id) });
                });
            }
        }
    });

    httpServer.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
