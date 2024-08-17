const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const words = ['schiuma', 'patata', 'latte'];

const ROOM_LIMIT = 2;
const INITIAL_LIMIT = 2;
const INCREMENT_LIMIT = 2;

let rooms = {};

app.use(express.static('public'));

function getRandomWord() {
    return words[Math.floor(Math.random() * words.length)];
}

function startNewRound(roomCode) {
    const players = Array.from(rooms[roomCode].players.keys());
    const randomPlayerId = players[Math.floor(Math.random() * players.length)];
    const word = getRandomWord();

    rooms[roomCode].game.currentTurn = {
        playerId: randomPlayerId,
        guessWord: word
    };

    io.to(roomCode).emit('newRound', { playerId: randomPlayerId, word });

    rooms[roomCode].game.timer = setTimeout(() => {
        io.to(roomCode).emit('gameResult', { result: 'lose', word });
        rooms[roomCode].game.isActive = false;
        increaseRoomLimit(roomCode);
    }, 30000);
}

function increaseRoomLimit(roomCode) {
    rooms[roomCode].limit += INCREMENT_LIMIT;
    io.to(roomCode).emit('roomLimitIncreased', rooms[roomCode].limit);
}

io.on('connection', (socket) => {
    console.log('Un client si è connesso');

    socket.on('createRoom', (playerInfo) => {
        const roomCode = Math.random().toString(36).substring(2, 7);
        rooms[roomCode] = {
            players: new Map(),
            readyPlayers: 0,
            creator: socket.id,
            game: {
                isActive: false,
                currentTurn: null,
                timer: null
            },
            limit: INITIAL_LIMIT
        };
        rooms[roomCode].players.set(socket.id, { ...playerInfo, ready: false });
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        io.to(roomCode).emit('updatePlayerCount', rooms[roomCode].players.size);
        io.to(roomCode).emit('updatePlayerInfo', Array.from(rooms[roomCode].players.entries()));
    });

    socket.on('joinRoom', (roomCode, playerInfo) => {
        const room = rooms[roomCode];
        if (room && room.players.size < room.limit) {
            socket.join(roomCode);
            room.players.set(socket.id, { ...playerInfo, ready: false });
            socket.emit('roomJoined', roomCode);
            io.to(roomCode).emit('updatePlayerCount', room.players.size);
            io.to(roomCode).emit('updatePlayerInfo', Array.from(room.players.entries()));

            if (room.players.size === room.limit) {
                io.to(roomCode).emit('roomFull');
            }
        } else {
            socket.emit('error', 'Codice stanza non valido o stanza piena.');
        }
    });

    socket.on('closeRoom', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            io.to(roomCode).emit('roomClosed');
            clearTimeout(room.game.timer);
            delete rooms[roomCode];
        }
    });

    socket.on('vote', ({ vote, roomCode }) => {
        const room = rooms[roomCode];
        if (room) {
            if (!room.votes) {
                room.votes = { replay: 0, end: 0 };
            }

            room.votes[vote]++;
            if (room.votes.replay + room.votes.end === room.players.size) {
                const decision = room.votes.replay > room.votes.end ? 'replay' : 'end';
                io.to(roomCode).emit('votingResult', decision);

                if (decision === 'end') {
                    clearTimeout(room.game.timer);
                    delete rooms[roomCode];
                } else {
                    startNewRound(roomCode);
                }
            }
        }
    });

    socket.on('playerReady', () => {
        let roomCode = null;
        for (let code in rooms) {
            if (rooms[code].players.has(socket.id)) {
                roomCode = code;
                const playerInfo = rooms[code].players.get(socket.id);
                playerInfo.ready = !playerInfo.ready;
                io.to(roomCode).emit('updatePlayerInfo', Array.from(rooms[code].players.entries()));
                break;
            }
        }
    });

    socket.on('startGame', (roomCode) => {
        const room = rooms[roomCode];
        if (room && room.creator === socket.id) {
            room.game.isActive = true;
            startNewRound(roomCode);
        } else {
            socket.emit('error', 'Non sei autorizzato ad avviare il gioco.');
        }
    });

    socket.on('submitGuess', (roomCode, guess) => {
        const room = rooms[roomCode];
        if (room && room.game.isActive) {
            const currentTurn = room.game.currentTurn;
            if (currentTurn && currentTurn.guessWord === guess) {
                io.to(roomCode).emit('gameResult', { result: 'win', word: currentTurn.guessWord });
            } else {
                io.to(roomCode).emit('gameResult', { result: 'lose', word: currentTurn.guessWord });
            }
            room.game.isActive = false;
            clearTimeout(room.game.timer);
            room.game.timer = null;
            increaseRoomLimit(roomCode);
        }
    });

    socket.on('disconnect', () => {
        let roomCode = null;
        for (let code in rooms) {
            if (rooms[code].players.has(socket.id)) {
                roomCode = code;
                rooms[code].players.delete(socket.id);
                io.to(roomCode).emit('updatePlayerCount', rooms[code].players.size);
                io.to(roomCode).emit('updatePlayerInfo', Array.from(rooms[code].players.entries()));

                if (rooms[code].players.size === 0) {
                    clearTimeout(rooms[code].game.timer);
                    delete rooms[code];
                }
                break;
            }
        }
    });
});

server.listen(3000, () => {
    console.log('Server avviato sulla porta 3000');
});
