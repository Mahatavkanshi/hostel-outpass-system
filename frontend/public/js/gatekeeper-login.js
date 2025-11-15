document.getElementById('gatekeeperLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMessage = document.getElementById('errorMessage');

    try {
        // Use dynamic API base
        const getApiBase = () => {
          const port = window.location.port;
          if (port === '8080') return '/api';
          if (port === '5500') return 'http://localhost:5000/api';
          if (window.location.hostname === 'localhost') return '/api';
          return `${window.location.protocol}//${window.location.hostname}/api`;
        };
        const API_BASE = getApiBase();
        const response = await fetch(`${API_BASE}/gatekeeper/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        let data = {};
        try {
            data = await response.json();
        } catch (err) {
            console.error("Failed to parse JSON:", err);
        }

        if (response.ok && data.token) {
            console.log("Gatekeeper login successful");
            localStorage.setItem('gatekeeperToken', data.token);
            window.location.href = './gatekeeper-dashboard.html';
        } else {
            errorMessage.textContent = data.message || 'Login failed. Try again.';
        }
    } catch (error) {
        errorMessage.textContent = 'Error connecting to server.';
        console.error('Login Error:', error);
    }
});
