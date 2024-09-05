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
const participants = {}; // Dictionnaire pour stocker les participants par salle

io.on('connection', (socket) => {
  console.log('Un utilisateur s\'est connecté.');

  socket.on('join-room', (roomCode, userNom) => {
    // Validation des entrées
    if (!roomCode || !userNom) {
      console.error('Room code ou nom d\'utilisateur manquant.');
      return;
    }

    // Stocker le roomCode et le nom de l'utilisateur dans l'objet socket
    socket.roomCode = roomCode;
    socket.userNom = userNom;

    // Ajouter l'utilisateur à la liste des participants de la salle
    if (!participants[roomCode]) {
      participants[roomCode] = [];
    }

    // Vérifier si l'utilisateur est déjà dans la liste des participants
    if (!participants[roomCode].includes(userNom)) {
      participants[roomCode].push(userNom);
      socket.join(roomCode);

      console.log(`Utilisateur (${userNom}) s'est connecté à la salle ${roomCode}.`);

      // Notifier tous les utilisateurs de la salle que quelqu'un est connecté
      io.to(roomCode).emit('user-connected', userNom);

      // Envoyer la liste mise à jour des participants à tous les utilisateurs de la salle
      io.to(roomCode).emit('participants-update', participants[roomCode]);
    } else {
      console.warn(`Utilisateur (${userNom}) est déjà dans la salle ${roomCode}.`);
    }
  });

  // Gestion du début du partage d'écran
  socket.on('share-screen-start', (roomCode) => {
    if (roomCode) {
      io.to(roomCode).emit('share-screen-start', socket.userNom);
      console.log(`Partage d'écran commencé par ${socket.userNom} dans la salle ${roomCode}.`);
    } else {
      console.error('Room code manquant pour démarrer le partage d\'écran.');
    }
  });

  // Gestion de l'arrêt du partage d'écran
  socket.on('share-screen-stop', (roomCode) => {
    if (roomCode) {
      io.to(roomCode).emit('share-screen-stop', socket.userNom);
      console.log(`Partage d'écran arrêté par ${socket.userNom} dans la salle ${roomCode}.`);
    } else {
      console.error('Room code manquant pour arrêter le partage d\'écran.');
    }
  });

  // Gestion de l'envoi et de la réception des messages de chat
  socket.on('chat message', (data) => {
    const roomCode = socket.roomCode; // Récupérer le roomCode stocké dans le socket
    if (roomCode && data && data.nom && data.message) {
      console.log(`Message reçu de ${data.nom}: ${data.message}`);
      io.to(roomCode).emit('chat message', data);
    } else {
      console.error('Erreur lors de l\'envoi du message: données manquantes ou invalides.');
    }
  });

  socket.on('disconnect', () => {
    const roomCode = socket.roomCode; // Récupérer le roomCode stocké dans le socket
    const userNom = socket.userNom; // Récupérer le nom de l'utilisateur stocké dans le socket
    if (roomCode && userNom) {
      console.log(`Utilisateur (${userNom}) s'est déconnecté de la salle ${roomCode}.`);

      // Retirer l'utilisateur de la liste des participants de la salle
      if (participants[roomCode]) {
        participants[roomCode] = participants[roomCode].filter(nom => nom !== userNom);

        // Notifier les autres utilisateurs de la salle de la déconnexion
        io.to(roomCode).emit('participants-update', participants[roomCode]);
        io.to(roomCode).emit('user-disconnected', userNom);

        // Supprimer la salle si elle est vide
        if (participants[roomCode].length === 0) {
          delete participants[roomCode];
          console.log(`La salle ${roomCode} a été supprimée car elle est vide.`);
        }
      }
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
