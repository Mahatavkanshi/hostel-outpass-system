document.getElementById("contactForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("contactName").value.trim();
  const email = document.getElementById("contactEmail").value.trim();
  const message = document.getElementById("contactMessage").value.trim();
  const status = document.getElementById("contactStatus");

  try {
    console.log("Submitting contact form:", { name, email, message });
    // Use dynamic API base
    const getApiBase = () => {
      const port = window.location.port;
      if (port === '8080') return '/api';
      if (port === '5500') return 'http://localhost:5000/api';
      if (window.location.hostname === 'localhost') return '/api';
      return `${window.location.protocol}//${window.location.hostname}/api`;
    };
    const API_BASE = getApiBase();
    const res = await fetch(`${API_BASE}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message }),
    });

    const data = await res.json();

    if (res.ok) {
      status.textContent = "Message sent successfully!";
      status.className = "text-green-600";
    } else {
      status.textContent = data.message || "Failed to send message.";
      status.className = "text-red-600";
    }
  } catch (err) {
    status.textContent = "Error sending message.";
    status.className = "text-red-600";
  }
});
