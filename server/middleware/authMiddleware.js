const jwt = require('jsonwebtoken');
const secretKey = 'wrauWhjFnXEyjOB6OvQNZmoqj5Qux/eHelfPygJzyuA='; 

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401); // Si pas de token, renvoie une erreur 401

  jwt.verify(token, secretKey, (err, user) => {
    if (err) return res.sendStatus(403); // Si le token est invalide, renvoie une erreur 403
    req.user = user; // Ajoute les informations de l'utilisateur à la requête
    next();
  });
};

module.exports = authenticateToken;
