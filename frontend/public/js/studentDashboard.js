// ✅ Load token and user info once
const token = localStorage.getItem("token");
// const ws = new WebSocket("ws://localhost:5000/ws");
// let ws = null;

// choose proper WS base depending on local vs deployed
const WS_BASE =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "ws://localhost:5000/ws"
    : "wss://hostel-outpass-system.onrender.com/ws";

  

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

        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="py-2 px-4 border-b">${new Date(req.dateOfLeaving).toLocaleDateString()}</td>
          <td class="py-2 px-4 border-b">${req.timeOut}</td>
          <td class="py-2 px-4 border-b">${req.timeIn}</td>
          <td class="py-2 px-4 border-b">${req.placeOfVisit}</td>
          <td class="py-2 px-4 border-b">${req.reason}</td>
          <td class="py-2 px-4 border-b">${req.status}</td>
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

// // ✅ Send location for a specific outpass
async function sendLocation(outpassId) {
  if (!navigator.geolocation) {
    return alert("Geolocation is not supported by your browser.");
  }

  console.log('📍 Attempting to send location for outpass:', outpassId);

  navigator.geolocation.getCurrentPosition(async (position) => {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    console.log('📍 Got location:', { latitude, longitude });

    try {
      const response = await sendRequest(`/outpass/${outpassId}/location`, "POST", { latitude, longitude }, token);
      
      console.log('📍 Location submission response:', response);
      
      if (response.message) {
        alert(response.message);
        if (response.message.includes("already logged")) {
          document.getElementById("lateNotice").innerHTML = `<p class="font-semibold text-green-700">✅ Location already sent to warden.</p>`;
        } else if (response.message.includes("late")) {
          document.getElementById("lateNotice").innerHTML = `<p class="font-semibold text-red-700">⚠️ You are late! Location sent to warden.</p>`;
        } else {
          document.getElementById("lateNotice").innerHTML = `<p class="font-semibold text-green-700">✅ Location recorded successfully.</p>`;
        }
      } else {
        alert("❌ Error: " + (response.error || "Unknown error occurred"));
      }
    } catch (err) {
      console.error("❌ Location submission failed", err);
      alert("❌ Failed to send location: " + err.message);
    }
  }, (error) => {
    console.error("❌ Geolocation error:", error);
    alert("❌ Location access denied or unavailable.");
  }, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000
  });
}

// ✅ Used by Late Notice Button
async function sendLocationFromLateNotice() {
  try {
    const res = await sendRequest(`/outpass/approved/${user._id}`, "GET", null, token);
    
    // Handle 404 case (no approved outpasses found)
    if (res.message && res.message.includes('No approved outpasses found')) {
      return alert("No active outpass found.");
    }
    
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
    
    // Handle 404 case (no approved outpasses found)
    if (res.message && res.message.includes('No approved outpasses found')) {
      return;
    }
    
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
    
    if (now > returnTime && !latest.isReturn) {
      document.getElementById("lateNotice").classList.remove("hidden");
      document.getElementById("lateNotice").style.display = "block";
    }
  } catch (err) {
    console.error("Error checking return time:", err);
  }
}




// ---------- NEW: Mark Return flow (face + GPS) ----------

const MODEL_URL = './models'; // relative to signup/dashboard page (frontend/public/models)
let modelsLoadedForReturn = false;
let returnStream = null;
let capturedReturnDescriptors = []; // array of descriptors captured in this session
const REQUIRED_MIN_CAPTURE = 1; // require at least 1 capture; 2-3 recommended for better results

async function loadFaceApiModelsForReturn() {
  if (modelsLoadedForReturn) return;
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    modelsLoadedForReturn = true;
    console.log('✅ face-api models loaded for return flow');
  } catch (err) {
    console.error('Failed to load face-api models (return flow):', err);
    throw err;
  }
}

// create and show modal, start camera
async function openReturnModal() {
  // show modal
  const modal = document.getElementById('returnModal');
  const video = document.getElementById('returnVideo');
  const status = document.getElementById('returnStatus');
  capturedReturnDescriptors = [];
  status.textContent = 'Starting camera...';

  modal.classList.remove('hidden');
  modal.classList.add('flex'); // make it flex container (centered)

  // load models (non-blocking but wait to start detection)
  try {
    await loadFaceApiModelsForReturn();
  } catch (err) {
    status.textContent = 'Failed to load face models. Check console.';
    return;
  }

  // start camera
  try {
    returnStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    video.srcObject = returnStream;
    await video.play();
    status.textContent = 'Camera started — position your face and press Capture.';
  } catch (err) {
    console.error('Camera start failed:', err);
    status.textContent = 'Cannot access camera: ' + err.message;
  }
}

