// script.js

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

// Ajouter un écouteur d'événements au bouton
inviteButton.addEventListener('click', () => {
  // Générer le lien d'invitation
  const inviteLink = `${window.location.origin}/conference.html?roomCode=${roomCode}`;
  
  // Copier le lien dans le presse-papier
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



  let myVideoStream;

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
let screenStream;

shareScreenButton.addEventListener('click', async () => {
  try {
    // Demande à l'utilisateur de sélectionner l'écran ou la fenêtre à partager
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: "always" // Option pour montrer ou cacher le curseur
      },
      audio: false // Le partage d'audio n'est pas toujours bien supporté
    });

    // Ajout du flux de partage d'écran à l'interface utilisateur
    const screenVideo = document.createElement('video');
    screenVideo.srcObject = screenStream;
    screenVideo.addEventListener('loadedmetadata', () => {
      screenVideo.play();
    });
    screenVideo.classList.add('shared-screen'); // Classe CSS pour styliser si nécessaire
    document.getElementById('video-grid').append(screenVideo);

    // Remplace le flux vidéo actuel par le flux de partage d'écran
    const videoTrack = screenStream.getVideoTracks()[0];
    const sender = peer.getSenders().find(s => s.track.kind === 'video');
    sender.replaceTrack(videoTrack);

    // Remet la caméra après la fin du partage d'écran
    videoTrack.onended = () => {
      const videoSender = peer.getSenders().find(s => s.track.kind === 'video');
      videoSender.replaceTrack(myVideoStream.getVideoTracks()[0]);
      screenVideo.remove(); // Retirer l'écran partagé de l'interface utilisateur
    };

  } catch (error) {
    console.error('Erreur lors du partage d\'écran:', error);
    alert('Le partage d\'écran a échoué.');
  }
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


