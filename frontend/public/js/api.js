// public/js/api.js

// ✅ Use localhost for development, production URL for deployment
// const API_BASE = window.location.hostname === 'localhost' 
//   ? "http://localhost:5000/api" 
//   : "https://hostel-outpass-system.onrender.com/api";
const API_BASE = "http://localhost:5000/api"; 

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
      const errorText = await res.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || `HTTP error! status: ${res.status}` };
      }
      throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
    }
    
    // Check if response is JSON
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new TypeError("Response was not JSON");
    }

    return await res.json();
  } catch (error) {
    console.error("API error:", error);
    throw error; // ✅ Re-throw the error so calling code can handle it
  }
}

window.sendRequest = sendRequest;