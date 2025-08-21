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








