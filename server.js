const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ROOM_LIMIT = 5; // Numero massimo di giocatori per stanza
const INITIAL_LIMIT = 2;
const INCREMENT_LIMIT = 2;

let rooms = {};

app.use(express.static('public'));

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
            }
        };
        rooms[roomCode].players.set(socket.id, { ...playerInfo, ready: false });
        socket.join(roomCode);
        console.log(`Stanza creata con codice ${roomCode} da ${socket.id}`);
        socket.emit('roomCreated', roomCode);
        io.to(roomCode).emit('updatePlayerCount', rooms[roomCode].players.size);
        io.to(roomCode).emit('updatePlayerInfo', Array.from(rooms[roomCode].players.entries()));
    });


    socket.on('joinRoom', (roomCode, playerInfo) => {
        if (rooms[roomCode] && rooms[roomCode].players.size < ROOM_LIMIT) {
            socket.join(roomCode);
            rooms[roomCode].players.set(socket.id, { ...playerInfo, ready: false });
            socket.emit('roomJoined', roomCode);
            io.to(roomCode).emit('updatePlayerCount', rooms[roomCode].players.size);
            io.to(roomCode).emit('updatePlayerInfo', Array.from(rooms[roomCode].players.entries()));
            if (rooms[roomCode].players.size === ROOM_LIMIT) {
                io.to(roomCode).emit('roomFull');
            }
        } else {
            socket.emit('error', 'Codice stanza non valido o stanza piena.');
        }
    });

    socket.on('updatePlayerInfo', (updatedInfo) => {
        let roomCode = null;
        for (let code in rooms) {
            if (rooms[code].players.has(socket.id)) {
                roomCode = code;
                rooms[code].players.set(socket.id, { ...updatedInfo, ready: rooms[code].players.get(socket.id).ready });
                io.to(roomCode).emit('updatePlayerInfo', Array.from(rooms[code].players.entries()));
                break;
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
                rooms[code].players.set(socket.id, playerInfo);
                io.to(roomCode).emit('updatePlayerInfo', Array.from(rooms[code].players.entries()));
                break;
            }
        }
    });

    socket.on('startGame', (roomCode) => {
        console.log(`Richiesta di avvio partita ricevuta per la stanza: ${roomCode}`);
        if (rooms[roomCode] && rooms[roomCode].creator === socket.id) {
            rooms[roomCode].game.isActive = true;
            startNewRound(roomCode);
        } else {
            socket.emit('error', 'Non sei autorizzato ad avviare il gioco.');
        }
    });


    socket.on('submitGuess', (roomCode, guess) => {
        if (rooms[roomCode] && rooms[roomCode].game.isActive) {
            const currentTurn = rooms[roomCode].game.currentTurn;
            if (currentTurn && currentTurn.guessWord === guess) {
                io.to(roomCode).emit('gameResult', { result: 'win', word: currentTurn.guessWord });
                rooms[roomCode].game.isActive = false;
                clearTimeout(rooms[roomCode].game.timer);
                rooms[roomCode].game.timer = null;
                increaseRoomLimit(roomCode);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Un client si è disconnesso');
        let roomCode = null;
        for (let code in rooms) {
            if (rooms[code].players.has(socket.id)) {
                roomCode = code;
                rooms[code].players.delete(socket.id);
                rooms[code].readyPlayers = 0;
                io.to(roomCode).emit('updatePlayerCount', rooms[code].players.size);
                io.to(roomCode).emit('updatePlayerInfo', Array.from(rooms[code].players.entries()));
                if (rooms[code].players.size === 0) {
                    delete rooms[code];
                }
                break;
            }
        }
    });

    function startNewRound(roomCode) {
        const players = Array.from(rooms[roomCode].players.keys());
        const randomPlayerId = players[Math.floor(Math.random() * players.length)];
        rooms[roomCode].game.currentTurn = {
            playerId: randomPlayerId,
            guessWord: 'Parola segreta' // Qui puoi impostare una parola segreta vera
        };
        io.to(roomCode).emit('newRound', rooms[roomCode].game.currentTurn.playerId);

        // Timer per il turno
        rooms[roomCode].game.timer = setTimeout(() => {
            io.to(roomCode).emit('gameResult', { result: 'lose', word: rooms[roomCode].game.currentTurn.guessWord });
            rooms[roomCode].game.isActive = false;
            increaseRoomLimit(roomCode);
        }, 30000); // 30 secondi per indovinare la parola
    }

    function increaseRoomLimit(roomCode) {
        ROOM_LIMIT += INCREMENT_LIMIT;
        io.to(roomCode).emit('roomLimitIncreased', ROOM_LIMIT);
    }
});

server.listen(3000, () => {
    console.log('Server avviato sulla porta 3000');
});
