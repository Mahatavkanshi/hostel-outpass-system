// public/js/wardenDashboard.js

const token = localStorage.getItem("token");

if (!token) {
  alert("You are not logged in!");
  window.location.href = "warden-login.html";
}

// ✅ Load Outpass Requests
async function loadPendingRequests() {
  const tableBody = document.getElementById("requestsTableBody");
  const msg = document.getElementById("msg");

  try {
    const res = await sendRequest("/outpass/pending", "GET", null, token);

    if (!Array.isArray(res) || res.length === 0) {
      msg.textContent = "No pending outpass requests.";
      return;
    }

    tableBody.innerHTML = "";

    res.forEach(request => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${request.userId.name}</td>
        <td>${request.userId.collegeId}</td>
        <td>${request.userId.email}</td>
        <td>${request.reason}</td>
        <td>${request.placeOfVisit}</td>
        <td>${new Date(request.dateOfLeaving).toLocaleDateString()}</td>
        <td>${request.timeOut}</td>
        <td>${request.timeIn}</td>
        <td>${request.emergencyContact}</td>
        <td>
          <button onclick="updateStatus('${request._id}', 'approved')" class="text-green-600 hover:underline">Approve</button>
          <button onclick="updateStatus('${request._id}', 'rejected')" class="text-red-600 hover:underline ml-2">Reject</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  } catch (err) {
    console.error("Error loading requests:", err);
    msg.textContent = "Failed to load pending requests.";
  }
}

// ✅ Approve/Reject Outpass
async function updateStatus(requestId, status) {
  const remarks = prompt(`Add any remarks for ${status} (optional):`) || "";

  try {
    const res = await sendRequest(`/outpass/${requestId}`, "PUT", { status, remarks }, token);
    alert(res.message);
    loadPendingRequests();
  } catch (err) {
    console.error("Error updating status:", err);
    alert("Failed to update status.");
  }
}

// ✅ Load Student Verification Requests (✅ FIXED ENDPOINT)
async function loadPendingVerifications() {
  const verifyBody = document.getElementById("verificationTableBody");
  const verifyMsg = document.getElementById("verifyMsg");

  try {
    const res = await sendRequest("/verification/pending", "GET", null, token); // 🔧 Fixed endpoint

    if (!Array.isArray(res) || res.length === 0) {
      verifyMsg.textContent = "No pending student verifications.";
      return;
    }

    verifyBody.innerHTML = "";

    res.forEach(request => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${request.userId.name}</td>
        <td>${request.userId.collegeId}</td>
        <td>${request.userId.email}</td>
        <td>
          <button onclick="handleVerification('${request._id}', 'approved')" class="text-green-600 hover:underline">Approve</button>
          <button onclick="handleVerification('${request._id}', 'rejected')" class="text-red-600 hover:underline ml-2">Reject</button>
        </td>
      `;
      verifyBody.appendChild(row);
    });
  } catch (err) {
    console.error("Error loading verifications:", err);
    verifyMsg.textContent = "Failed to load verification requests.";
  }
}

// ✅ Approve/Reject Verification (✅ FIXED ENDPOINT)
async function handleVerification(requestId, status) {
  const remarks = prompt(`Add remarks for ${status}:`) || "";

  try {
    const res = await sendRequest(`/verification/${requestId}`, "PUT", { status, remarks }, token); // 🔧 Fixed endpoint
    alert(res.message);
    loadPendingVerifications();
  } catch (err) {
    console.error("Verification update failed:", err);
    alert("Failed to update verification.");
  }
}

// ✅ Load Late Students' Locations
async function loadLateStudents() {
  const tableBody = document.getElementById("lateStudentsBody");

  try {
    console.log('🔍 Loading late students...');
    const res = await sendRequest("/outpass/late-locations", "GET", null, token);

    console.log('📊 Late students response:', res);

    if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-2 text-gray-500">No late students found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = "";

    res.data.forEach(entry => {
      const row = document.createElement("tr");
      
      row.innerHTML = `
        <td class="border p-2">${entry.userId?.name || "N/A"}</td>
        <td class="border p-2">${entry.userId?.collegeId || "N/A"}</td>
        <td class="border p-2">${entry.userId?.email || "N/A"}</td>
        <td class="border p-2">${entry.latitude || "N/A"}</td>
        <td class="border p-2">${entry.longitude || "N/A"}</td>
        <td class="border p-2">${entry.capturedAt ? new Date(entry.capturedAt).toLocaleString() : "N/A"}</td>
      `;

      tableBody.appendChild(row);
    });

    console.log(`✅ Loaded ${res.data.length} late students`);
  } catch (err) {
    console.error("❌ Error loading late students:", err);
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500">Error loading data: ${err.message}</td></tr>`;
  }
}
async function loadTodayOutpasses() {
  const tableBody = document.getElementById("todayOutpassBody");
  const msg = document.getElementById("todayMsg");

  try {
    const res = await sendRequest("/outpass/today", "GET", null, token);

    // 🔥 Use res.data instead of res
    if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
      msg.textContent = "No students with outpass today.";
      return;
    }

    tableBody.innerHTML = "";
    res.data.forEach(outpass => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${outpass.userId?.name || "N/A"}</td>
        <td>${outpass.userId?.collegeId || "N/A"}</td>
        <td>${outpass.userId?.email || "N/A"}</td>
        <td>
          <button onclick="openChat('${outpass.userId._id}')" 
            class="bg-blue-500 text-white px-3 py-1 rounded">
            Chat
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  } catch (err) {
    console.error("Error loading today outpasses:", err);
    msg.textContent = "Failed to load students.";
  }
}


// Call it on page load
loadTodayOutpasses();
// ===============================
// Warden Dashboard JS
// ===============================
// ===============================
// Warden Dashboard Chat (WebSocket)
// ===============================

let ws = null;
let currentChatStudentId = null;

function openChat(studentId) {
  currentChatStudentId = studentId;

  // Show the chat panel and focus input
  const panel = document.getElementById("chatPanel");
  const input = document.getElementById("chatInput");
  panel.classList.remove("hidden");
  input.focus();

  // Close any existing socket
  try { ws && ws.close(); } catch (_) {}

  // Pick the right WS URL for local vs prod
  const WS_BASE =
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "ws://localhost:5000/ws"
      : "wss://hostel-outpass-system.onrender.com/ws";

  // Connect with role=warden and the selected studentId
  ws = new WebSocket(`${WS_BASE}?role=warden&studentId=${studentId}`);

  ws.onopen = () => {
    console.log("✅ WS connected as warden for student:", studentId);
  };

  ws.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);

    if (msg.from === "student") {
      appendWardenMessage("Student", msg.text, "incoming");
    } else if (msg.from === "warden") {
      console.log("Ignoring self-echo");
    }
  } catch (e) {
    console.warn("Non-JSON WS message:", event.data);
  }
};

  ws.onerror = (e) => {
    console.error("❌ WS error", e);
  };

  ws.onclose = () => {
    console.warn("⚠️ WS closed");
  };
}

