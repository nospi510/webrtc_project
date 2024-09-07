// Vérification de l'authentification
const checkAuth = () => {
  const token = getToken();
  if (!token) {
    window.location.href = '/login.html'; // Redirige vers la page de login si non authentifié
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
if (inviteButton) {
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

  // Initialisation des icônes pour le microphone
  const muteIcon = document.createElement('i');
  muteIcon.className = 'fas fa-microphone'; // Icône de microphone activé
  muteButton.appendChild(muteIcon);

  muteButton.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    myVideoStream.getAudioTracks()[0].enabled = audioEnabled;
    
    // Changer l'icône selon l'état du microphone
    muteIcon.className = audioEnabled ? 'fas fa-microphone' : 'fas fa-microphone-slash'; // Icône de microphone désactivé
  });

  // Gestion de la caméra
  const videoButton = document.getElementById('videoButton');
  let videoEnabled = true;

  // Initialisation des icônes pour la caméra
  const videoIcon = document.createElement('i');
  videoIcon.className = 'fas fa-video'; // Icône de caméra activée
  videoButton.appendChild(videoIcon);

  videoButton.addEventListener('click', () => {
    videoEnabled = !videoEnabled;
    myVideoStream.getVideoTracks()[0].enabled = videoEnabled;
    
    // Changer l'icône selon l'état de la caméra
    videoIcon.className = videoEnabled ? 'fas fa-video' : 'fas fa-video-slash'; // Icône de caméra désactivée
  });

   // Partage d'écran
const shareScreenButton = document.getElementById('shareScreen');

shareScreenButton.addEventListener('click', async () => {
  try {
    // Demander l'accès au partage d'écran
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: "always"
      },
      audio: true
    });

    // Créer un élément vidéo pour afficher le partage d'écran
    const screenVideo = document.createElement('video');
    screenVideo.srcObject = screenStream;

    screenVideo.addEventListener('loadedmetadata', () => {
      screenVideo.play();
    });

    screenVideo.classList.add('shared-screen');

    // Effacer la grille des vidéos et ajouter la vidéo de partage d'écran
    videoGrid.innerHTML = '';
    videoGrid.append(screenVideo);

    // Remplacer la piste vidéo pour chaque utilisateur connecté
    for (let userNom in peers) {
      const call = peers[userNom];
      if (call && call.peerConnection) { // Vérifie si call et peerConnection existent
        const sender = call.peerConnection.getSenders()
          .find(sender => sender.track.kind === 'video');
        if (sender) { // Vérifie si un sender vidéo est trouvé
          sender.replaceTrack(screenStream.getVideoTracks()[0]);
        }
      }
    }

    // Émettre un événement Socket.io pour indiquer le début du partage d'écran
    socket.emit('share-screen-start', roomCode);

    // Gérer la fin du partage d'écran
    screenStream.getVideoTracks()[0].onended = () => {
      const originalVideoTrack = myVideoStream.getVideoTracks()[0];
      for (let userNom in peers) {
        const call = peers[userNom];
        if (call && call.peerConnection) { // Vérifie si call et peerConnection existent
          const sender = call.peerConnection.getSenders()
            .find(sender => sender.track.kind === 'video');
          if (sender) { // Vérifie si un sender vidéo est trouvé
            sender.replaceTrack(originalVideoTrack);
          }
        }
      }

      // Effacer la grille des vidéos et réafficher la vidéo de la caméra
      videoGrid.innerHTML = '';
      addVideoStream(myVideo, myVideoStream);

      // Émettre un événement Socket.io pour indiquer la fin du partage d'écran
      socket.emit('share-screen-stop', roomCode);
    };

  } catch (error) {
    if (error.name === 'NotAllowedError') {
      alert("Le partage d'écran a été refusé. Veuillez accorder la permission pour continuer.");
    } else {
      console.error('Erreur lors du partage d\'écran:', error);
    }
  }
});

// Gestion des événements Socket.io
socket.on('share-screen-start', () => {
  const videoElements = document.querySelectorAll('.participant-video');
  videoElements.forEach(video => {
    video.style.display = 'block';
  });
});

