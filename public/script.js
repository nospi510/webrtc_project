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

  
// Implementation du partage d'écran
const shareScreenButton = document.getElementById('shareScreen');
shareScreenButton.addEventListener('click', async () => {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" },
      audio: false
    });

    // Informer les autres participants que le partage d'écran a commencé
    socket.emit('share-screen-start', roomCode);

    // Créer un élément vidéo pour afficher le partage d'écran
    screenVideo.srcObject = screenStream;
    screenVideo.classList.add('shared-screen');
    screenVideo.style.width = '100%'; // Plein écran

    screenVideo.addEventListener('loadedmetadata', () => {
      screenVideo.play();
    });

    // Ajouter la vidéo de partage d'écran et désactiver les autres vidéos
    videoGrid.innerHTML = ''; 
    videoGrid.append(screenVideo);

    // Remplacer la piste vidéo pour chaque utilisateur connecté
    for (let userNom in peers) {
      const call = peers[userNom];
      if (call) {
        call.peerConnection.getSenders()
          .find(sender => sender.track.kind === 'video')
          .replaceTrack(screenStream.getVideoTracks()[0]);
      }
    }

    // Gérer la fin du partage d'écran
    screenStream.getVideoTracks()[0].onended = () => {
      // Restaurer la piste vidéo originale
      const originalVideoTrack = myVideoStream.getVideoTracks()[0];
      for (let userNom in peers) {
        const call = peers[userNom];
        if (call) {
          call.peerConnection.getSenders()
            .find(sender => sender.track.kind === 'video')
            .replaceTrack(originalVideoTrack);
        }
      }

      // Réactiver les vidéos et retirer le partage d'écran
      videoGrid.innerHTML = '';
      addVideoStream(myVideo, myVideoStream);

      // Informer les autres participants que le partage d'écran s'est arrêté
      socket.emit('share-screen-stop', roomCode);
    };

  } catch (error) {
    console.error('Erreur lors du partage d\'écran:', error);
  }
});

// Gestion des événements Socket.io
socket.on('share-screen-start', () => {
  // Masquer les vidéos et afficher le partage d'écran en plein écran
  const videoElements = document.querySelectorAll('.participant-video');
  videoElements.forEach(video => {
    video.style.display = 'block';
  });
});

  socket.on('share-screen-stop', () => {
    // Réafficher les vidéos et masquer le partage d'écran
    const videoElements = document.querySelectorAll('.participant-video');
    videoElements.forEach(video => {
      video.style.display = 'block';
    });
    // Retirer la vidéo de partage d'écran si encore présente
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

  // Écouteur pour les boutons d'action sur chaque participant
socket.on('participants-update', (participants) => {
  console.log('Participants reçus:', participants);
  const participantList = document.querySelector('.list-group');
  participantList.innerHTML = '';

  participants.forEach(userNom => {
    // Filtrer les UUIDs s'ils apparaissent encore
    if (!userNom || /^[0-9a-fA-F-]{36}$/.test(userNom)) {
      console.warn('Nom d\'utilisateur ignoré:', userNom);
      return;
    }

    const listItem = document.createElement('li');
    listItem.className = 'list-group-item';
    
    // Nom du participant
    const nameSpan = document.createElement('span');
    nameSpan.textContent = userNom;
    listItem.appendChild(nameSpan);

    // Boutons d'action
    const callButton = document.createElement('button');
    callButton.innerHTML = '<i class="fas fa-phone-slash"></i>';
    callButton.className = 'call-button';
    listItem.appendChild(callButton);

    const micButton = document.createElement('button');
    micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    micButton.className = 'microphone-button';
    listItem.appendChild(micButton);

    const videoButton = document.createElement('button');
    videoButton.innerHTML = '<i class="fas fa-video"></i>';
    videoButton.className = 'video-button';
    listItem.appendChild(videoButton);

    participantList.appendChild(listItem);

    // Ajouter des écouteurs pour les boutons
    callButton.addEventListener('click', () => {
      socket.emit('end-participant-call', { roomCode, targetUser: userNom });
    });

    micButton.addEventListener('click', () => {
      socket.emit('toggle-participant-mic', { roomCode, targetUser: userNom });
    });

    videoButton.addEventListener('click', () => {
      socket.emit('toggle-participant-video', { roomCode, targetUser: userNom });
    });
  });
});

// Recevoir les événements pour gérer les actions sur les participants
socket.on('participant-mic-toggled', ({ targetUser, micEnabled }) => {
  console.log(`Microphone de ${targetUser} ${micEnabled ? 'activé' : 'désactivé'}.`);
  // Logique pour mettre à jour l'interface utilisateur si nécessaire
});

socket.on('participant-video-toggled', ({ targetUser, videoEnabled }) => {
  console.log(`Vidéo de ${targetUser} ${videoEnabled ? 'activée' : 'désactivée'}.`);
  // Logique pour mettre à jour l'interface utilisateur si nécessaire
});

socket.on('participant-call-ended', (targetUser) => {
  console.log(`Appel terminé pour ${targetUser}.`);
  // Logique pour retirer le flux vidéo si nécessaire
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


