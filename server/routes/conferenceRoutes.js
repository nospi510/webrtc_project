const express = require('express');
const router = express.Router();
const connection = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Création d'une nouvelle salle de conférence
router.post('/create', (req, res) => {
  const { roomName } = req.body;
  const roomCode = uuidv4();

  const query = 'INSERT INTO rooms (room_name, room_code) VALUES (?, ?)';
  connection.query(query, [roomName, roomCode], (error, results) => {
    if (error) {
      console.error('Erreur lors de la création de la salle:', error);
      return res.status(500).json({ error: 'Erreur lors de la création de la salle.' });
    }
    res.json({ roomCode });
  });
});

// Rejoindre une salle de conférence
router.get('/join/:roomCode', (req, res) => {
  const { roomCode } = req.params;

  const query = 'SELECT * FROM rooms WHERE room_code = ?';
  connection.query(query, [roomCode], (error, results) => {
    if (error) {
      console.error('Erreur lors de la récupération de la salle:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération de la salle.' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Salle non trouvée.' });
    }
    res.json({ room: results[0] });
  });
});

module.exports = router;
