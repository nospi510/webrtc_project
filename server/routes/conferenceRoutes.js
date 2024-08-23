const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const connection = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Création d'une salle
router.post('/create', authenticateToken, (req, res) => {
  const { roomName } = req.body;
  const roomCode = uuidv4();
  const userId = req.user.id;

  const query = 'INSERT INTO rooms (room_name, room_code, user_id) VALUES (?, ?, ?)';
  connection.query(query, [roomName, roomCode, userId], (error, results) => {
    if (error) {
      console.error('Erreur lors de la création de la salle:', error);
      return res.status(500).json({ error: 'Erreur lors de la création de la salle.' });
    }
    res.json({ roomCode });
  });
});


// Rejoindre une salle
router.get('/join/:roomCode', authenticateToken, (req, res) => {
  const { roomCode } = req.params;

  const query = 'SELECT * FROM rooms WHERE room_code = ?';
  connection.query(query, [roomCode], (error, results) => {
    if (error) {
      console.error('Erreur lors de la connexion à la salle:', error);
      return res.status(500).json({ success: false, message: 'Erreur lors de la connexion à la salle.' });
    }
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Salle non trouvée.' });
    }
    res.json({ room: results[0] });
  });
});

module.exports = router;
