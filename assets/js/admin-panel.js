import { setupRevealAnimations } from "./shared-ui.js";

const state = {
  page: 1,
  pageSize: 10,
  query: "",
  totalPages: 1,
};

const bodyEl = document.querySelector("#admin-clients-body");
const feedbackEl = document.querySelector("#admin-panel-feedback");
const statsTotalEl = document.querySelector("#stats-total");
const statsPageEl = document.querySelector("#stats-page");
const paginationTextEl = document.querySelector("#admin-pagination-text");
const prevEl = document.querySelector("#admin-prev");
const nextEl = document.querySelector("#admin-next");
const searchInputEl = document.querySelector("#admin-search");

function setFeedback(message, type = "error") {
  if (!message) {
    feedbackEl.className = "form-feedback is-hidden";
    feedbackEl.textContent = "";
    return;
  }

  feedbackEl.className = `form-feedback form-feedback-${type}`;
  feedbackEl.textContent = message;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function renderClients(items) {
  if (!items.length) {
    bodyEl.innerHTML = `
      <tr>
        <td colspan="5">No encontramos clientes para esa búsqueda.</td>
      </tr>
    `;
    return;
  }

  bodyEl.innerHTML = items
    .map(
      (client) => `
        <tr>
          <td>
            <strong>${client.nombre}</strong>
            <span class="table-subtext">#${client.id}</span>
          </td>
          <td>
            <span>${client.email}</span>
            <span class="table-subtext">${client.telefono}</span>
          </td>
          <td>
            <span class="table-badge">${client.tipo_proyecto}</span>
            <span class="table-subtext">${client.solucion}</span>
          </td>
          <td>${formatDate(client.created_at)}</td>
          <td>
            <div class="table-actions">
              <button class="button button-secondary js-email-reminder" type="button" data-id="${client.id}">
                Enviar email recordatorio
              </button>
              <button class="button button-secondary js-wpp-reminder" type="button" data-id="${client.id}">
                Enviar WPP recordatorio
              </button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");

  bodyEl.querySelectorAll(".js-email-reminder").forEach((button) => {
    button.addEventListener("click", () => sendReminder("/api/send-email-reminder", button.dataset.id, button));
  });

  bodyEl.querySelectorAll(".js-wpp-reminder").forEach((button) => {
    button.addEventListener("click", () => sendReminder("/api/send-whatsapp-reminder", button.dataset.id, button));
  });
}

async function requireSession() {
  const response = await fetch("/api/admin-session", { credentials: "same-origin" });
  const result = await response.json();

  if (!result.authenticated) {
    window.location.replace("/admin/login/");
    return false;
  }

  return true;
}

async function loadClients() {
  setFeedback("");
  bodyEl.innerHTML = `
    <tr>
      <td colspan="5">Cargando clientes...</td>
    </tr>
  `;

  const params = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.pageSize),
  });

  if (state.query) {
    params.set("q", state.query);
  }

  try {
    const response = await fetch(`/api/list-clients?${params.toString()}`, {
      credentials: "same-origin",
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "No se pudieron cargar los clientes");
    }

    renderClients(result.items);
    state.page = result.pagination.page;
    state.totalPages = result.pagination.totalPages;
    statsTotalEl.textContent = String(result.pagination.total);
    statsPageEl.textContent = String(result.pagination.page);
    paginationTextEl.textContent = `Página ${result.pagination.page} de ${result.pagination.totalPages}`;
    prevEl.disabled = result.pagination.page <= 1;
    nextEl.disabled = result.pagination.page >= result.pagination.totalPages;
  } catch (error) {
    bodyEl.innerHTML = `
      <tr>
        <td colspan="5">No pudimos cargar el panel.</td>
      </tr>
    `;
    setFeedback(error.message, "error");
  }
}

async function sendReminder(endpoint, clientId, button) {
  setFeedback("");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Enviando...";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clientId }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "No se pudo enviar el recordatorio");
    }

    setFeedback("Recordatorio enviado correctamente.", "success");
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

document.querySelector("#admin-search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.page = 1;
  state.query = searchInputEl.value.trim();
  loadClients();
});

document.querySelector("#admin-refresh").addEventListener("click", () => loadClients());

document.querySelector("#admin-logout").addEventListener("click", async () => {
  await fetch("/api/admin-logout", {
    method: "POST",
    credentials: "same-origin",
  });

  window.location.replace("/admin/login/");
});

prevEl.addEventListener("click", () => {
  if (state.page <= 1) {
    return;
  }

  state.page -= 1;
  loadClients();
});

nextEl.addEventListener("click", () => {
  if (state.page >= state.totalPages) {
    return;
  }

  state.page += 1;
  loadClients();
});

(async () => {
  const ok = await requireSession();

  if (ok) {
    await loadClients();
  }
})().catch(() => {
  window.location.replace("/admin/login/");
});

setupRevealAnimations();
