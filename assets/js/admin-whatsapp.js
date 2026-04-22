import { setupRevealAnimations } from "./shared-ui.js";

const state = {
  page: 1,
  pageSize: 25,
  query: "",
  unreadOnly: false,
  totalPages: 1,
  conversations: [],
  selectedConversationId: null,
  sessionUser: null,
};

const feedbackEl = document.querySelector("#whatsapp-panel-feedback");
const listEl = document.querySelector("#whatsapp-conversation-list");
const messagesEl = document.querySelector("#whatsapp-messages");
const searchInputEl = document.querySelector("#whatsapp-search");
const unreadCheckboxEl = document.querySelector("#whatsapp-only-unread");
const paginationTextEl = document.querySelector("#whatsapp-pagination-text");
const prevEl = document.querySelector("#whatsapp-prev");
const nextEl = document.querySelector("#whatsapp-next");
const statsTotalEl = document.querySelector("#whatsapp-stats-total");
const statsUnreadEl = document.querySelector("#whatsapp-stats-unread");
const currentUserEl = document.querySelector("#whatsapp-current-user");
const chatTitleEl = document.querySelector("#whatsapp-chat-title");
const chatMetaEl = document.querySelector("#whatsapp-chat-meta");
const replyFormEl = document.querySelector("#whatsapp-reply-form");
const replyTextEl = document.querySelector("#whatsapp-reply-text");
const sendButtonEl = document.querySelector("#whatsapp-send-button");
const replyHintEl = document.querySelector("#whatsapp-reply-hint");

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function setReplyEnabled(enabled) {
  replyTextEl.disabled = !enabled;
  sendButtonEl.disabled = !enabled;
  replyHintEl.textContent = enabled
    ? "Se enviará como mensaje de texto normal por WhatsApp Cloud API."
    : "Abrí una conversación para responder.";
}

function renderConversations(items) {
  if (!items.length) {
    listEl.innerHTML = `
      <article class="whatsapp-conversation-card is-empty">
        <p>No hay conversaciones para esos filtros.</p>
      </article>
    `;
    return;
  }

  listEl.innerHTML = items
    .map((conversation) => {
      const selectedClass = Number(conversation.id) === Number(state.selectedConversationId) ? "is-selected" : "";
      const unreadBadge =
        Number(conversation.unread_count) > 0
          ? `<span class="table-badge table-badge-alert">${conversation.unread_count} nuevo${Number(conversation.unread_count) > 1 ? "s" : ""}</span>`
          : `<span class="table-subtext">Leída</span>`;

      return `
        <button class="whatsapp-conversation-card ${selectedClass}" type="button" data-id="${conversation.id}">
          <div class="whatsapp-conversation-row">
            <strong>${escapeHtml(conversation.customer_name || conversation.customer_phone)}</strong>
            <span>${formatTime(conversation.last_message_at)}</span>
          </div>
          <div class="whatsapp-conversation-row">
            <span class="table-subtext">${escapeHtml(conversation.customer_phone)}</span>
            ${unreadBadge}
          </div>
          <p>${escapeHtml(conversation.last_message_text || "Sin mensajes todavía")}</p>
          <div class="whatsapp-conversation-row">
            <span class="table-subtext">${formatDate(conversation.last_message_at)}</span>
            <span class="table-subtext">${escapeHtml(conversation.assigned_user_name || "Sin asignar")}</span>
          </div>
        </button>
      `;
    })
    .join("");

  listEl.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedConversationId = Number(button.dataset.id);
      renderConversations(state.conversations);
      loadConversationDetail({ markRead: true });
    });
  });
}

