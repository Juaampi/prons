import { setupRevealAnimations, setupResponsiveMenu } from "./shared-ui.js";

const wizardSteps = [
  {
    question: "¿Qué tipo de proyecto querés proteger?",
    key: "tipoProyecto",
    options: [
      { label: "Edificio", image: "/assets/motion/wizard-apartment.webp" },
      { label: "Empresa", image: "/assets/motion/wizard-business.webp" },
      { label: "Local", image: "/assets/motion/wizard-house.webp" },
      { label: "Otros", image: "/assets/motion/wizard-other.webp" },
    ],
  },
  {
    question: "¿Qué solución te interesa?",
    key: "solucion",
    options: [
      { label: "CCTV" },
      { label: "Acceso" },
      { label: "Videoportero" },
      { label: "Alarmas" },
      { label: "Incendio" },
      { label: "Integral" },
    ],
  },
  {
    question: "Dejanos tus datos para contactarte",
    key: "contacto",
    form: true,
  },
];

const wizardState = {
  index: 0,
  answers: {
    tipoProyecto: "",
    solucion: "",
    nombre: "",
    email: "",
    telefono: "",
    comentarios: "",
    source: "formulario",
  },
  history: [],
  loading: false,
};

const params = new URLSearchParams(window.location.search);
wizardState.answers.tipoProyecto = params.get("tipoProyecto") || "";
wizardState.answers.solucion = params.get("solucion") || "";
wizardState.answers.source = params.get("source") || "formulario";
wizardState.index =
  wizardState.answers.tipoProyecto && wizardState.answers.solucion ? 2 : wizardState.answers.tipoProyecto ? 1 : 0;
wizardState.history = Array.from({ length: wizardState.index }, (_, index) => index);

const questionEl = document.querySelector("#lead-question");
const stepTextEl = document.querySelector("#lead-step-text");
const progressBarEl = document.querySelector("#lead-progress-bar");
const optionsEl = document.querySelector("#lead-options");
const backEl = document.querySelector("#lead-back");
const feedbackEl = document.querySelector("#lead-feedback");

function setFeedback(message, type = "info") {
  if (!message) {
    feedbackEl.className = "wizard-feedback is-hidden";
    feedbackEl.textContent = "";
    return;
  }

  feedbackEl.className = `wizard-feedback wizard-feedback-${type}`;
  feedbackEl.textContent = message;
}

function renderStep() {
  const step = wizardSteps[wizardState.index];
  questionEl.textContent = step.question;
  stepTextEl.textContent = `Paso ${wizardState.index + 1} de ${wizardSteps.length}`;
  progressBarEl.style.width = `${((wizardState.index + 1) / wizardSteps.length) * 100}%`;
  backEl.classList.toggle("is-hidden", wizardState.index === 0 || wizardState.loading);
  setFeedback("");

  if (step.form) {
    renderContactForm();
    return;
  }

  optionsEl.className = "wizard-options";
  optionsEl.innerHTML = step.options
    .map((option) => {
      const selected = wizardState.answers[step.key] === option.label ? " is-selected" : "";
      return `
        <button class="wizard-option${option.image ? "" : " is-text-only"}${selected}" type="button" data-value="${option.label}">
          ${
            option.image
              ? `<img src="${option.image}" alt="${option.label}"><strong>${option.label}</strong>`
              : `<strong>${option.label}</strong>`
          }
        </button>
      `;
    })
    .join("");

  optionsEl.querySelectorAll("[data-value]").forEach((button) => {
    button.addEventListener("click", () => {
      wizardState.answers[step.key] = button.dataset.value;

      if (wizardState.index < wizardSteps.length - 1) {
        wizardState.history.push(wizardState.index);
        wizardState.index += 1;
        renderStep();
      }
    });
  });
}

