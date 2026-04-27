import { setupRevealAnimations } from "./shared-ui.js";

const CLIENT_STATUS_OPTIONS = [
  "Contacto inicial",
  "Real interesado",
  "En evaluacion",
  "Negociacion",
  "Cliente actual",
  "Compro",
  "No interesado",
  "No cliente",
];

const STATUS_TONE_MAP = {
  "Contacto inicial": "info",
  "Real interesado": "positive",
  "En evaluacion": "warning",
  Negociacion: "accent",
  "Cliente actual": "positive",
  Compro: "success",
  "No interesado": "muted",
  "No cliente": "danger",
};

const STORAGE_KEYS = {
  owners: "prons.crm.client-owners",
};

const CRM_VIEWS = {
  dashboard: {
    title: "Panel de control",
    subtitle: "Vista general de los clientes registrados en el CRM.",
    tableTitle: "Resumen comercial",
    tableSubtitle: "Todos los leads visibles en la pagina actual con filtros activos.",
    matches: () => true,
  },
  prospects: {
    title: "Clientes potenciales",
    subtitle: "Gestiona y convierte tus clientes potenciales en ventas.",
    tableTitle: "Leads activos",
    tableSubtitle: "Contactos nuevos o en seguimiento comercial dentro de la pagina actual.",
    matches: (status) => ["Contacto inicial", "Real interesado", "En evaluacion", "Negociacion"].includes(status),
  },
  current: {
    title: "Clientes actuales",
    subtitle: "Clientes que ya avanzaron a una relacion comercial activa.",
    tableTitle: "Clientes activos",
    tableSubtitle: "Contactos marcados como cliente actual o compra concretada.",
    matches: (status) => ["Cliente actual", "Compro"].includes(status),
  },
  "in-progress": {
    title: "En proceso",
    subtitle: "Seguimiento de oportunidades que requieren gestion comercial.",
    tableTitle: "Oportunidades en proceso",
    tableSubtitle: "Leads en evaluacion o negociacion dentro de la pagina cargada.",
    matches: (status) => ["En evaluacion", "Negociacion"].includes(status),
  },
  discarded: {
    title: "No clientes",
    subtitle: "Consultas descartadas o sin avance comercial.",
    tableTitle: "Leads descartados",
    tableSubtitle: "Clientes marcados como no interesado o no cliente.",
    matches: (status) => ["No interesado", "No cliente"].includes(status),
  },
  all: {
    title: "Todos los clientes",
    subtitle: "Vista completa de clientes con los filtros de la pagina actual.",
    tableTitle: "Base de clientes",
    tableSubtitle: "Todos los clientes visibles en esta pagina del backend.",
    matches: () => true,
  },
};

const state = {
  page: 1,
  pageSize: 10,
  query: "",
  totalPages: 1,
  clients: [],
  filteredClients: [],
  filters: {
    status: "all",
    origin: "all",
    owner: "all",
  },
  clientOwners: loadStoredMap(STORAGE_KEYS.owners),
  activeMenuId: null,
  drawerMode: "view",
  drawerClientId: null,
  currentView: "prospects",
};

const bodyEl = document.querySelector("#admin-clients-body");
const feedbackEl = document.querySelector("#admin-panel-feedback");
const statsTotalEl = document.querySelector("#stats-total");
const statsPageEl = document.querySelector("#stats-page");
const statsQualifiedEl = document.querySelector("#stats-qualified");
const statsDiscardedEl = document.querySelector("#stats-discarded");
const paginationTextEl = document.querySelector("#admin-pagination-text");
const prevEl = document.querySelector("#admin-prev");
const nextEl = document.querySelector("#admin-next");
const searchInputEl = document.querySelector("#admin-search");
const filterStatusEl = document.querySelector("#admin-filter-status");
const filterOriginEl = document.querySelector("#admin-filter-origin");
const filterOwnerEl = document.querySelector("#admin-filter-owner");
const drawerEl = document.querySelector("#crm-drawer");
const drawerBackdropEl = document.querySelector("#crm-drawer-backdrop");
const drawerKickerEl = document.querySelector("#crm-drawer-kicker");
const drawerTitleEl = document.querySelector("#crm-drawer-title");
const drawerSubtitleEl = document.querySelector("#crm-drawer-subtitle");
const drawerBodyEl = document.querySelector("#crm-drawer-body");
const drawerSaveEl = document.querySelector("#crm-drawer-save");
const pageTitleEl = document.querySelector("#crm-page-title");
const pageSubtitleEl = document.querySelector("#crm-page-subtitle");
const tableTitleEl = document.querySelector("#crm-table-title");
const tableSubtitleEl = document.querySelector("#crm-table-subtitle");
const menuLinks = Array.from(document.querySelectorAll("[data-crm-view]"));

