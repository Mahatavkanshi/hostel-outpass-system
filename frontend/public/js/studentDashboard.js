// ✅ Load token and user info once
const token = localStorage.getItem("token");
let user;

try {
  user = JSON.parse(localStorage.getItem("user"));
} catch (e) {
  console.error("Failed to parse user from localStorage:", e);
  alert("Session data corrupted. Please log in again.");
  window.location.href = "index.html";
}

// Comprehensive validation
if (!token) {
  alert("No authentication token found. Please log in.");
  window.location.href = "index.html";
}

if (!user || !user._id || user.role !== "student") {
  alert("Invalid user data. Please log in again.");
  localStorage.clear(); // Clear corrupted data
  window.location.href = "index.html";
}

// ✅ Set student name
document.getElementById("studentName").textContent = user.name || "Student";

// ✅ Check profile completion
async function checkProfileCompletion() {
  try {
    const res = await sendRequest("/profile", "GET", null, token);
    if (!res || !res.profile) {
      console.error("Invalid profile response:", res);
      return;
    }
    
    const profile = res.profile;
    const requiredFields = [
      "contactNumber",
      "parentContact",
      "address",
      "gender",
      "roomNumber",
      "emergencyContact"
    ];

    const incomplete = requiredFields.some(field => !profile[field] || profile[field].trim() === "");
    if (incomplete) {
      document.getElementById("profileAlert").classList.remove("hidden");
    }
  } catch (err) {
    console.error("Profile check failed", err);
  }
}

// ✅ Load student's outpass requests
async function loadOutpasses() {
  try {
    const res = await sendRequest("/outpass/my", "GET", null, token);
    const tableBody = document.getElementById("outpassTableBody");
    tableBody.innerHTML = "";

    if (Array.isArray(res) && res.length > 0) {
      res.forEach((req) => {
        const currentTime = new Date();
        const allowedReturnTime = new Date(req.dateOfLeaving);
        const [hours, minutes] = req.timeIn.split(":");
        allowedReturnTime.setHours(parseInt(hours), parseInt(minutes), 0);

        const isLate = currentTime > allowedReturnTime && req.status === "approved";

        const locationButton = isLate
          ? `<button onclick="sendLocation('${req._id}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">Send My Location</button>`
          : "—";

        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="py-2 px-4 border-b">${new Date(req.dateOfLeaving).toLocaleDateString()}</td>
          <td class="py-2 px-4 border-b">${req.timeOut}</td>
          <td class="py-2 px-4 border-b">${req.timeIn}</td>
          <td class="py-2 px-4 border-b">${req.placeOfVisit}</td>
          <td class="py-2 px-4 border-b">${req.reason}</td>
          <td class="py-2 px-4 border-b">${req.status}</td>
          <td class="py-2 px-4 border-b">${locationButton}</td>
        `;
        tableBody.appendChild(row);
      });
    } else {
      document.getElementById("msg").textContent = "No outpass requests found.";
    }
  } catch (err) {
    console.error("Error loading outpasses:", err);
    document.getElementById("msg").textContent = "Something went wrong while loading data.";
  }
}

// ✅ Send location for a specific outpass
async function sendLocation(outpassId) {
  if (!navigator.geolocation) {
    return alert("Geolocation is not supported by your browser.");
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    try {
      const response = await sendRequest(`/outpass/${outpassId}/location`, "POST", { latitude, longitude }, token);
      
      if (response.message) {
        alert(response.message);
        document.getElementById("lateNotice").innerHTML = `<p class="font-semibold text-green-700">✅ Location already sent to warden.</p>`;
      } else {
        alert("❌ Error: " + (response.error || "Unknown error occurred"));
      }
    } catch (err) {
      console.error("Location submission failed", err);
      alert("Something went wrong while sending location.");
    }
  }, () => {
    alert("❌ Location access denied.");
  });
}

// ✅ Used by Late Notice Button
async function sendLocationFromLateNotice() {
  try {
    const res = await sendRequest(`/outpass/approved/${user._id}`, "GET", null, token);
    if (!res || !res.data || !Array.isArray(res.data)) {
      throw new Error('Invalid response format');
    }
    
    const outpasses = res.data;
    if (outpasses.length === 0) {
      return alert("No active outpass found.");
    }
    
    const latest = outpasses[outpasses.length - 1];
    sendLocation(latest._id);
  } catch (err) {
    console.error("Error fetching latest outpass", err);
    alert("Something went wrong.");
  }
}

// ✅ Check late return on page load
async function checkIfLateReturn() {
  try {
    const res = await sendRequest(`/outpass/approved/${user._id}`, "GET", null, token);
    if (!res || !res.data || !Array.isArray(res.data)) {
      throw new Error('Invalid response format');
    }
    
    const outpasses = res.data;
    if (outpasses.length === 0) return;
    
    const latest = outpasses[outpasses.length - 1];
    const now = new Date();
    const returnTime = new Date(latest.dateOfLeaving);
    const [hours, minutes] = latest.timeIn.split(':');
    returnTime.setHours(parseInt(hours), parseInt(minutes), 0);
    
    if (now > returnTime && !latest.returned) {
      document.getElementById("lateNotice").classList.remove("hidden");
      document.getElementById("lateNotice").style.display = "block";
    }
  } catch (err) {
    console.error("Error checking return time:", err);
  }
}

// ✅ Run these after DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  checkProfileCompletion();
  loadOutpasses();
  checkIfLateReturn();
});