socket.on('share-screen-stop', () => {
  const videoElements = document.querySelectorAll('.participant-video');
  videoElements.forEach(video => {
    video.style.display = 'block';
  });

  const screenVideo = document.querySelector('.shared-screen');
  if (screenVideo) {
    screenVideo.remove();
  }
});


  }).catch((error) => {
    console.error('Erreur lors de l\'accès à la caméra/microphone:', error);
    alert('Impossible d\'accéder à la caméra et au microphone.');
  });

  // Terminer l'appel
  const endCallButton = document.getElementById('endCallButton');
  endCallButton.addEventListener('click', endCall);

  function endCall() {
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach(video => {
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
    });

    if (peer) {
      peer.destroy();
    }

    if (socket) {
      socket.disconnect();
    }

    window.location.href = 'index.html';
  }

  peer.on('open', (id) => {
    socket.emit('join-room', roomCode, id);
  });

  socket.on('user-connected', (userId) => {
    connectToNewUser(userId, myVideoStream);
  });

  // Écouteur pour les boutons d'action sur chaque participant
  socket.on('participants-update', (participants) => {
    console.log('Participants reçus:', participants);
    const participantList = document.querySelector('.list-group');
    participantList.innerHTML = '';

    participants.forEach(userNom => {
      if (!userNom || /^[0-9a-fA-F-]{36}$/.test(userNom)) {
        console.warn('Nom d\'utilisateur ignoré:', userNom);
        return;
      }

      const listItem = document.createElement('li');
      listItem.className = 'list-group-item';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = userNom;
      listItem.appendChild(nameSpan);

      const callButton = document.createElement('button');
      callButton.innerHTML = '<i class="fas fa-phone-slash"></i>';
      callButton.className = 'call-button';
      listItem.appendChild(callButton);

      const micButton = document.createElement('button');
      micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
      micButton.className = 'mic-button';
      listItem.appendChild(micButton);

      const videoButton = document.createElement('button');
      videoButton.innerHTML = '<i class="fas fa-video-slash"></i>';
      videoButton.className = 'video-button';
      listItem.appendChild(videoButton);

      callButton.addEventListener('click', () => {
        socket.emit('disconnect-call', userNom);
      });

      micButton.addEventListener('click', () => {
        socket.emit('mute-microphone', userNom);
      });

      videoButton.addEventListener('click', () => {
        socket.emit('disable-video', userNom);
      });

      participantList.appendChild(listItem);
   
   
    });
  
  });

  socket.on('disconnect-call', (userNom) => {
    const video = document.querySelector(`video[data-user-nom="${userNom}"]`);
    if (video) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.remove();
    }
  });

  socket.on('mute-microphone', (userNom) => {
    const video = document.querySelector(`video[data-user-nom="${userNom}"]`);
    if (video && video.srcObject) {
      const audioTrack = video.srcObject.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
      }
    }
  });

  socket.on('disable-video', (userNom) => {
    const video = document.querySelector(`video[data-user-nom="${userNom}"]`);
    if (video && video.srcObject) {
      const videoTrack = video.srcObject.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = false;
      }
    }
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
    video.classList.add('participant-video');

    video.addEventListener('loadedmetadata', () => {
      video.play();
    });

    videoGrid.append(video);
  }

    // recuperation du nom de l'utilisateur 

  const fetchUserNom = async () => {
    try {
      const response = await fetch('/api/users/me', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération du nom utilisateur');
      }

      const data = await response.json();
      return data.nom; // Retourne le nom de l'utilisateur depuis la réponse API
    } catch (error) {
      console.error('Erreur lors de la récupération du nom utilisateur:', error);
      return null;
    }
  };

  const initChat = async () => {
  try {
    const userNom = await fetchUserNom(); // Fonction modifiée pour obtenir le champ `nom`
    const socket = io();

    if (userNom) {
      socket.emit('join-room', roomCode, userNom);
    } else {
      console.error('Impossible de récupérer le nom utilisateur.');
    }

    // Ajoute un seul listener pour l'envoi du formulaire de chat
    document.getElementById('chat-form').addEventListener('submit', function(e) {
      e.preventDefault();

      const input = document.getElementById('chat-input');
      if (input.value.trim() !== '') {
        socket.emit('chat message', { nom: userNom, message: input.value });
        input.value = '';
      }
    });

    // S'assurez qu'il n'y a qu'un seul listener pour 'chat message'
    socket.off('chat message'); // Supprime tous les listeners précédents avant d'en ajouter un nouveau
    socket.on('chat message', function(data) {
      const chatBox = document.getElementById('chat-box');
      const messageElement = document.createElement('div');
      messageElement.textContent = `${data.nom}: ${data.message}`;
      chatBox.appendChild(messageElement);
      chatBox.scrollTop = chatBox.scrollHeight;
    });

  } catch (error) {
    console.error('Erreur lors de l\'initialisation du chat:', error);
  }
  };

  initChat(); // Appel de la fonction asynchrone

}




