const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ROOM_LIMIT = 2; // Numero massimo di giocatori per stanza

let rooms = {};

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Un client si è connesso');

    socket.on('createRoom', () => {
        const roomCode = Math.random().toString(36).substring(2, 7);
        rooms[roomCode] = { players: new Set(), readyPlayers: 0 };
        socket.join(roomCode);
        rooms[roomCode].players.add(socket.id);
        socket.emit('roomCreated', roomCode);
        io.to(roomCode).emit('updatePlayerCount', rooms[roomCode].players.size);
    });

    socket.on('joinRoom', (roomCode) => {
        if (rooms[roomCode] && rooms[roomCode].players.size < ROOM_LIMIT) {
            socket.join(roomCode);
            rooms[roomCode].players.add(socket.id);
            socket.emit('roomJoined', roomCode);
            io.to(roomCode).emit('updatePlayerCount', rooms[roomCode].players.size);
            if (rooms[roomCode].players.size === ROOM_LIMIT) {
                io.to(roomCode).emit('roomFull');
            }
        } else {
            socket.emit('error', 'Codice stanza non valido o stanza piena.');
        }
    });

    socket.on('playerReady', () => {
        let roomCode = null;
        for (let code in rooms) {
            if (rooms[code].players.has(socket.id)) {
                roomCode = code;
                break;
            }
        }
        if (roomCode) {
            rooms[roomCode].readyPlayers++;
            if (rooms[roomCode].readyPlayers === ROOM_LIMIT) {
                io.to(roomCode).emit('bothPlayersReady');
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
                if (rooms[code].players.size === 0) {
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
