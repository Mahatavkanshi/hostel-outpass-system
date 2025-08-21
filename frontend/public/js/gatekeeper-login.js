document.getElementById('gatekeeperLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMessage = document.getElementById('errorMessage');

    try {
        const response = await fetch('http://localhost:5000/api/gatekeeper/login', {
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
