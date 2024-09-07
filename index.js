const express = require('express');
const https = require('https'); // Remplacer http par https
const fs = require('fs');
const socketIo = require('socket.io');
const { ExpressPeerServer } = require('peer');
const path = require('path');

// Charger les certificats SSL
const privateKey = fs.readFileSync('server.key', 'utf8');
const certificate = fs.readFileSync('server.cert', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const app = express();
const server = https.createServer(credentials, app); // Utiliser HTTPS ici
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

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
  console.log('Un utilisateur s\'est connecté.');

  socket.on('join-room', (roomCode, userId) => {
    socket.join(roomCode);
    console.log(`Utilisateur (${userId}) s'est connecté à la salle ${roomCode}.`);
    
    // Notifier tous les utilisateurs de la salle que quelqu'un est connecté
    io.to(roomCode).emit('user-connected', userId);

    // Envoyer les détails des utilisateurs déjà connectés à l'utilisateur qui vient de se connecter
    const usersInRoom = Array.from(io.sockets.adapter.rooms.get(roomCode) || []).map(id => id);
    usersInRoom.forEach(user => {
      if (user !== userId) {
        socket.emit('user-connected', user);
      }
    });

    // Gestion de l'envoi et de la réception des messages de chat
    socket.on('chat message', (data) => {
      console.log(`Message reçu de ${data.nom}: ${data.message}`);
      io.to(roomCode).emit('chat message', data);
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

    // Gestion des boutons d'action
  socket.on('end-call', (userNom) => {
    // Informer tous les autres participants de terminer l'appel pour ce participant
    io.to(socket.roomCode).emit('end-call', userNom);
  });

  socket.on('toggle-mic', (userNom) => {
    // Informer tous les autres participants pour couper/activer le micro de cet utilisateur
    io.to(socket.roomCode).emit('toggle-mic', userNom);
  });

  socket.on('toggle-video', (userNom) => {
    // Informer tous les autres participants pour couper/activer la vidéo de cet utilisateur
    io.to(socket.roomCode).emit('toggle-video', userNom);
  });

    // Gestion de la déconnexion de l'utilisateur
    socket.on('disconnect', () => {
      console.log(`Utilisateur (${userId}) s'est déconnecté de la salle ${roomCode}.`);
      socket.to(roomCode).emit('user-disconnected', userId);
    });
  });
});




// Démarrage du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur HTTPS démarré sur le port ${PORT}`);
});