function renderContactForm() {
  optionsEl.className = "wizard-options wizard-options-form";
  optionsEl.innerHTML = `
    <form class="stack-form lead-form" id="lead-form">
      <div class="form-grid">
        <label class="contact-mini-field">
          <span>Nombre</span>
          <input name="nombre" type="text" required value="${wizardState.answers.nombre}" />
        </label>
        <label class="contact-mini-field">
          <span>Email</span>
          <input name="email" type="email" required value="${wizardState.answers.email}" />
        </label>
      </div>

      <div class="form-grid">
        <label class="contact-mini-field">
          <span>Teléfono</span>
          <input name="telefono" type="tel" required value="${wizardState.answers.telefono}" />
        </label>
        <label class="contact-mini-field">
          <span>Tipo de proyecto</span>
          <input type="text" value="${wizardState.answers.tipoProyecto}" disabled />
        </label>
      </div>

      <label class="contact-mini-field">
        <span>Comentario opcional</span>
        <textarea name="comentarios" rows="4" placeholder="Contanos un detalle útil del proyecto">${wizardState.answers.comentarios}</textarea>
      </label>

      <div class="form-summary-card">
        <strong>Resumen de la consulta</strong>
        <span>${wizardState.answers.tipoProyecto} | ${wizardState.answers.solucion}</span>
      </div>

      <button class="button button-primary lead-submit" type="submit">
        ${wizardState.loading ? "Enviando..." : "Enviar formulario"}
      </button>
    </form>
  `;

  document.querySelector("#lead-form").addEventListener("submit", handleSubmit);
}

async function handleSubmit(event) {
  event.preventDefault();

  if (wizardState.loading) {
    return;
  }

  const formData = new FormData(event.currentTarget);
  wizardState.answers.nombre = String(formData.get("nombre") || "").trim();
  wizardState.answers.email = String(formData.get("email") || "").trim();
  wizardState.answers.telefono = String(formData.get("telefono") || "").trim();
  wizardState.answers.comentarios = String(formData.get("comentarios") || "").trim();

  wizardState.loading = true;
  renderContactForm();
  setFeedback("Registrando consulta y disparando notificaciones...", "info");

  try {
    const response = await fetch("/api/create-client", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nombre: wizardState.answers.nombre,
        email: wizardState.answers.email,
        telefono: wizardState.answers.telefono,
        tipoProyecto: wizardState.answers.tipoProyecto,
        solucion: wizardState.answers.solucion,
        source: wizardState.answers.source,
        datosExtra: {
          comentarios: wizardState.answers.comentarios,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "No se pudo enviar el formulario");
    }

    renderSuccess(result.client);
  } catch (error) {
    wizardState.loading = false;
    renderContactForm();
    setFeedback(error.message, "error");
  }
}

function renderSuccess(client) {
  questionEl.textContent = "Tu consulta fue enviada";
  stepTextEl.textContent = "Proceso completado";
  progressBarEl.style.width = "100%";
  backEl.classList.add("is-hidden");
  optionsEl.className = "wizard-options wizard-options-form";
  optionsEl.innerHTML = `
    <div class="success-state">
      <div class="success-pill">Consulta registrada</div>
      <h4>Gracias, ${client.nombre}.</h4>
      <p>
        Dejamos tu proyecto cargado y listo para seguimiento. Si las credenciales externas están
        configuradas, también ya salió el email automático y el WhatsApp.
      </p>
      <div class="success-grid">
        <div class="form-summary-card">
          <strong>Proyecto</strong>
          <span>${client.tipo_proyecto}</span>
        </div>
        <div class="form-summary-card">
          <strong>Solución</strong>
          <span>${client.solucion}</span>
        </div>
      </div>
      <div class="wizard-actions wizard-actions-spread">
        <a class="button button-primary" href="/">Volver al inicio</a>
        <a class="button button-secondary" href="https://wa.me/5491138539758" target="_blank" rel="noreferrer">Abrir WhatsApp</a>
      </div>
    </div>
  `;
  setFeedback("");
}

backEl.addEventListener("click", () => {
  if (!wizardState.history.length || wizardState.loading) {
    return;
  }

  wizardState.index = wizardState.history.pop();
  renderStep();
});

renderStep();
setupResponsiveMenu();
setupRevealAnimations();
