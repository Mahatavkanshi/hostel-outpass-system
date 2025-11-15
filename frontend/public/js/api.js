// public/js/api.js

// Dynamically determine API base URL
const getApiBase = () => {
  const hostname = window.location.hostname;
  const port = window.location.port;
  const protocol = window.location.protocol;
  
  // If running through nginx proxy (Docker on port 8080), use relative path
  if (port === '8080') {
    return '/api';
  }
  
  // If running locally with Live Server (port 5500), point to backend
  if (port === '5500' || hostname === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }
  
  // If localhost without specific port, check if it's the nginx proxy
  if (hostname === 'localhost') {
    return '/api';
  }
  
  // Production deployment (Render, Vercel, etc.)
  return `${protocol}//${hostname}/api`;
};

const API_BASE = getApiBase();

// Export for use in other scripts
window.API_BASE = API_BASE;
window.getApiBase = getApiBase;

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