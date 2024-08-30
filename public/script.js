// Vérification de l'authentification
const checkAuth = () => {
  const token = getToken();
  if (!token) {
    window.location.href = '/login.html';  // Redirige vers la page de login si non authentifié
  } else {
    fetch('/api/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(user => {
      document.getElementById('welcomeMessage').textContent = `Bienvenue ${user.nom}`;
    })
    .catch(error => {
      console.error('Erreur lors de la récupération des informations utilisateur:', error);
      document.getElementById('welcomeMessage').textContent = 'Erreur lors de la récupération du nom';
    });
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

// Sélectionner le bouton d'invitation
const inviteButton = document.getElementById('inviteParticipant');
inviteButton.addEventListener('click', () => {
  const inviteLink = `${window.location.origin}/conference.html?roomCode=${roomCode}`;
  
  navigator.clipboard.writeText(inviteLink)
    .then(() => {
      alert('Lien d\'invitation copié dans le presse-papier : ' + inviteLink);
    })
    .catch((error) => {
      console.error('Erreur lors de la copie du lien d\'invitation :', error);
      alert('Impossible de copier le lien d\'invitation.');
    });
});



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

  const socket = io(); // Assurez-vous que Socket.IO est initialisé
  const peers = {};
  let myVideoStream;
  let screenStream;
  const screenVideo = document.createElement('video');
  
  navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  }).then((stream) => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);
  
    // Gestion du microphone
    const muteButton = document.getElementById('muteButton');
    let audioEnabled = true;

    muteButton.addEventListener('click', () => {
      audioEnabled = !audioEnabled;
      myVideoStream.getAudioTracks()[0].enabled = audioEnabled;
      muteButton.textContent = audioEnabled ? 'Muet' : 'Microphone activé';
    });

    // Gestion de la caméra
    const videoButton = document.getElementById('videoButton');
    let videoEnabled = true;

    videoButton.addEventListener('click', () => {
      videoEnabled = !videoEnabled;
      myVideoStream.getVideoTracks()[0].enabled = videoEnabled;
      videoButton.textContent = videoEnabled ? 'Vidéo' : 'Caméra activée';
    });



    // Gestion du partage d'écran
    const shareScreenButton = document.getElementById('shareScreen');
    shareScreenButton.addEventListener('click', async () => {
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: "always"
          },
          audio: false
        });

        screenVideo.srcObject = screenStream;
        screenVideo.classList.add('shared-screen'); // Classe CSS pour styliser
        document.getElementById('video-grid').append(screenVideo);

        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peer.getSenders().find(s => s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }

        screenStream.getTracks().forEach(track => {
          track.onended = () => {
            const videoSender = peer.getSenders().find(s => s.track.kind === 'video');
            if (videoSender) {
              videoSender.replaceTrack(myVideoStream.getVideoTracks()[0]);
            }
            screenVideo.remove(); // Retirer l'écran partagé de l'interface utilisateur
          };
        });

      } catch (error) {
        console.error('Erreur lors du partage d\'écran:', error);
        
      }
    });

  }).catch((error) => {
    console.error('Erreur lors de l\'accès à la caméra/microphone:', error);
    alert('Impossible d\'accéder à la caméra et au microphone.');
  });

  // Terminer l'appel

  // Sélectionne le bouton "Terminer l'appel"
const endCallButton = document.getElementById('endCallButton');

// Fonction pour terminer l'appel
function endCall() {
  // Arrêter tous les flux vidéo
  const videoElements = document.querySelectorAll('video');
  videoElements.forEach(video => {
    if (video.srcObject) {
      // Arrêter chaque flux média
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  });

  // Fermer la connexion PeerJS si elle existe
  if (peer) {
    peer.destroy(); // Fermer la connexion Peer
  }

  // Déconnecter le socket.io
  if (socket) {
    socket.disconnect();
  }

  // Rediriger vers la page d'accueil ou afficher un message
  window.location.href = 'index.html'; //retourner à la page d'accueil
}

// Associer l'événement de clic au bouton
endCallButton.addEventListener('click', endCall);




  peer.on('open', (id) => {
    socket.emit('join-room', roomCode, id);
  });

  socket.on('user-connected', (userId) => {
    connectToNewUser(userId, myVideoStream);
  });

  socket.on('user-disconnected', (userId) => {
    if (peers[userId]) peers[userId].close();
  });

  peer.on('call', (call) => {
    call.answer(myVideoStream);
    const video = document.createElement('video');
    call.on('stream', (userVideoStream) => {
      addVideoStream(video, userVideoStream);
    });
    call.on('close', () => {
      video.remove();
    });
    peers[call.peer] = call;
  });

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
    video.classList.add('participant-video');
    videoGrid.append(video);
  }
}