function loadStoredMap(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : {};
  } catch (error) {
    return {};
  }
}

function saveStoredMap(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function formatProject(client) {
  return client.tipo_proyecto || "Sin definir";
}

function getClientOrigin(client) {
  return client.origen || client.source || "Formulario web";
}

function getClientOwner(client) {
  return state.clientOwners[client.id] || client.vendedor || client.owner || "Sin asignar";
}

function normalizeClientStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();

  if (!normalized || normalized === "nuevo") {
    return "Contacto inicial";
  }

  const match = CLIENT_STATUS_OPTIONS.find((option) => option.toLowerCase() === normalized);
  return match || "Contacto inicial";
}

function getClientStatus(client) {
  return normalizeClientStatus(client.status || client.estado);
}

function getStatusTone(status) {
  return STATUS_TONE_MAP[status] || "info";
}

function getVisibleCounts(items) {
  return items.reduce(
    (accumulator, client) => {
      const status = getClientStatus(client);

      if (["Real interesado", "En evaluacion", "Negociacion", "Cliente actual", "Compro"].includes(status)) {
        accumulator.qualified += 1;
      }

      if (["No interesado", "No cliente"].includes(status)) {
        accumulator.discarded += 1;
      }

      return accumulator;
    },
    { qualified: 0, discarded: 0 }
  );
}

function updateFilterOptions(items) {
  const origins = [...new Set(items.map((client) => getClientOrigin(client)).filter(Boolean))];
  const owners = [...new Set(items.map((client) => getClientOwner(client)).filter(Boolean))];

  filterOriginEl.innerHTML = ['<option value="all">Todos</option>']
    .concat(origins.map((origin) => `<option value="${escapeHtml(origin)}">${escapeHtml(origin)}</option>`))
    .join("");

  filterOwnerEl.innerHTML = ['<option value="all">Todos</option>']
    .concat(owners.map((owner) => `<option value="${escapeHtml(owner)}">${escapeHtml(owner)}</option>`))
    .join("");

  filterOriginEl.value = origins.includes(state.filters.origin) ? state.filters.origin : "all";
  filterOwnerEl.value = owners.includes(state.filters.owner) ? state.filters.owner : "all";
  state.filters.origin = filterOriginEl.value;
  state.filters.owner = filterOwnerEl.value;
}

function applyFilters() {
  const currentView = CRM_VIEWS[state.currentView] || CRM_VIEWS.prospects;
  const filtered = state.clients.filter((client) => {
    const status = getClientStatus(client);
    const origin = getClientOrigin(client);
    const owner = getClientOwner(client);

    if (!currentView.matches(status, client)) {
      return false;
    }

    if (state.filters.status !== "all" && status !== state.filters.status) {
      return false;
    }

    if (state.filters.origin !== "all" && origin !== state.filters.origin) {
      return false;
    }

    if (state.filters.owner !== "all" && owner !== state.filters.owner) {
      return false;
    }

    return true;
  });

  state.filteredClients = filtered;
  renderClients(filtered);

  const visibleCounts = getVisibleCounts(filtered);
  statsTotalEl.textContent = String(filtered.length);
  statsQualifiedEl.textContent = String(visibleCounts.qualified);
  statsDiscardedEl.textContent = String(visibleCounts.discarded);
}

