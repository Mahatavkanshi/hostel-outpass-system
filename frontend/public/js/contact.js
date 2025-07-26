document.getElementById("contactForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("contactName").value.trim();
  const email = document.getElementById("contactEmail").value.trim();
  const message = document.getElementById("contactMessage").value.trim();
  const status = document.getElementById("contactStatus");

  try {
    console.log("Submitting contact form:", { name, email, message });
    const res = await fetch("http://localhost:5000/api/contact", {
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
