// public/js/auth.js

// KEEP existing login handler (unchanged)
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

// LOGIN HANDLER (unchanged)
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const role = document.getElementById("role")?.value || "student";

    const res = await sendRequest("/auth/login", "POST", { email, password });

    if (res.token && res.user) {
      if (res.user.role !== role) {
        alert(`Role mismatch! You tried to log in as ${role}, but your account is ${res.user.role}`);
        return;
      }

      if (!res.user.isVerified && res.user.role === "student") {
        try {
          const verifyRes = await sendRequest("/verification", "POST", null, res.token);
          if (verifyRes.message === "Request already submitted") {
            alert("Your account is not verified yet. Verification already submitted.");
          } else if (verifyRes.message === "Verification request sent") {
            alert("Verification request sent to warden. Please wait for approval.");
          } else {
            alert("Verification process failed. Please contact support.");
          }
        } catch (err) {
          console.error("Verification request error:", err);
          alert("Error sending verification request.");
        }
        return;
      }

      const userToStore = {
        _id: res.user.id,
        name: res.user.name,
        role: res.user.role,
        isVerified: res.user.isVerified
      };

      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(userToStore));

      alert("Login successful!");
      if (res.user.role === "student") {
        window.location.href = "student-dashboard.html";
      } else {
        window.location.href = "warden-dashboard.html";
      }
    } else {
      alert(res.message || "Login failed");
    }
  });
}

/* ---------------------------
  SIGNUP + FACE CAPTURE LOGIC
   Captures descriptors and sends them to backend as JSON
   --------------------------- */

if (signupForm) {
  // Model path relative to this signup.html (Live Server serves the public folder)
  const MODEL_URL = './models'; // make sure models are in frontend/public/models

  // UI elements
  const video = document.getElementById('video');
  const startCameraBtn = document.getElementById('startCameraBtn');
  const captureBtn = document.getElementById('captureBtn');
  const resetCaptureBtn = document.getElementById('resetCaptureBtn');
  const countSpan = document.getElementById('count');
  const captureStatus = document.getElementById('captureStatus');
  const msgEl = document.getElementById('msg');

  let stream = null;
  let capturedDescriptors = []; // Array of [128 floats] arrays
  const REQUIRED_CAPTURES = 3;  // recommended captures for robustness
  let modelsLoaded = false;

  // Load models (called once)
  async function loadModels() {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      modelsLoaded = true;
      console.log('face-api models loaded');
    } catch (err) {
      console.error('Failed to load models:', err);
      alert('Failed to load face recognition models. Check models folder and console.');
    }
  }

  // Start camera
  async function startCamera() {
    if (!modelsLoaded) {
      await loadModels();
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      console.error('Camera error', err);
      alert('Cannot access camera: ' + err.message);
    }
  }

  // Capture a face descriptor from current video frame
  async function captureFaceDescriptor() {
    if (!modelsLoaded) {
      await loadModels();
    }
    if (!stream) {
      alert('Start camera first.');
      return;
    }

    // detect single face and get descriptor
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      alert('No face detected. Ensure your face is fully visible and well-lit.');
      return;
    }

    // store descriptor as plain array
    const descriptorArray = Array.from(detection.descriptor);
    capturedDescriptors.push(descriptorArray);
    countSpan.textContent = capturedDescriptors.length;

    if (capturedDescriptors.length >= REQUIRED_CAPTURES) {
      captureStatus.textContent = `Captured ${capturedDescriptors.length}/${REQUIRED_CAPTURES} — enough samples collected.`;
      captureBtn.disabled = true;
    } else {
      captureStatus.textContent = `Captured ${capturedDescriptors.length}/${REQUIRED_CAPTURES}`;
    }
  }

  // Reset captures
  function resetCaptures() {
    capturedDescriptors = [];
    countSpan.textContent = '0';
    captureBtn.disabled = false;
    captureStatus.textContent = `Captured: 0/${REQUIRED_CAPTURES}`;
  }

  // Wire up buttons
  startCameraBtn?.addEventListener('click', async () => {
    await startCamera();
  });
  captureBtn?.addEventListener('click', async () => {
    await captureFaceDescriptor();
  });
  resetCaptureBtn?.addEventListener('click', () => {
    resetCaptures();
  });

  // Form submit -> send descriptors to backend
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // basic fields
    const name = document.getElementById("name").value.trim();
    const collegeId = document.getElementById("collegeId").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const role = document.getElementById("role")?.value || 'student';

    // require at least one descriptor (recommended 3). Adjust if you prefer more flexible.
    if (!capturedDescriptors || capturedDescriptors.length < 1) {
      alert('Please capture at least 1 face sample (recommended 3) before signup.');
      return;
    }

    try {
      // POST JSON with descriptors
      const res = await fetch('http://localhost:5000/api/auth/signup-descriptor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          collegeId,
          email,
          password,
          role,
          descriptors: capturedDescriptors
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} - ${text}`);
      }

      const data = await res.json();
      if (data.token && data.user) {
        const userToStore = {
          _id: data.user._id || data.user.id,
          name: data.user.name,
          role: data.user.role,
          isVerified: data.user.isVerified
        };
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(userToStore));

        alert('Signup successful! Please wait for warden verification.');
        window.location.href = "login.html";
      } else {
        alert(data.message || 'Signup failed');
      }
    } catch (err) {
      console.error('Signup error:', err);
      alert('Error during signup. Check console for details.');
    }
  });

  // Pre-load models so user can start camera quickly
  window.addEventListener('load', () => {
    // do not block UI; attempt to warm models
    loadModels().catch(e => console.warn('model warm up failed', e));
    resetCaptures();
  });
}
