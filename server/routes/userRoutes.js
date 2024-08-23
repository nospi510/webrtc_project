const express = require('express');
const router = express.Router();
const connection = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const secretKey = 'wrauWhjFnXEyjOB6OvQNZmoqj5Qux/eHelfPygJzyuA='; // Remplacez par votre clé secrète pour JWT

// Inscription
router.post('/register', (req, res) => {
  const { nom, identifiant, motDePasse } = req.body;
  const hashedPassword = bcrypt.hashSync(motDePasse, 10);

  const query = 'INSERT INTO utilisateurs (identifiant, nom, mot_de_passe, role) VALUES (?, ?, ?, ?)';
  connection.query(query, [identifiant, nom, hashedPassword, 'standard'], (error, results) => {
    if (error) {
      console.error('Erreur lors de l\'inscription:', error);
      return res.status(500).json({ success: false, message: 'Erreur lors de l\'inscription.' });
    }
    res.json({ success: true });
  });
});

// Connexion
router.post('/login', (req, res) => {
  const { identifiant, motDePasse } = req.body;

  const query = 'SELECT * FROM utilisateurs WHERE identifiant = ?';
  connection.query(query, [identifiant], (error, results) => {
    if (error) {
      console.error('Erreur lors de la connexion:', error);
      return res.status(500).json({ success: false, message: 'Erreur lors de la connexion.' });
    }
    if (results.length === 0) {
      return res.status(401).json({ success: false, message: 'Identifiant ou mot de passe incorrect.' });
    }

    const user = results[0];
    const isPasswordValid = bcrypt.compareSync(motDePasse, user.mot_de_passe);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Identifiant ou mot de passe incorrect.' });
    }

    const token = jwt.sign({ userId: user.id, identifiant: user.identifiant }, secretKey, { expiresIn: '1h' });
    res.json({ token });
  });
});

module.exports = router;
