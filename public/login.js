document.getElementById('loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
  
    const identifiant = document.getElementById('identifiant').value;
    const motDePasse = document.getElementById('motDePasse').value;
  
    fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiant, motDePasse })
    })
    .then(response => response.json())
    .then(data => {
      if (data.token) {
        console.log('Token received:', data.token); // Vérifiez que le token est reçu
        localStorage.setItem('token', data.token);
        window.location.href = '/';
      } else {
        alert('Erreur : ' + data.message);
      }
    })
    .catch(error => console.error('Erreur:', error));
  });
  