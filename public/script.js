// Vérification de l'authentification
const checkAuth = () => {
  const token = getToken();
  if (!token) {
    window.location.href = '/login.html';  // Redirige vers la page de login si non authentifié
  }
};

// Appeler la fonction checkAuth au chargement de la page
window.onload = checkAuth;


// Fonction pour obtenir le token depuis le stockage local
const getToken = () => localStorage.getItem('token');

// Création d'une salle
const createRoomForm = document.getElementById('createRoomForm');
if (createRoomForm) {
  createRoomForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const roomName = document.getElementById('roomName').value;

    fetch('/api/conferences/create', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ roomName })
    })
    .then(response => response.json())
    .then(data => {
      window.location.href = `/conference.html?roomCode=${data.roomCode}`;
    })
    .catch(error => console.error('Erreur:', error));
  });
}

// Rejoindre une salle
const joinRoomForm = document.getElementById('joinRoomForm');
if (joinRoomForm) {
  joinRoomForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const roomCode = document.getElementById('roomCode').value;

    fetch(`/api/conferences/join/${roomCode}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Salle non trouvée.');
      }
    })
    .then(data => {
      window.location.href = `/conference.html?roomCode=${data.room.room_code}`;
    })
    .catch(error => {
      console.error('Erreur:', error);
      alert('Salle non trouvée. Veuillez vérifier le code.');
    });
  });
}
// Gestion de la conférence
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('roomCode');

if (roomCode) {
  const videoGrid = document.getElementById('video-grid');
  const myVideo = document.createElement('video');
  myVideo.muted = true;

  const peer = new Peer(undefined, {
    path: '/peerjs',
    host: '/',
    port: window.location.port || (window.location.protocol === 'https:' ? 443 : 80)
  });

  let myVideoStream;

  navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  }).then((stream) => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);

    peer.on('call', (call) => {
      call.answer(stream);
      const video = document.createElement('video');
      call.on('stream', (userVideoStream) => {
        addVideoStream(video, userVideoStream);
      });
    });

    socket.on('user-connected', (userId) => {
      connectToNewUser(userId, stream);
    });
  }).catch((error) => {
    console.error('Erreur lors de l\'accès à la caméra/microphone:', error);
    alert('Impossible d\'accéder à la caméra et au microphone.');
  });

  socket.on('user-disconnected', (userId) => {
    if (peers[userId]) peers[userId].close();
  });

  peer.on('open', (id) => {
    socket.emit('join-room', roomCode, id);
  });

  const peers = {};

  function connectToNewUser(userId, stream) {
    const call = peer.call(userId, stream);
    const video = document.createElement('video');
    call.on('stream', (userVideoStream) => {
      addVideoStream(video, userVideoStream);
    });
    call.on('close', () => {
      video.remove();
    });

    peers[userId] = call;
  }

  function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
      video.play();
    });
    videoGrid.append(video);
  }
}
