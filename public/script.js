const socket = io();

socket.on('connect', () => {
    console.log('Connesso al server');
});

let playerInfo = {
    name: 'Giocatore'
};

let isCreator = false;
let gameActive = false;
let timerInterval = null;

document.getElementById('save-info').addEventListener('click', () => {
    playerInfo.name = document.getElementById('player-name').value || 'Giocatore';
    socket.emit('updatePlayerInfo', playerInfo);
});

document.getElementById('create-game').addEventListener('click', () => {
    console.log('Richiesta di creazione della stanza');
    socket.emit('createRoom', playerInfo);
    isCreator = true;

document.getElementById('create-game').addEventListener('click', () => {
    socket.emit('createRoom');
});

document.getElementById('join-game').addEventListener('click', () => {
    const roomCode = document.getElementById('join-code').value;
    if (roomCode) {
        console.log('Richiesta di adesione alla stanza:', roomCode);
        socket.emit('joinRoom', roomCode, playerInfo);
        isCreator = false;
        socket.emit('joinRoom', roomCode);
    } else {
        alert('Inserisci un codice di partita valido!');
    }
});

document.getElementById('ready-button').addEventListener('click', () => {
    console.log('Cambio stato di prontezza');
    socket.emit('playerReady');
});

document.getElementById('start-game').addEventListener('click', () => {
    if (isCreator) {
        console.log('Invio richiesta di avvio partita');
        socket.emit('startGame', document.getElementById('room-code').innerText);
    }
});

document.getElementById('submit-guess').addEventListener('click', () => {
    const guess = document.getElementById('guess-input').value;
    console.log('Invio risposta:', guess);
    socket.emit('submitGuess', document.getElementById('room-code').innerText, guess);
});

socket.on('roomCreated', (roomCode) => {
    console.log('Stanza creata:', roomCode);
    socket.emit('playerReady');
});

socket.on('roomCreated', (roomCode) => {
    document.querySelector('.game-options').style.display = 'none';
    document.querySelector('.ready-area').style.display = 'block';
    document.getElementById('room-code').innerText = roomCode;
    document.getElementById('player-count').innerText = '1';
    if (isCreator) {
        document.getElementById('settings-menu').style.display = 'block';
    }
});

socket.on('roomJoined', (roomCode) => {
    console.log('Unito alla stanza:', roomCode);
});

socket.on('roomJoined', (roomCode) => {
    document.querySelector('.game-options').style.display = 'none';
    document.querySelector('.ready-area').style.display = 'block';
    document.getElementById('room-code').innerText = roomCode;
});

socket.on('updatePlayerCount', (count) => {
    console.log('Aggiornamento conteggio giocatori:', count);
    document.getElementById('player-count').innerText = count;
});

socket.on('updatePlayerInfo', (players) => {
    console.log('Aggiornamento informazioni giocatori:', players);
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    players.forEach(([id, player]) => {
        const playerDiv = document.createElement('div');
        playerDiv.classList.add('player');
        playerDiv.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="ready-status">${player.ready ? '✅' : '❌'}</span>
            ${id === socket.id && isCreator ? ' (Creatore)' : ''}
        `;
        playersList.appendChild(playerDiv);
    });
});

socket.on('roomFull', () => {
    console.log('La stanza è piena!');
    document.getElementById('player-count').innerText = count;
});

socket.on('roomFull', () => {
    document.getElementById('message').innerText = 'La stanza è piena!';
});

socket.on('error', (message) => {
    console.log('Errore:', message);
    document.getElementById('message').innerText = message;
});

socket.on('bothPlayersReady', () => {
    console.log('Entrambi i giocatori sono pronti!');
});

socket.on('newRound', (playerId) => {
    console.log('Nuovo turno per il giocatore:', playerId);
    if (socket.id === playerId) {
        document.getElementById('guess-area').style.display = 'block';
        document.getElementById('message').innerText = 'Indovina la parola!';
    } else {
        document.getElementById('guess-area').style.display = 'none';
        document.getElementById('message').innerText = 'Aspetta il turno del giocatore';
    }
    startTimer();
});

socket.on('gameWord', (word) => {
    console.log('Parola da indovinare:', word); // Mostra la parola solo per il giocatore che deve indovinare
});

socket.on('gameResult', ({ result, word }) => {
    console.log('Risultato del gioco:', result, word);
    document.getElementById('guess-area').style.display = 'none';
    document.getElementById('message').innerText = result === 'win' ? 'Hai indovinato la parola!' : `Tempo scaduto! La parola era: ${word}`;
    stopTimer();
});

socket.on('updateTimer', (timer) => {
    console.log('Tempo rimasto:', timer);
    document.getElementById('timer').innerText = `Tempo rimasto: ${timer}s`;
    if (timer <= 0) {
        document.getElementById('timer').style.display = 'none';
    }
});

socket.on('roomLimitIncreased', (newLimit) => {
    console.log('Limite della stanza aumentato a:', newLimit);
    document.getElementById('message').innerText = `Il limite della stanza è stato aumentato a ${newLimit}.`;
});

function startTimer() {
    let timer = 30; // Tempo in secondi
    document.getElementById('timer').style.display = 'block';
    document.getElementById('timer').innerText = `Tempo rimasto: ${timer}s`;
    timerInterval = setInterval(() => {
        timer -= 1;
        document.getElementById('timer').innerText = `Tempo rimasto: ${timer}s`;
        if (timer <= 0) {
            clearInterval(timerInterval);
            document.getElementById('timer').style.display = 'none';
            socket.emit('submitGuess', document.getElementById('room-code').innerText, ''); // Timeout inviato come risposta vuota
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    document.getElementById('timer').style.display = 'none';
  }
}
