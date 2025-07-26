// public/js/api.js

const API_BASE = "http://localhost:5000/api"; // Update this if your backend runs elsewhere

async function sendRequest(endpoint, method = "GET", data = null, token = null) {
  const config = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (data) config.body = JSON.stringify(data);
  if (token) config.headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    return await res.json();
  } catch (error) {
    console.error("API error:", error);
    return { message: "Something went wrong!" };
  }
}

window.sendRequest = sendRequest;