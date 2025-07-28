// public/js/api.js

const API_BASE = "https://hostel-outpass-system.onrender.com/api"; // Update this if your backend runs elsewhere

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
    
    // Check if response is ok
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    // Check if response is JSON
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new TypeError("Response was not JSON");
    }

    return await res.json();
  } catch (error) {
    console.error("API error:", error);
    return { message: "Something went wrong! " + error.message };
  }
}

window.sendRequest = sendRequest;