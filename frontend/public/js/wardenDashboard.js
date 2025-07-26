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

// ✅ Logout
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "warden-login.html";
}

// ✅ Initial Load
loadPendingRequests();
loadPendingVerifications();









