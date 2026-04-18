import { setupRevealAnimations } from "./shared-ui.js";

const feedbackEl = document.querySelector("#admin-login-feedback");
const formEl = document.querySelector("#admin-login-form");

function setFeedback(message, type = "error") {
  if (!message) {
    feedbackEl.className = "form-feedback is-hidden";
    feedbackEl.textContent = "";
    return;
  }

  feedbackEl.className = `form-feedback form-feedback-${type}`;
  feedbackEl.textContent = message;
}

async function checkSession() {
  const response = await fetch("/api/admin-session", { credentials: "same-origin" });
  const result = await response.json();

  if (result.authenticated) {
    window.location.replace("/admin/");
  }
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFeedback("");

  const submitButton = formEl.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Ingresando...";

  try {
    const response = await fetch("/api/admin-login", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier: document.querySelector("#admin-identifier").value.trim(),
        password: document.querySelector("#admin-password").value,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "No se pudo iniciar sesión");
    }

    window.location.replace("/admin/");
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Ingresar";
  }
});

checkSession().catch(() => {});
setupRevealAnimations();
