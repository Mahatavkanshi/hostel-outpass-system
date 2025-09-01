// public/js/wardenDashboard.js

const token = localStorage.getItem("token");

if (!token) {
  alert("You are not logged in!");
  window.location.href = "warden-login.html";
}

// ✅ Load Outpass Requests
async function loadPendingRequests() {
  console.log("loading pending request function m h");
  const tableBody = document.getElementById("requestsTableBody");
  const msg = document.getElementById("msg");

  try {
    console.log("in try block: for sending request")
    const res = await sendRequest("/outpass/pending", "GET", null, token);

    if (!Array.isArray(res) || res.length === 0) {
      msg.textContent = "No pending outpass requests.";
      console.log("array response ka khali hai, no pending req");
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
  console.log("in loadpendingVerification function");
  const verifyBody = document.getElementById("verificationTableBody");
  const verifyMsg = document.getElementById("verifyMsg");

  try {
    console.log("in try catch block")
    const res = await sendRequest("/verification/pending", "GET", null, token); // 🔧 Fixed endpoint
    console.log("pending student verification responses: ", res);

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

// ------------------ VIDEO CALL ------------------
let pc;             // RTCPeerConnection
let localStream;    // camera/mic stream
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const videoModal = document.getElementById("videoCallModal");

document.getElementById("startVideoCallBtn")?.addEventListener("click", async () => {
  await startVideoCall();
});

document.getElementById("endCallBtn")?.addEventListener("click", () => {
  endCall();
});

async function startVideoCall() {
  try {
    videoModal.classList.remove("hidden");

    // 1. get camera + mic
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    // 2. setup peer connection
    pc = new RTCPeerConnection();

    // push local tracks
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // receive remote
    pc.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };

    // ice candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({
          type: "ice",
          candidate: event.candidate,
        }));
      }
    };

    // 3. create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // send offer to student
    ws.send(JSON.stringify({
      type: "offer",
      offer: offer,
    }));
  } catch (err) {
    console.error("video call error", err);
    alert("Could not start video: " + err.message);
    endCall();
  }
}

async function handleOffer(offer) {
  videoModal.classList.remove("hidden");

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  pc = new RTCPeerConnection();
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({
        type: "ice",
        candidate: event.candidate,
      }));
    }
  };

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  ws.send(JSON.stringify({
    type: "answer",
    answer: answer,
  }));
}

async function handleAnswer(answer) {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

async function handleIce(candidate) {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error("ICE add error", err);
  }
}

function endCall() {
  videoModal.classList.add("hidden");
  if (pc) {
    pc.close();
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;

  // tell peer call ended (optional)
  ws.send(JSON.stringify({ type: "endCall" }));
}

// 🔹 extend existing ws.onmessage to handle signaling
const oldWardenOnMsg = ws.onmessage;
ws.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);

    if (msg.type === "offer") {
      handleOffer(msg.offer);
    } else if (msg.type === "answer") {
      handleAnswer(msg.answer);
    } else if (msg.type === "ice") {
      handleIce(msg.candidate);
    } else if (msg.type === "endCall") {
      endCall();
    } else {
      // fallback to chat handler
      if (oldWardenOnMsg) oldWardenOnMsg(event);
    }
  } catch (err) {
    console.error("invalid signaling msg", err);
  }
};







