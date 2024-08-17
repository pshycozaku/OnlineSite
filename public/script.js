const socket = io();

let playerInfo = { name: 'Giocatore' };
let isCreator = false;
let gameActive = false;
let timerInterval; // Definito a livello globale

socket.on('connect', () => {
    console.log('Connesso al server');
});

document.getElementById('save-info').addEventListener('click', () => {
    playerInfo.name = document.getElementById('player-name').value || 'Giocatore';
    socket.emit('updatePlayerInfo', playerInfo);
});

document.getElementById('create-game').addEventListener('click', () => {
    console.log('Richiesta di creazione della stanza');
    socket.emit('createRoom', playerInfo);
    isCreator = true;
    document.getElementById('start-game').classList.add('hidden');
});

document.getElementById('join-game').addEventListener('click', () => {
    const roomCode = document.getElementById('join-code').value;
    if (roomCode) {
        console.log('Richiesta di adesione alla stanza:', roomCode);
        socket.emit('joinRoom', roomCode, playerInfo);
        isCreator = false;
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

// Gestore per "Finisci la partita"
document.getElementById('vote-end').addEventListener('click', () => {
    socket.emit('vote', { vote: 'end', roomCode: document.getElementById('room-code').innerText });
    document.getElementById('voting-area').classList.add('hidden');
    location.reload();
});

// Gestore per "Rigioca"
document.getElementById('vote-replay').addEventListener('click', () => {
    socket.emit('vote', { vote: 'replay', roomCode: document.getElementById('room-code').innerText });
    document.getElementById('voting-area').classList.add('hidden');
    resetLobbyUI(); // Funzione per ripristinare la lobby
    document.getElementById('room-info').classList.remove('hidden');
    resetPlayerReadyStatus();
});

socket.on('roomCreated', (roomCode) => {
    console.log('Stanza creata:', roomCode);
    updateUIForRoom(roomCode);
});

socket.on('roomJoined', (roomCode) => {
    console.log('Unito alla stanza:', roomCode);
    updateUIForRoom(roomCode);
});

socket.on('updatePlayerCount', (count) => {
    console.log('Aggiornamento conteggio giocatori:', count);
    document.getElementById('player-count').innerText = count;
    updateStartButtonVisibility();
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
    updateStartButtonVisibility();
});

socket.on('roomFull', () => {
    console.log('La stanza è piena!');
    document.getElementById('message').innerText = 'La stanza è piena!';
});

socket.on('error', (message) => {
    console.log('Errore:', message);
    document.getElementById('message').innerText = `Errore: ${message}`;
});

socket.on('bothPlayersReady', () => {
    console.log('Entrambi i giocatori sono pronti!');
    updateStartButtonVisibility();
});

socket.on('newRound', ({ playerId, word }) => {
    console.log('Nuovo turno per il giocatore:', playerId);
    gameActive = true;

    document.getElementById('room-info').classList.add('hidden');
    document.getElementById('game-area').classList.remove('hidden');
    document.getElementById('preparation-area').classList.add('hidden');
    document.getElementById('player-info').classList.add('hidden');

    const guessArea = document.getElementById('guess-area');
    const messageElement = document.getElementById('message');
    const wordElement = document.getElementById('word-display'); // Nuovo elemento per mostrare la parola

    if (socket.id === playerId) {
        guessArea.style.display = 'block';
        messageElement.innerText = 'Indovina la parola!';
        wordElement.style.display = 'none'; // Nasconde la parola al giocatore che deve indovinare
    } else {
        guessArea.style.display = 'none';
        messageElement.innerText = 'Aspetta il turno del giocatore';
        wordElement.style.display = 'block'; // Mostra la parola agli altri giocatori
        wordElement.innerText = `La parola è: ${word}`;
    }

    document.getElementById('timer').style.display = (socket.id === playerId) ? 'block' : 'none';
    startTimer();
});

socket.on('gameResult', ({ result, word }) => {
    console.log('Risultato del gioco:', result, word);
    gameActive = false;
    document.getElementById('guess-area').style.display = 'none';
    document.getElementById('message').innerText = result === 'win' ? 'Hai indovinato la parola!' : `Tempo scaduto! La parola era: ${word}`;
    stopTimer();
    document.getElementById('voting-area').classList.remove('hidden');
});

socket.on('votingResult', (decision) => {
    if (decision === 'replay') {
        console.log('I giocatori hanno deciso di rigiocare!');
        resetLobbyUI(); // Ripristina la lobby
        socket.emit('startGame', document.getElementById('room-code').innerText);
    } else {
        console.log('I giocatori hanno deciso di terminare la partita.');
        resetLobbyUI();
        window.location.reload(); // Ricarica la pagina per ripristinare lo stato
    }
});

socket.on('roomClosed', () => {
    console.log('La stanza è stata chiusa.');
    alert('La partita è terminata e la stanza è stata chiusa.');
    resetLobbyUI();
    window.location.reload();
});

// Aggiorna UI quando la stanza viene creata o un giocatore si unisce
function updateUIForRoom(roomCode) {
    document.getElementById('player-info').classList.add('hidden');
    document.getElementById('game-options').classList.add('hidden');
    document.getElementById('game-room').classList.remove('hidden');
    document.getElementById('room-code').innerText = roomCode;
    document.getElementById('player-count').innerText = '1';
    document.getElementById('room-limit').innerText = '2';
    document.getElementById('preparation-area').classList.remove('hidden');
    document.getElementById('game-area').classList.add('hidden');
    document.getElementById('start-game').classList.add('hidden');
}


// Funzione per ripristinare la UI della lobby
function resetLobbyUI() {
    console.log('Ripristino della UI della lobby...');
    gameActive = false;
    document.getElementById('guess-area').style.display = 'none';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('voting-area').classList.add('hidden');
    document.getElementById('message').innerText = '';
    document.getElementById('preparation-area').classList.remove('hidden');
    document.getElementById('game-room').classList.remove('hidden');
    document.getElementById('game-area').classList.add('hidden');
    updateStartButtonVisibility();
}

// Funzione per aggiornare la visibilità del pulsante di avvio
function updateStartButtonVisibility() {
    const allPlayersReady = Array.from(document.getElementById('players-list').children).every(playerDiv => {
        return playerDiv.querySelector('.ready-status').innerText === '✅';
    });
    if (isCreator && allPlayersReady) {
        document.getElementById('start-game').classList.remove('hidden');
    } else {
        document.getElementById('start-game').classList.add('hidden');
    }
}

function resetPlayerReadyStatus() {
    const playersList = document.getElementById('players-list');
    Array.from(playersList.children).forEach(playerDiv => {
        const readyStatus = playerDiv.querySelector('.ready-status');
        if (readyStatus) {
            readyStatus.innerText = '❌'; // Imposta lo stato di "non pronto" per ogni giocatore
        }
    });
}

// Funzioni timer
function startTimer() {
    let timeLeft = 30;
    document.getElementById('timer').innerText = timeLeft;
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);  // Usa la variabile globale definita
}