function renderMessages(messages) {
  if (!messages.length) {
    messagesEl.innerHTML = `
      <div class="whatsapp-empty-state">
        <h3>Sin mensajes</h3>
        <p>Esta conversación todavía no tiene historial guardado.</p>
      </div>
    `;
    return;
  }

  messagesEl.innerHTML = messages
    .map((message) => {
      const directionClass =
        message.direction === "outbound" ? "whatsapp-message-outbound" : "whatsapp-message-inbound";
      const author =
        message.direction === "outbound"
          ? `Vos${message.sent_by_user_name ? ` · ${escapeHtml(message.sent_by_user_name)}` : ""}`
          : "Cliente";

      return `
        <article class="whatsapp-message ${directionClass}">
          <div class="whatsapp-message-bubble">
            <p>${escapeHtml(message.text_body || "[mensaje sin vista previa]")}</p>
            <div class="whatsapp-message-meta">
              <span>${author}</span>
              <span>${formatDate(message.created_at)}</span>
              <span>${escapeHtml(message.status || message.message_type || "")}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function requireSession() {
  const response = await fetch("/api/admin-session", { credentials: "same-origin" });
  const result = await response.json();

  if (!result.authenticated) {
    window.location.replace("/admin/login/");
    return false;
  }

  state.sessionUser = result.user;
  currentUserEl.textContent = result.user?.displayName || result.user?.identifier || "-";
  return true;
}

async function loadConversations() {
  setFeedback("");
  listEl.innerHTML = `
    <article class="whatsapp-conversation-card is-empty">
      <p>Cargando conversaciones...</p>
    </article>
  `;

  const params = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.pageSize),
  });

  if (state.query) {
    params.set("q", state.query);
  }

  if (state.unreadOnly) {
    params.set("unread", "1");
  }

  try {
    const response = await fetch(`/api/whatsapp-conversations?${params.toString()}`, {
      credentials: "same-origin",
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "No se pudieron cargar las conversaciones");
    }

    state.conversations = result.items;
    state.page = result.pagination.page;
    state.totalPages = result.pagination.totalPages;
    statsTotalEl.textContent = String(result.pagination.total);
    statsUnreadEl.textContent = String(
      result.items.reduce((total, item) => total + Number(item.unread_count || 0), 0)
    );
    paginationTextEl.textContent = `Página ${result.pagination.page} de ${result.pagination.totalPages}`;
    prevEl.disabled = result.pagination.page <= 1;
    nextEl.disabled = result.pagination.page >= result.pagination.totalPages;

    if (
      state.selectedConversationId &&
      !result.items.some((item) => Number(item.id) === Number(state.selectedConversationId))
    ) {
      state.selectedConversationId = result.items[0]?.id || null;
    }

    if (!state.selectedConversationId && result.items[0]) {
      state.selectedConversationId = result.items[0].id;
    }

    renderConversations(result.items);

    if (state.selectedConversationId) {
      await loadConversationDetail({ markRead: false });
    } else {
      setReplyEnabled(false);
    }
  } catch (error) {
    setFeedback(error.message, "error");
    listEl.innerHTML = `
      <article class="whatsapp-conversation-card is-empty">
        <p>No pudimos cargar las conversaciones.</p>
      </article>
    `;
  }
}

async function markConversationRead(conversationId) {
  await fetch("/api/whatsapp-mark-read", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conversationId }),
  });
}

async function loadConversationDetail({ markRead }) {
  if (!state.selectedConversationId) {
    return;
  }

  messagesEl.innerHTML = `
    <div class="whatsapp-empty-state">
      <h3>Cargando chat...</h3>
      <p>Estamos trayendo los mensajes de esta conversación.</p>
    </div>
  `;

  try {
    const response = await fetch(`/api/whatsapp-conversation-detail?id=${state.selectedConversationId}`, {
      credentials: "same-origin",
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "No se pudo cargar la conversación");
    }

    const conversation = result.conversation;
    chatTitleEl.textContent = conversation.customer_name || conversation.customer_phone;
    chatMetaEl.textContent = `${conversation.customer_phone} · Último mensaje ${formatDate(conversation.last_message_at)} · ${conversation.assigned_user_name || "Sin asignar"}`;
    renderMessages(result.messages);
    setReplyEnabled(true);

    if (markRead && Number(conversation.unread_count) > 0) {
      await markConversationRead(conversation.id);
      const localConversation = state.conversations.find(
        (item) => Number(item.id) === Number(conversation.id)
      );

      if (localConversation) {
        localConversation.unread_count = 0;
      }

      renderConversations(state.conversations);
      statsUnreadEl.textContent = String(
        state.conversations.reduce((total, item) => total + Number(item.unread_count || 0), 0)
      );
    }
  } catch (error) {
    setFeedback(error.message, "error");
    messagesEl.innerHTML = `
      <div class="whatsapp-empty-state">
        <h3>No pudimos cargar el chat</h3>
        <p>Probá refrescar la bandeja.</p>
      </div>
    `;
  }
}

async function sendMessage() {
  const text = replyTextEl.value.trim();

  if (!state.selectedConversationId || !text) {
    return;
  }

  setFeedback("");
  sendButtonEl.disabled = true;
  sendButtonEl.textContent = "Enviando...";

  try {
    const response = await fetch("/api/whatsapp-send-message", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId: state.selectedConversationId,
        text,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "No se pudo enviar el mensaje");
    }

    replyTextEl.value = "";
    setFeedback(
      result.mocked
        ? "Mensaje guardado en modo mock porque faltan credenciales reales de WhatsApp."
        : "Mensaje enviado correctamente.",
      "success"
    );
    await loadConversations();
    await loadConversationDetail({ markRead: false });
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    sendButtonEl.disabled = false;
    sendButtonEl.textContent = "Enviar mensaje";
  }
}

document.querySelector("#whatsapp-search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.page = 1;
  state.query = searchInputEl.value.trim();
  loadConversations();
});

unreadCheckboxEl.addEventListener("change", () => {
  state.page = 1;
  state.unreadOnly = unreadCheckboxEl.checked;
  loadConversations();
});

document.querySelector("#whatsapp-refresh").addEventListener("click", () => loadConversations());

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
  loadConversations();
});

nextEl.addEventListener("click", () => {
  if (state.page >= state.totalPages) {
    return;
  }

  state.page += 1;
  loadConversations();
});

replyFormEl.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage();
});

(async () => {
  const ok = await requireSession();

  if (ok) {
    await loadConversations();
  }
})().catch(() => {
  window.location.replace("/admin/login/");
});

setupRevealAnimations();
