// frontend/js/warden-login.js

const loginForm = document.getElementById("loginForm");
const msg = document.getElementById("msg");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await sendRequest("/auth/login", "POST", { email, password });

    if (res.success && res.user.role === "warden") {
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));

      msg.textContent = "Login successful!";
      msg.style.color = "green";

      setTimeout(() => {
        window.location.href = "warden-dashboard.html";
      }, 1000);
    } else {
      msg.textContent = res.message || "Login failed or not a warden.";
      msg.style.color = "red";
    }
  } catch (err) {
    console.error("Login error:", err);
    msg.textContent = "Something went wrong.";
    msg.style.color = "red";
  }
});