// capture descriptor from currently playing video
async function captureDescriptorFromReturnVideo() {
  const video = document.getElementById('returnVideo');
  const status = document.getElementById('returnStatus');

  if (!modelsLoadedForReturn) {
    status.textContent = 'Models not loaded yet.';
    return;
  }
  if (!video || !video.srcObject) {
    status.textContent = 'Camera not started. Press Start/Mark Returned first.';
    return;
  }

  status.textContent = 'Detecting face...';

  try {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      status.textContent = 'No face detected. Ensure your face is centered and well lit.';
      return;
    }

    // convert Float32Array -> regular array for JSON transport
    const descArray = Array.from(detection.descriptor);
    capturedReturnDescriptors.push(descArray);
    status.textContent = `Captured ${capturedReturnDescriptors.length} sample(s). You can capture up to 3.`;

    // disable capture button if we've got enough (optional)
    if (capturedReturnDescriptors.length >= 3) {
      document.getElementById('returnCaptureBtn').disabled = true;
    }
  } catch (err) {
    console.error('Descriptor capture error', err);
    status.textContent = 'Error capturing face: ' + err.message;
  }
}

// stop camera & hide modal
function closeReturnModal() {
  const modal = document.getElementById('returnModal');
  const video = document.getElementById('returnVideo');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  // stop tracks
  if (returnStream) {
    returnStream.getTracks().forEach(t => t.stop());
    returnStream = null;
  }
  // clear video src
  if (video) {
    try { video.pause(); } catch(e){}
    video.srcObject = null;
  }
  // reset capture UI
  capturedReturnDescriptors = [];
  document.getElementById('returnCaptureBtn').disabled = false;
  document.getElementById('returnStatus').textContent = '';
}

// get current geolocation (promisified)
function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });
}

