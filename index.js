const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const { ExpressPeerServer } = require('peer');
const path = require('path');

// Charger les certificats SSL
const privateKey = fs.readFileSync('server.key', 'utf8');
const certificate = fs.readFileSync('server.cert', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const app = express();
const server = https.createServer(credentials, app);
const io = socketIo(server);

// Importation des routes
const conferenceRoutes = require('./server/routes/conferenceRoutes');
const userRoutes = require('./server/routes/userRoutes');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes API
app.use('/api/conferences', conferenceRoutes);
app.use('/api/users', userRoutes);

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Route par défaut
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configuration de PeerJS
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/'
});
app.use('/peerjs', peerServer);

// Gestion des participants par salle
const participants = {};

// Fonctions Utilitaires
const addParticipant = (roomCode, userNom, socket) => {
  if (!participants[roomCode]) {
    participants[roomCode] = [];
  }
  if (!participants[roomCode].includes(userNom)) {
    participants[roomCode].push(userNom);
    socket.join(roomCode);
    io.to(roomCode).emit('user-connected', userNom);
    io.to(roomCode).emit('participants-update', participants[roomCode]);
    console.log(`Utilisateur (${userNom}) s'est connecté à la salle ${roomCode}.`);
  } else {
    console.warn(`Utilisateur (${userNom}) est déjà dans la salle ${roomCode}.`);
  }
};

const removeParticipant = (roomCode, userNom) => {
  if (participants[roomCode]) {
    participants[roomCode] = participants[roomCode].filter(nom => nom !== userNom);
    io.to(roomCode).emit('participants-update', participants[roomCode]);
    io.to(roomCode).emit('user-disconnected', userNom);
    if (participants[roomCode].length === 0) {
      delete participants[roomCode];
      console.log(`La salle ${roomCode} a été supprimée car elle est vide.`);
    }
  }
};

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
  console.log('Un utilisateur s\'est connecté.');

  socket.on('join-room', (roomCode, userNom) => {
    if (!roomCode || !userNom) {
      console.error('Room code ou nom d\'utilisateur manquant.');
      return;
    }
    socket.roomCode = roomCode;
    socket.userNom = userNom;
    addParticipant(roomCode, userNom, socket);
  });

  // Gestion du début et de l'arrêt du partage d'écran
  socket.on('share-screen-start', (roomCode) => {
    if (roomCode) {
      io.to(roomCode).emit('share-screen-start', socket.userNom);
      console.log(`Partage d'écran commencé par ${socket.userNom} dans la salle ${roomCode}.`);
    } else {
      console.error('Room code manquant pour démarrer le partage d\'écran.');
    }
  });

  socket.on('share-screen-stop', (roomCode) => {
    if (roomCode) {
      io.to(roomCode).emit('share-screen-stop', socket.userNom);
      console.log(`Partage d'écran arrêté par ${socket.userNom} dans la salle ${roomCode}.`);
    } else {
      console.error('Room code manquant pour arrêter le partage d\'écran.');
    }
  });

  // Gestion des messages de chat
  socket.on('chat message', (data) => {
    const roomCode = socket.roomCode;
    if (roomCode && data && data.nom && data.message) {
      console.log(`Message reçu de ${data.nom}: ${data.message}`);
      io.to(roomCode).emit('chat message', data);
    } else {
      console.error('Erreur lors de l\'envoi du message: données manquantes ou invalides.');
    }
  });

  // Déconnexion de l'utilisateur
  socket.on('disconnect', () => {
    const roomCode = socket.roomCode;
    const userNom = socket.userNom;
    if (roomCode && userNom) {
      console.log(`Utilisateur (${userNom}) s'est déconnecté de la salle ${roomCode}.`);
      removeParticipant(roomCode, userNom);
    } else {
      console.warn('Déconnexion d\'un utilisateur sans informations complètes de salle ou de nom.');
    }
  });
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur HTTPS démarré sur le port ${PORT}`);
});