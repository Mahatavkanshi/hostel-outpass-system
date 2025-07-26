// frontend/js/profile.js

const profileForm = document.getElementById("profileForm");
const token = localStorage.getItem("token");

if (!token) {
  alert("You are not logged in.");
  window.location.href = "index.html";
}

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const contactNumber = document.getElementById("contactNumber").value;
  const parentContact = document.getElementById("parentContact").value;
  const address = document.getElementById("address").value;
  const gender = document.getElementById("gender").value;
  const roomNumber = document.getElementById("roomNumber").value;
  const emergencyContact = document.getElementById("emergencyContact").value;

  try {
    const res = await sendRequest("/profile", "PUT", {
      contactNumber,
      parentContact,
      address,
      gender,
      roomNumber,
      emergencyContact
    }, token);

    if (res.profile) {
      document.getElementById("msg").textContent = "✅ Profile updated successfully!";
      setTimeout(() => {
        window.location.href = "outpass.html";
      }, 1000);
    } else {
      document.getElementById("msg").textContent = res.message || "Update failed.";
    }
  } catch (err) {
    console.error("Profile update error:", err);
    document.getElementById("msg").textContent = "❌ Something went wrong.";
  }
});


