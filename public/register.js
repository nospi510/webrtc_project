document.getElementById('registerForm').addEventListener('submit', (event) => {
    event.preventDefault();
  
    const nom = document.getElementById('nom').value;
    const identifiant = document.getElementById('identifiant').value;
    const motDePasse = document.getElementById('motDePasse').value;
  
    fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, identifiant, motDePasse })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        alert('Inscription réussie !');
        window.location.href = '/login.html';
      } else {
        alert('Erreur : ' + data.message);
      }
    })
    .catch(error => console.error('Erreur:', error));
  });
  