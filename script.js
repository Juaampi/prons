const wizardSteps = [
  {
    question: "¿Qué tipo de proyecto querés proteger?",
    key: "proyecto",
    options: [
      { label: "Edificio", image: "./assets/motion/wizard-apartment.webp" },
      { label: "Empresa", image: "./assets/motion/wizard-business.webp" },
      { label: "Local", image: "./assets/motion/wizard-house.webp" },
      { label: "Otros", image: "./assets/motion/wizard-other.webp" },
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
];

const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");

function setupResponsiveMenu() {
  if (!menuButton || !nav) {
    return;
  }

  const closeMenu = () => {
    document.body.classList.remove("menu-open");
    menuButton.setAttribute("aria-expanded", "false");
  };

  const openMenu = () => {
    document.body.classList.add("menu-open");
    menuButton.setAttribute("aria-expanded", "true");
  };

  menuButton.addEventListener("click", () => {
    const isOpen = document.body.classList.contains("menu-open");
    if (isOpen) {
      closeMenu();
      return;
    }

    openMenu();
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeMenu());
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1100) {
      closeMenu();
    }
  });
}

const wizardState = {
  index: 0,
  answers: {},
  history: [],
};

const wizardQuestion = document.querySelector("#wizard-question");
const wizardOptions = document.querySelector("#wizard-options");
const wizardBack = document.querySelector("#wizard-back");
const wizardProgressBar = document.querySelector("#wizard-progress-bar");
const wizardStepText = document.querySelector("#wizard-step-text");

function buildFormUrl() {
  const params = new URLSearchParams({
    tipoProyecto: wizardState.answers.proyecto || "",
    solucion: wizardState.answers.solucion || "",
    source: "landing-asesoramiento",
  });

  return `/formulario/?${params.toString()}`;
}

function renderWizard() {
  const step = wizardSteps[wizardState.index];
  wizardQuestion.textContent = step.question;
  wizardStepText.textContent = `Paso ${wizardState.index + 1} de ${wizardSteps.length}`;
  wizardProgressBar.style.width = `${((wizardState.index + 1) / wizardSteps.length) * 100}%`;

  wizardOptions.innerHTML = "";

  step.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `wizard-option${option.image ? "" : " is-text-only"}`;
    button.innerHTML = option.image
      ? `<img src="${option.image}" alt="${option.label}"><strong>${option.label}</strong>`
      : `<strong>${option.label}</strong>`;
    button.addEventListener("click", () => selectOption(option.label));
    wizardOptions.appendChild(button);
  });

  wizardBack.classList.toggle("is-hidden", wizardState.index === 0);
}

function renderWizardResult() {
  wizardQuestion.textContent = "Tu consulta está casi lista";
  wizardStepText.textContent = "Paso completado";
  wizardProgressBar.style.width = "100%";

  wizardOptions.innerHTML = `
    <a class="wizard-option is-text-only" href="${buildFormUrl()}">
      <strong>Continuar con tus datos</strong>
      <span>Completá nombre, email y teléfono para dejar el proyecto registrado.</span>
    </a>
    <a class="wizard-option is-text-only" href="https://wa.me/5491138539758" target="_blank" rel="noreferrer">
      <strong>Hablar por WhatsApp</strong>
      <span>Si preferís contacto inmediato, te abrimos el chat directo con Prons.</span>
    </a>
    <button class="wizard-option is-text-only" type="button" id="wizard-reset">
      <strong>Volver a empezar</strong>
      <span>Reiniciar las preguntas.</span>
    </button>
  `;

  document.querySelector("#wizard-reset").addEventListener("click", resetWizard);
  wizardBack.classList.remove("is-hidden");
}

function selectOption(label) {
  const step = wizardSteps[wizardState.index];
  wizardState.answers[step.key] = label;
  wizardState.history.push(wizardState.index);

  if (wizardState.index === wizardSteps.length - 1) {
    renderWizardResult();
    return;
  }

  wizardState.index += 1;
  renderWizard();
}

function goBack() {
  if (!wizardState.history.length) {
    return;
  }

  wizardState.history.pop();
  wizardState.index = Math.max(0, wizardState.index - 1);
  renderWizard();
}

function resetWizard() {
  wizardState.index = 0;
  wizardState.answers = {};
  wizardState.history = [];
  renderWizard();
}

wizardBack.addEventListener("click", goBack);
setupResponsiveMenu();
renderWizard();

document
  .querySelectorAll(".hero-copy, .section-head, .why-copy, .installer-copy, .coverage-copy, .wizard-top")
  .forEach((container) => {
    container.classList.add("reveal-sequence");
    Array.from(container.children).forEach((child, index) => {
      child.style.setProperty("--reveal-delay", `${index * 90}ms`);
    });
  });

document.querySelectorAll(".concept-grid, .review-grid, .system-grid").forEach((grid) => {
  Array.from(grid.querySelectorAll(".reveal")).forEach((item, index) => {
    item.style.setProperty("--reveal-delay", `${index * 80}ms`);
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document
  .querySelectorAll(".reveal, .reveal-sequence")
  .forEach((element) => revealObserver.observe(element));

document.querySelectorAll("[data-hover-video]").forEach((card) => {
  const video = card.querySelector("video");

  if (!video) {
    return;
  }

  const playVideo = () => {
    video.play().catch(() => {});
  };

  const pauseVideo = () => {
    video.pause();
    video.currentTime = 0;
  };

  card.addEventListener("mouseenter", playVideo);
  card.addEventListener("mouseleave", pauseVideo);
  card.addEventListener("focusin", playVideo);
  card.addEventListener("focusout", pauseVideo);
});

const contactMiniForm = document.querySelector("#contact-mini-form");

if (contactMiniForm) {
  contactMiniForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = document.querySelector("#contact-name")?.value.trim();
    const phone = document.querySelector("#contact-phone")?.value.trim();
    const reason = document.querySelector("#contact-reason")?.value.trim();

    if (!name || !phone || !reason) {
      return;
    }

    const text = encodeURIComponent(
      `Hola Prons, quiero recibir asesoramiento.\nNombre: ${name}\nTeléfono: ${phone}\nMotivo: ${reason}`
    );

    window.open(`https://wa.me/5491138539758?text=${text}`, "_blank", "noopener,noreferrer");
  });
}