function applyCurrentViewMeta() {
  const currentView = CRM_VIEWS[state.currentView] || CRM_VIEWS.prospects;
  pageTitleEl.textContent = currentView.title;
  pageSubtitleEl.textContent = currentView.subtitle;
  tableTitleEl.textContent = currentView.tableTitle;
  tableSubtitleEl.textContent = currentView.tableSubtitle;

  menuLinks.forEach((link) => {
    const isActive = link.dataset.crmView === state.currentView;
    link.classList.toggle("is-active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function renderStatusSelect(client) {
  const currentStatus = getClientStatus(client);

  return `
    <label class="crm-status-field">
      <span class="crm-status-badge crm-status-${getStatusTone(currentStatus)}">${escapeHtml(currentStatus)}</span>
      <select class="crm-inline-select js-client-status" data-id="${client.id}">
        ${CLIENT_STATUS_OPTIONS.map(
          (status) =>
            `<option value="${escapeHtml(status)}" ${status === currentStatus ? "selected" : ""}>${escapeHtml(status)}</option>`
        ).join("")}
      </select>
    </label>
  `;
}

function renderActionMenu(client) {
  return `
    <details class="crm-more-menu" ${state.activeMenuId === String(client.id) ? "open" : ""}>
      <summary
        class="crm-action-link crm-action-link-ghost crm-action-icon js-more-menu"
        data-id="${client.id}"
        aria-label="Mas opciones"
      >
        ⋮
      </summary>
      <div class="crm-more-menu-panel">
        <button class="crm-menu-item js-email-reminder" type="button" data-id="${client.id}">
          Enviar email recordatorio
        </button>
        <button class="crm-menu-item js-wpp-reminder" type="button" data-id="${client.id}">
          Enviar WhatsApp recordatorio
        </button>
        <button class="crm-menu-item js-open-drawer" type="button" data-mode="view" data-id="${client.id}">
          Visualizar
        </button>
      </div>
    </details>
  `;
}

function renderClients(items) {
  if (!items.length) {
    bodyEl.innerHTML = `
      <tr>
        <td colspan="6">No encontramos clientes para esa combinacion de filtros.</td>
      </tr>
    `;
    return;
  }

  bodyEl.innerHTML = items
    .map((client) => {
      const origin = getClientOrigin(client);
      const owner = getClientOwner(client);
      const project = formatProject(client);
      const lastContactMeta = client.email ? "Email registrado" : "Lead registrado";

      return `
        <tr>
          <td>
            <div class="crm-client-cell">
              <strong>${escapeHtml(client.nombre)}</strong>
              <span class="table-subtext">Lead #${client.id}</span>
            </div>
          </td>
          <td>
            <div class="crm-contact-stack">
              <span>${escapeHtml(client.email || "-")}</span>
              <span class="table-subtext">${escapeHtml(client.telefono || "-")}</span>
              <span class="table-subtext">${escapeHtml(origin)}</span>
            </div>
          </td>
          <td>${renderStatusSelect(client)}</td>
          <td>
            <div class="crm-project-stack">
              <span class="table-badge">${escapeHtml(project)}</span>
              <span class="table-subtext">${escapeHtml(client.solucion || "Sin detalle de solucion")}</span>
              <span class="table-subtext">Vendedor: ${escapeHtml(owner)}</span>
            </div>
          </td>
          <td>
            <div class="crm-date-stack">
              <strong>${formatDate(client.updated_at || client.created_at)}</strong>
              <span class="table-subtext">${escapeHtml(lastContactMeta)}</span>
            </div>
          </td>
          <td>
            <div class="crm-action-stack">
              <button
                class="crm-action-link crm-action-icon js-open-drawer"
                type="button"
                data-mode="view"
                data-id="${client.id}"
                aria-label="Ver detalle"
                title="Ver detalle"
              >
                👁
              </button>
              <button
                class="crm-action-link crm-action-icon js-open-drawer"
                type="button"
                data-mode="edit"
                data-id="${client.id}"
                aria-label="Editar cliente"
                title="Editar cliente"
              >
                ✏️
              </button>
              <button
                class="crm-action-link crm-action-link-danger crm-action-icon js-delete-client"
                type="button"
                data-id="${client.id}"
                aria-label="Eliminar cliente"
                title="Eliminar cliente"
              >
                🗑
              </button>
              ${renderActionMenu(client)}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  bindRenderedTableActions();
}

function bindRenderedTableActions() {
  bodyEl.querySelectorAll(".js-open-drawer").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await openClientDrawer(button.dataset.id, button.dataset.mode || "view");
    });
  });

  bodyEl.querySelectorAll(".js-email-reminder").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await sendReminder("/api/send-email-reminder", button.dataset.id, button);
    });
  });

  bodyEl.querySelectorAll(".js-wpp-reminder").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await sendReminder("/api/send-whatsapp-reminder", button.dataset.id, button);
    });
  });

  bodyEl.querySelectorAll(".js-delete-client").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const confirmed = window.confirm("¿Querés eliminar este cliente del CRM?");

      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch("/api/delete-client", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ clientId: handleDeletePlaceholder(button.dataset.id) }),
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "No se pudo eliminar el cliente");
        }

        setFeedback("Cliente eliminado correctamente.", "success");
        await loadClients();
      } catch (error) {
        setFeedback(error.message, "error");
      }
    });
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
      <td colspan="6">Cargando clientes...</td>
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

    state.clients = Array.isArray(result.items) ? result.items : [];
    updateFilterOptions(state.clients);
    applyFilters();
    state.page = result.pagination.page;
    state.totalPages = result.pagination.totalPages;
    statsPageEl.textContent = String(result.pagination.page);
    paginationTextEl.textContent = `Pagina ${result.pagination.page} de ${result.pagination.totalPages}`;
    prevEl.disabled = result.pagination.page <= 1;
    nextEl.disabled = result.pagination.page >= result.pagination.totalPages;
  } catch (error) {
    bodyEl.innerHTML = `
      <tr>
        <td colspan="6">No pudimos cargar el panel.</td>
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

function getClientByIdFromState(clientId) {
  return state.clients.find((client) => String(client.id) === String(clientId)) || null;
}

function buildClientUpdatePayload(client, overrides = {}) {
  const nextClient = {
    ...client,
    ...overrides,
  };

  return {
    clientId: nextClient.id,
    nombre: nextClient.nombre || "",
    email: nextClient.email || "",
    telefono: nextClient.telefono || "",
    tipoProyecto: nextClient.tipo_proyecto || nextClient.tipoProyecto || "",
    solucion: nextClient.solucion || "",
    source: nextClient.source || getClientOrigin(nextClient),
    status: normalizeClientStatus(nextClient.status || nextClient.estado),
  };
}

async function persistClientUpdate(clientId, payload) {
  const response = await fetch("/api/update-client", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "No se pudo actualizar el cliente");
  }

  const nextClient = result.client;
  state.clients = state.clients.map((client) => (String(client.id) === String(clientId) ? nextClient : client));
  updateFilterOptions(state.clients);
  applyFilters();
  return nextClient;
}

function exportCurrentView() {
  const items = state.filteredClients;

  if (!items.length) {
    setFeedback("No hay clientes visibles para exportar.", "error");
    return;
  }

  const rows = [
    ["id", "nombre", "email", "telefono", "estado", "proyecto", "solucion", "origen", "vendedor", "ultimo_contacto"],
    ...items.map((client) => [
      client.id,
      client.nombre || "",
      client.email || "",
      client.telefono || "",
      getClientStatus(client),
      client.tipo_proyecto || "",
      client.solucion || "",
      getClientOrigin(client),
      getClientOwner(client),
      client.updated_at || client.created_at || "",
    ]),
  ];

  const csv = rows
    .map((row) => row.map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `clientes-potenciales-pagina-${state.page}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setFeedback("Exportacion generada con la vista actual.", "success");
}

function setDrawerVisibility(visible) {
  drawerEl.classList.toggle("is-hidden", !visible);
  drawerBackdropEl.classList.toggle("is-hidden", !visible);
  drawerEl.setAttribute("aria-hidden", String(!visible));
}

function renderDrawerShell({ kicker, title, subtitle, body, mode = "view", saveLabel = "Guardar cambios" }) {
  state.drawerMode = mode;
  drawerKickerEl.textContent = kicker;
  drawerTitleEl.textContent = title;
  drawerSubtitleEl.textContent = subtitle;
  drawerBodyEl.innerHTML = body;
  drawerSaveEl.textContent = saveLabel;
  drawerSaveEl.disabled = mode === "view";
  setDrawerVisibility(true);
}

function renderClientActivity(activities = []) {
  if (!activities.length) {
    return `
      <div class="crm-history-empty">
        <p>Todavia no hay movimientos registrados para este cliente.</p>
      </div>
    `;
  }

  return `
    <div class="crm-history-list">
      ${activities
        .map(
          (activity) => `
            <article class="crm-history-item">
              <strong>${escapeHtml(activity.message || "Movimiento registrado")}</strong>
              <span>${escapeHtml(activity.actorName || "Sistema")} · ${formatDate(activity.createdAt || activity.created_at)}</span>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderClientDetail(client, activities = []) {
  const status = getClientStatus(client);
  const owner = getClientOwner(client);
  const origin = getClientOrigin(client);

  return `
    <div class="crm-drawer-grid">
      <article class="crm-drawer-card">
        <h3>Resumen</h3>
        <dl class="crm-detail-list">
          <div><dt>Cliente</dt><dd>${escapeHtml(client.nombre || "-")}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(client.email || "-")}</dd></div>
          <div><dt>Telefono</dt><dd>${escapeHtml(client.telefono || "-")}</dd></div>
          <div><dt>Estado</dt><dd>${escapeHtml(status)}</dd></div>
          <div><dt>Proyecto</dt><dd>${escapeHtml(client.tipo_proyecto || "-")}</dd></div>
          <div><dt>Solucion</dt><dd>${escapeHtml(client.solucion || "-")}</dd></div>
          <div><dt>Origen</dt><dd>${escapeHtml(origin)}</dd></div>
          <div><dt>Vendedor</dt><dd>${escapeHtml(owner)}</dd></div>
          <div><dt>Ultimo contacto</dt><dd>${formatDate(client.updated_at || client.created_at)}</dd></div>
        </dl>
      </article>

      <article class="crm-drawer-card">
        <h3>Historial</h3>
        ${renderClientActivity(activities)}
      </article>
    </div>
  `;
}

function renderClientEditForm(client) {
  return `
    <form class="crm-inline-form" id="crm-client-edit-form">
      <div class="form-grid">
        <label class="crm-modal-field">
          <span>Nombre</span>
          <input id="crm-edit-nombre" type="text" value="${escapeHtml(client.nombre || "")}" />
        </label>
        <label class="crm-modal-field">
          <span>Email</span>
          <input id="crm-edit-email" type="email" value="${escapeHtml(client.email || "")}" />
        </label>
        <label class="crm-modal-field">
          <span>Telefono</span>
          <input id="crm-edit-telefono" type="text" value="${escapeHtml(client.telefono || "")}" />
        </label>
        <label class="crm-modal-field">
          <span>Estado</span>
          <select id="crm-drawer-status-select">
            ${CLIENT_STATUS_OPTIONS.map(
              (status) =>
                `<option value="${escapeHtml(status)}" ${status === getClientStatus(client) ? "selected" : ""}>${escapeHtml(status)}</option>`
            ).join("")}
          </select>
        </label>
        <label class="crm-modal-field">
          <span>Proyecto</span>
          <input id="crm-edit-proyecto" type="text" value="${escapeHtml(client.tipo_proyecto || "")}" />
        </label>
        <label class="crm-modal-field">
          <span>Solucion</span>
          <input id="crm-edit-solucion" type="text" value="${escapeHtml(client.solucion || "")}" />
        </label>
        <label class="crm-modal-field">
          <span>Origen</span>
          <input id="crm-edit-source" type="text" value="${escapeHtml(client.source || getClientOrigin(client))}" />
        </label>
      </div>
    </form>
  `;
}

function renderCreateClientForm() {
  return `
    <form class="crm-inline-form" id="crm-client-create-form">
      <div class="form-grid">
        <label class="crm-modal-field">
          <span>Nombre</span>
          <input id="crm-create-nombre" type="text" placeholder="Nombre del cliente" />
        </label>
        <label class="crm-modal-field">
          <span>Email</span>
          <input id="crm-create-email" type="email" placeholder="cliente@empresa.com" />
        </label>
        <label class="crm-modal-field">
          <span>Telefono</span>
          <input id="crm-create-telefono" type="text" placeholder="+54 9 ..." />
        </label>
        <label class="crm-modal-field">
          <span>Estado</span>
          <select id="crm-create-status">
            ${CLIENT_STATUS_OPTIONS.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("")}
          </select>
        </label>
        <label class="crm-modal-field">
          <span>Proyecto</span>
          <input id="crm-create-proyecto" type="text" placeholder="Tipo de proyecto" />
        </label>
        <label class="crm-modal-field">
          <span>Solucion</span>
          <input id="crm-create-solucion" type="text" placeholder="Solucion solicitada" />
        </label>
        <label class="crm-modal-field">
          <span>Origen</span>
          <input id="crm-create-source" type="text" value="admin-crm" />
        </label>
      </div>
    </form>
  `;
}

async function openClientDrawer(clientId, mode = "view") {
  state.drawerClientId = String(clientId);
  const fallbackClient = state.clients.find((client) => String(client.id) === String(clientId));

  renderDrawerShell({
    kicker: mode === "edit" ? "Editar cliente" : "Detalle del cliente",
    title: fallbackClient?.nombre || `Cliente #${clientId}`,
    subtitle: fallbackClient
      ? "Informacion disponible desde la tabla actual."
      : "Cargando informacion del cliente...",
    body: fallbackClient
      ? mode === "edit"
        ? renderClientEditForm(fallbackClient)
        : renderClientDetail(fallbackClient, [])
      : '<div class="crm-empty-drawer"><p>Cargando detalle...</p></div>',
    mode,
  });

  try {
    const response = await fetch(`/api/client-detail?id=${clientId}`, {
      credentials: "same-origin",
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "No se pudo cargar el detalle del cliente");
    }

    const client = result.client || fallbackClient;
    const activities = Array.isArray(result.activities) ? result.activities : [];

    renderDrawerShell({
      kicker: mode === "edit" ? "Editar cliente" : "Detalle del cliente",
      title: client?.nombre || `Cliente #${clientId}`,
      subtitle:
        mode === "edit"
          ? "Podes editar y guardar cambios desde este panel."
          : "Informacion consolidada desde la tabla actual.",
      body: mode === "edit" ? renderClientEditForm(client) : renderClientDetail(client, activities),
      mode,
      saveLabel: mode === "edit" ? "Guardar cambios" : "Cerrar",
    });
  } catch (error) {
    if (fallbackClient) {
      setFeedback("No pudimos ampliar el detalle desde backend, pero usamos los datos ya cargados en la tabla.", "error");
      return;
    }

    renderDrawerShell({
      kicker: "Detalle del cliente",
      title: `Cliente #${clientId}`,
      subtitle: "No se pudo cargar el detalle desde el backend.",
      body: `<div class="crm-empty-drawer"><p>${escapeHtml(error.message)}</p></div>`,
      mode: "view",
      saveLabel: "Cerrar",
    });
  }
}

function openCreateDrawer() {
  state.drawerClientId = null;
  renderDrawerShell({
    kicker: "Nuevo cliente",
    title: "Alta manual de cliente",
    subtitle: "Estructura visual preparada para sumar CRUD sin cambiar el resto del CRM.",
    body: renderCreateClientForm(),
    mode: "create",
    saveLabel: "Crear cliente",
  });
}

function handleDeletePlaceholder(clientId) {
  return clientId;
}

function setCurrentView(viewKey) {
  state.currentView = CRM_VIEWS[viewKey] ? viewKey : "prospects";
  applyCurrentViewMeta();
  applyFilters();
}

function bindStaticEvents() {
  document.querySelector("#admin-search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.page = 1;
    state.query = searchInputEl.value.trim();
    loadClients();
  });

  document.querySelector("#admin-refresh").addEventListener("click", () => loadClients());
  document.querySelector("#admin-export").addEventListener("click", exportCurrentView);
  document.querySelector("#admin-new-client").addEventListener("click", openCreateDrawer);
  document.querySelector("#admin-filter-button").addEventListener("click", () => applyFilters());

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

  filterStatusEl.addEventListener("change", () => {
    state.filters.status = filterStatusEl.value;
    applyFilters();
  });

  filterOriginEl.addEventListener("change", () => {
    state.filters.origin = filterOriginEl.value;
    applyFilters();
  });

  filterOwnerEl.addEventListener("change", () => {
    state.filters.owner = filterOwnerEl.value;
    applyFilters();
  });

  bodyEl.addEventListener("change", async (event) => {
    const target = event.target;

    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    if (target.matches(".js-client-status")) {
      const client = getClientByIdFromState(target.dataset.id);

      if (!client) {
        setFeedback("No se pudo identificar el cliente seleccionado.", "error");
        return;
      }

      const previousValue = normalizeClientStatus(client.status || client.estado);
      const nextStatus = target.value;

      target.disabled = true;

      try {
        await persistClientUpdate(client.id, buildClientUpdatePayload(client, { status: nextStatus }));
        setFeedback("Estado actualizado correctamente.", "success");
      } catch (error) {
        target.value = previousValue;
        setFeedback(error.message, "error");
      } finally {
        target.disabled = false;
      }
    }
  });

  bodyEl.addEventListener("click", async (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }
  });

  bodyEl.addEventListener("toggle", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLDetailsElement) || !target.matches(".crm-more-menu")) {
      return;
    }

    state.activeMenuId = target.open ? target.querySelector(".js-more-menu")?.dataset.id || null : null;
  }, true);

  menuLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setCurrentView(link.dataset.crmView || "prospects");
    });
  });

  function closeDrawer() {
    state.drawerClientId = null;
    setDrawerVisibility(false);
  }

  drawerBackdropEl.addEventListener("click", closeDrawer);
  document.querySelector("#crm-drawer-close").addEventListener("click", closeDrawer);
  document.querySelector("#crm-drawer-cancel").addEventListener("click", closeDrawer);
  drawerSaveEl.addEventListener("click", async () => {
    if (state.drawerMode === "edit") {
      const client = getClientByIdFromState(state.drawerClientId);

      if (!client) {
        setFeedback("No se pudo encontrar el cliente a editar.", "error");
        return;
      }

      const payload = buildClientUpdatePayload(client, {
        nombre: document.querySelector("#crm-edit-nombre")?.value,
        email: document.querySelector("#crm-edit-email")?.value,
        telefono: document.querySelector("#crm-edit-telefono")?.value,
        tipo_proyecto: document.querySelector("#crm-edit-proyecto")?.value,
        solucion: document.querySelector("#crm-edit-solucion")?.value,
        source: document.querySelector("#crm-edit-source")?.value,
        status: document.querySelector("#crm-drawer-status-select")?.value,
      });

      drawerSaveEl.disabled = true;

      try {
        await persistClientUpdate(state.drawerClientId, payload);
        setFeedback("Cliente actualizado correctamente.", "success");
        closeDrawer();
      } catch (error) {
        setFeedback(error.message, "error");
      } finally {
        drawerSaveEl.disabled = false;
      }

      return;
    }

    if (state.drawerMode === "create") {
      const payload = {
        nombre: document.querySelector("#crm-create-nombre")?.value,
        email: document.querySelector("#crm-create-email")?.value,
        telefono: document.querySelector("#crm-create-telefono")?.value,
        tipoProyecto: document.querySelector("#crm-create-proyecto")?.value,
        solucion: document.querySelector("#crm-create-solucion")?.value,
        source: document.querySelector("#crm-create-source")?.value || "admin-crm",
        status: document.querySelector("#crm-create-status")?.value || "Contacto inicial",
      };

      drawerSaveEl.disabled = true;

      try {
        const response = await fetch("/api/admin-create-client", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "No se pudo crear el cliente");
        }

        const createdClient = {
          ...result.client,
          status: payload.status,
        };

        state.clients = [createdClient, ...state.clients];
        updateFilterOptions(state.clients);
        applyFilters();
        setFeedback("Cliente creado correctamente.", "success");
        closeDrawer();
      } catch (error) {
        setFeedback(error.message, "error");
      } finally {
        drawerSaveEl.disabled = false;
      }

      return;
    }

    closeDrawer();
  });
}

(async () => {
  bindStaticEvents();
  applyCurrentViewMeta();
  const ok = await requireSession();

  if (ok) {
    await loadClients();
  }
})().catch(() => {
  window.location.replace("/admin/login/");
});

setupRevealAnimations();
