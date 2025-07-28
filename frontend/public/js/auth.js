// public/js/auth.js

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

// 🔐 LOGIN HANDLER
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

      // ⛔ Student not verified yet
      if (!res.user.isVerified && res.user.role === "student") {
        try {
          // 🔃 Send verification request
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

      // ✅ Save token and user - store _id instead of id
      const userToStore = {
        _id: res.user.id, // Convert id to _id
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

// 📝 SIGNUP HANDLER
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const collegeId = document.getElementById("collegeId").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const role = "student"; // Only students can sign up

    const res = await sendRequest("/auth/signup", "POST", {
      name,
      collegeId,
      email,
      password,
      role,
    });

    if (res.token && res.user) {
      // ✅ Save token and user with correct _id format for signup too
      const userToStore = {
        _id: res.user.id,
        name: res.user.name,
        role: res.user.role,
        isVerified: res.user.isVerified
      };
      
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(userToStore));
      
      alert("Signup successful! Please wait for warden verification.");
      window.location.href = "login.html";
    } else {
      alert(res.message || "Signup failed");
    }
  });
}

