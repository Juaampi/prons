export function setupRevealAnimations() {
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

  document.querySelectorAll(".reveal, .reveal-sequence").forEach((element) => {
    revealObserver.observe(element);
  });
}

export function setupResponsiveMenu() {
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");

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
    link.addEventListener("click", () => {
      closeMenu();
    });
  });

  document.querySelectorAll('a[href="/"], a[href="#inicio"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
      const targetPath = link.getAttribute("href");

      if (currentPath === "/" && (targetPath === "/" || targetPath === "#inicio")) {
        event.preventDefault();
        closeMenu();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1100) {
      closeMenu();
    }
  });
}