// submit return: sends descriptors + lat/lng to backend
async function submitReturn() {
  const status = document.getElementById('returnStatus');
  status.textContent = 'Preparing data...';

  // validate captures
  if (!capturedReturnDescriptors || capturedReturnDescriptors.length < REQUIRED_MIN_CAPTURE) {
    status.textContent = `Please capture at least ${REQUIRED_MIN_CAPTURE} sample(s) before submitting.`;
    return;
  }

  // fetch latest approved outpass for this student (same as your other function)
  let approvedResp;
  try {
    approvedResp = await sendRequest(`/outpass/approved/${user._id}`, "GET", null, token);
  } catch (err) {
    console.error('Error fetching approved outpasses', err);
    status.textContent = 'Failed to fetch approved outpass. Try again.';
    return;
  }

  if (!approvedResp || !approvedResp.data || !Array.isArray(approvedResp.data) || approvedResp.data.length === 0) {
    status.textContent = 'No approved outpass found to mark returned.';
    return;
  }

  const latestApproved = approvedResp.data[approvedResp.data.length - 1];
  const approvedId = latestApproved._id; // this is the ApprovedOutpass id

  status.textContent = 'Getting GPS location...';

  // get geolocation
  let position;
  try {
    const pos = await getCurrentLocation();
    position = pos.coords;
  } catch (err) {
    console.error('Geolocation failed', err);
    status.textContent = 'Location error: ' + (err.message || 'permission denied');
    return;
  }

  status.textContent = 'Sending verification to server...';

  // assemble payload
  const payload = {
    descriptors: capturedReturnDescriptors,
    lat: position.latitude,
    lng: position.longitude,
    accuracy: position.accuracy,
    clientTime: new Date().toISOString()
  };

  // send to backend endpoint (full URL to avoid client-side base path issues)
  try {
    const res = await fetch(`http://localhost:5000/api/outpass/approved/${approvedId}/mark-return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Server rejected return:', data);
      status.textContent = data.message || 'Return failed: ' + (data.error || res.statusText);
      return;
    }

    // success
    status.textContent = `Returned! Face score: ${data.faceScore?.toFixed(3)}; distance: ${data.distanceMeters?.toFixed(1)} m.`;
    // update UI: reload outpasses to show status change
    await loadOutpasses();
    // hide modal after short delay
    setTimeout(() => {
      closeReturnModal();
      document.getElementById('returnMsg').textContent = 'Return marked successfully.';
    }, 1200);
  } catch (err) {
    console.error('Submit return error', err);
    status.textContent = 'Failed to submit return: ' + err.message;
  }
}

// wire modal buttons and main Mark button
function attachReturnUIHandlers() {
  const markBtn = document.getElementById('markReturnBtn');
  const captureBtn = document.getElementById('returnCaptureBtn');
  const submitBtn = document.getElementById('returnSubmitBtn');
  const cancelBtn = document.getElementById('returnCancelBtn');

  markBtn?.addEventListener('click', openReturnModal);
  captureBtn?.addEventListener('click', captureDescriptorFromReturnVideo);
  submitBtn?.addEventListener('click', submitReturn);
  cancelBtn?.addEventListener('click', closeReturnModal);
}

function toggleChat() {
  const sidebar = document.getElementById("chatSidebar");
  sidebar.classList.toggle("translate-x-full");
}




// ✅ Run these after DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  attachReturnUIHandlers();
  checkProfileCompletion();
  loadOutpasses();
  checkIfLateReturn();

    // --- WebSocket: student<->warden realtime chat ---
  const currentUser = JSON.parse(localStorage.getItem("user"));
  const studentId = currentUser?._id;
  const chatMessagesEl = document.getElementById("chatMessages");
  const chatInputEl = document.getElementById("chatInput");
  const sendBtnEl = document.getElementById("sendChatBtn");

  // connect to the backend WS path `/ws`
  window.ws = new WebSocket(`${WS_BASE}?role=student&studentId=${studentId}`);

  ws.onopen = () => {
    console.log("✅ WS connected");
  };

  ws.onerror = (e) => {
    console.error("❌ WS error", e);
  };

  ws.onclose = () => {
    console.warn("⚠️ WS closed");
  };

ws.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);

    if (msg.from === "warden") {
      // show warden’s reply
      appendMessage("Warden", msg.text, "incoming");
    } else if (msg.from === "student" && msg.studentId === studentId) {
      // ignore echo of my own message (optional)
      console.log("Ignoring self-echo");
    }
  } catch (e) {
    console.error("Invalid WS payload", e);
  }
};


  function appendMessage(sender, text, type = 'incoming') {
    const wrap = document.createElement("div");
    wrap.className = `flex ${type === 'outgoing' ? 'justify-end' : 'justify-start'}`;

    const bubble = document.createElement("div");
    bubble.className = `max-w-[75%] px-3 py-2 rounded text-sm shadow ${
      type === 'outgoing' 
      ? 'bg-blue-600 text-white rounded-br-none' 
      : 'bg-gray-200 text-gray-900 rounded-bl-none'
    }`;
    bubble.innerHTML = `<span class="block text-[11px] opacity-80">${sender}</span><div>${escapeHtml(text)}</div>`;

    wrap.appendChild(bubble);
    chatMessagesEl.appendChild(wrap);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  function sendChat() {
    const text = (chatInputEl.value || '').trim();
    if (!text) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("WS not open; cannot send");
      return;
    }
    ws.send(JSON.stringify({ text }));
    appendMessage('You', text, 'outgoing');
    chatInputEl.value = '';
  }

  sendBtnEl?.addEventListener("click", sendChat);
  chatInputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChat();
    }
  });

  // 🔹 Chat open/close (you already had this)
  document.getElementById("chatWithWardenBtn")?.addEventListener("click", () => {
    document.getElementById("chatSidebar").classList.remove("hidden");
    setTimeout(() => chatInputEl?.focus(), 50);
  });

  document.getElementById("closeChatBtn")?.addEventListener("click", () => {
    document.getElementById("chatSidebar").classList.add("hidden");
  });
});



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

    // send offer to warden via ws
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
ws.onmessage = async (event) => {
  try {
    const msg = JSON.parse(event.data);

    // --- signaling messages for video call ---
    if (msg.type === "offer") {
      await handleOffer(msg.offer);
    } else if (msg.type === "answer") {
      await handleAnswer(msg.answer);
    } else if (msg.type === "ice") {
      await handleIce(msg.candidate);
    } else if (msg.type === "endCall") {
      endCall();
    }

    // --- chat messages ---
    else if (msg.type === "chat") {
      if (msg.from === "warden") {
        appendMessage("Warden", msg.text, "incoming");
      } else if (msg.from === "student" && msg.studentId === studentId) {
        console.log("Ignoring self-echo");
      }
    }

  } catch (err) {
    console.error("Invalid WS message", err);
  }
};
