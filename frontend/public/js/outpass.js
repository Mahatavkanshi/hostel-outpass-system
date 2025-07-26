// public/js/outpass.js

const form = document.getElementById("outpassForm");
const msg = document.getElementById("msg");

// Check token first
const token = localStorage.getItem("token");
if (!token) {
  alert("Please login first.");
  window.location.href = "index.html";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    dateOfLeaving: document.getElementById("dateOfLeaving").value,
    timeOut: document.getElementById("timeOut").value,
    timeIn: document.getElementById("timeIn").value,
    placeOfVisit: document.getElementById("placeOfVisit").value.trim(),
    reason: document.getElementById("reason").value.trim(),
    emergencyContact: document.getElementById("emergencyContact").value.trim()
  };

  try {
    const res = await sendRequest("/outpass", "POST", data, token);

    if (res && res.message) {
      msg.style.color = "green";
      msg.textContent = res.message;
      form.reset();
    } else {
      msg.style.color = "red";
      msg.textContent = res.message || "Something went wrong";
    }
  } catch (err) {
    console.error(err);
    msg.style.color = "red";
    msg.textContent = "Failed to submit request.";
  }
});



