const socket = io();

document.getElementById('create-game').addEventListener('click', () => {
    socket.emit('createRoom');
});

document.getElementById('join-game').addEventListener('click', () => {
    const roomCode = document.getElementById('join-code').value;
    if (roomCode) {
        socket.emit('joinRoom', roomCode);
    } else {
        alert('Inserisci un codice di partita valido!');
    }
});

document.getElementById('ready-button').addEventListener('click', () => {
    socket.emit('playerReady');
});

socket.on('roomCreated', (roomCode) => {
    document.querySelector('.game-options').style.display = 'none';
    document.querySelector('.ready-area').style.display = 'block';
    document.getElementById('room-code').innerText = roomCode;
    document.getElementById('player-count').innerText = '1';
});

socket.on('roomJoined', (roomCode) => {
    document.querySelector('.game-options').style.display = 'none';
    document.querySelector('.ready-area').style.display = 'block';
    document.getElementById('room-code').innerText = roomCode;
});

socket.on('updatePlayerCount', (count) => {
    document.getElementById('player-count').innerText = count;
});

socket.on('roomFull', () => {
    document.getElementById('message').innerText = 'La stanza è piena!';
});

socket.on('error', (message) => {
    document.getElementById('message').innerText = message;
});

socket.on('bothPlayersReady', () => {
    console.log('Entrambi i giocatori sono pronti!');
});
