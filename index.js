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