// Send message from warden
function sendWardenChat() {
  const input = document.getElementById("chatInput");
  const text = (input.value || "").trim();
  if (!text) return;

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    alert("Chat is not connected.");
    return;
  }

  // Send JSON payload; server forwards it to the student for this studentId
  ws.send(JSON.stringify({ text }));

  appendWardenMessage("You", text, "outgoing");
  input.value = "";
}

// Render bubbles in the warden chat panel
function appendWardenMessage(sender, text, type = "incoming") {
  const chatBox = document.getElementById("chatBox");

  const wrap = document.createElement("div");
  wrap.className = type === "outgoing" ? "flex justify-end mb-2" : "flex justify-start mb-2";

  const bubble = document.createElement("div");
  bubble.className = `max-w-[75%] px-3 py-2 rounded text-sm shadow ${
    type === "outgoing"
      ? "bg-blue-600 text-white rounded-br-none"
      : "bg-gray-200 text-gray-900 rounded-bl-none"
  }`;

  bubble.innerHTML = `<span class="block text-[11px] opacity-70 mb-0.5">${sender}</span><div>${escapeHtml(text)}</div>`;

  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

// Wire buttons/Enter key (after DOM is ready)
document.addEventListener("DOMContentLoaded", () => {
  const sendBtn = document.getElementById("sendWardenBtn") || document.querySelector("button[onclick='sendWardenChat()']");
  const input = document.getElementById("chatInput");
  const closeBtn = document.getElementById("closeChatBtn");

  // Send button
  if (sendBtn) {
    sendBtn.addEventListener("click", sendWardenChat);
  }

  // Enter to send
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendWardenChat();
    }
  });

  // Close panel
  closeBtn?.addEventListener("click", () => {
    document.getElementById("chatPanel").classList.add("hidden");
    try { ws && ws.close(); } catch (_) {}
    ws = null;
    currentChatStudentId = null;
    document.getElementById("chatBox").innerHTML = "";
  });
});


// ===============================
// Close Chat Panel
// ===============================
document
  .getElementById("closeChatBtn")
  .addEventListener("click", () => {
    document.getElementById("chatPanel").classList.add("hidden");
    try {
      if (socket) socket.disconnect();
    } catch (_) {}
    socket = null;
    currentChatStudentId = null;
  });

// ===============================
// Send Message on Enter Key
// ===============================
document
  .getElementById("chatInput")
  .addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      sendWardenChat();
    }
  });





// ✅ Logout
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "warden-login.html";
}

// ✅ Initial Load
loadPendingRequests();
loadPendingVerifications();
loadLateStudents();








