const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
const mainSurface = document.querySelector("main");
const productSurfaceSelectors = [
  "[data-admin-dashboard]",
  "[data-admin-activities-page]",
  "[data-admin-members-page]",
  "[data-admin-modules-page]",
  "[data-admin-logs-page]",
  "[data-me-dashboard]",
  "[data-my-activities-page]",
  "[data-review-tasks-root]",
  "[data-registrations-page]",
  "[data-activity-editor-page]",
];

document.body.classList.add(
  mainSurface && productSurfaceSelectors.some((selector) => mainSurface.matches(selector))
    ? "product-surface"
    : "public-surface"
);

function mountThemeSwitch() {
  if (!navLinks || !window.youkongTheme || navLinks.querySelector("[data-theme-switch]")) return;
  const themeLabels = {
    light: "白天模式",
    dark: "黑夜模式",
    system: "跟随系统",
  };
  const switcher = document.createElement("div");
  switcher.className = "theme-switch";
  switcher.setAttribute("data-theme-switch", "");
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", "切换白天黑夜模式");

  window.youkongTheme.modes.forEach((mode) => {
    const button = document.createElement("button");
    button.className = "theme-choice";
    button.type = "button";
    button.dataset.themeChoice = mode;
    button.setAttribute("aria-label", themeLabels[mode]);
    button.title = themeLabels[mode];
    button.innerHTML = `<span class="theme-icon ${mode}" aria-hidden="true"></span><span class="sr-only">${themeLabels[mode]}</span>`;
    button.addEventListener("click", () => window.youkongTheme.setMode(mode));
    switcher.append(button);
  });

  const sessionNav = navLinks.querySelector("[data-session-nav]");
  navLinks.insertBefore(switcher, sessionNav || null);

  const syncThemeButtons = () => {
    const mode = window.youkongTheme.getMode();
    switcher.querySelectorAll("[data-theme-choice]").forEach((button) => {
      const active = button.dataset.themeChoice === mode;
      button.setAttribute("aria-pressed", String(active));
    });
  };
  window.addEventListener("youkong-theme-change", syncThemeButtons);
  syncThemeButtons();
}

function mountQuickHome() {
  if (document.querySelector("[data-quick-home]")) return;
  const home = document.createElement("a");
  home.className = "quick-home";
  home.href = location.pathname.endsWith("/index.html") || location.pathname === "/" ? "#main" : "index.html";
  home.setAttribute("data-quick-home", "");
  home.setAttribute("aria-label", "一键回到首页");
  home.innerHTML = '<span class="quick-home-icon" aria-hidden="true"></span><span>首页</span>';
  document.body.append(home);
}

window.addEventListener("youkong-theme-change", mountThemeSwitch);
mountThemeSwitch();
setTimeout(mountThemeSwitch, 0);
setTimeout(mountThemeSwitch, 160);
mountQuickHome();

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    document.body.classList.toggle("menu-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) {
      navLinks.classList.remove("open");
      document.body.classList.remove("menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const text = button.getAttribute("data-copy");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const old = button.textContent;
      button.textContent = "已复制";
      setTimeout(() => {
        button.textContent = old;
      }, 1400);
    } catch {
      button.textContent = text;
    }
  });
});

const revealTargets = [
  ".section-head",
  ".split",
  ".stats",
  ".grid",
  ".belief",
  ".notice-board",
  ".governance-list",
  ".gallery",
  ".process",
  ".donation-options",
  ".qr-grid",
  ".timeline",
  ".contact-panel",
  ".faq",
  ".quote-strip",
  ".form-note",
].join(",");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
  let pointerFrame = 0;
  let spotlightFrame = 0;
  let lastPointerEvent = null;

  document.addEventListener(
    "pointermove",
    (event) => {
      lastPointerEvent = event;
      if (!pointerFrame) {
        pointerFrame = requestAnimationFrame(() => {
          document.documentElement.style.setProperty("--pointer-x", `${lastPointerEvent.clientX}px`);
          document.documentElement.style.setProperty("--pointer-y", `${lastPointerEvent.clientY}px`);
          pointerFrame = 0;
        });
      }

      if (!(event.target instanceof Element)) return;
      const target = event.target.closest(".button, .photo-frame, .card, .event-card, .workspace-card, .form-note");
      if (!target) return;
      if (!spotlightFrame) {
        spotlightFrame = requestAnimationFrame(() => {
          const rect = target.getBoundingClientRect();
          target.style.setProperty("--local-x", `${lastPointerEvent.clientX - rect.left}px`);
          target.style.setProperty("--local-y", `${lastPointerEvent.clientY - rect.top}px`);
          spotlightFrame = 0;
        });
      }
    },
    { passive: true }
  );
}

if (!reduceMotion && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px 8% 0px", threshold: 0.04 }
  );

  document.querySelectorAll(revealTargets).forEach((element, index) => {
    element.setAttribute("data-reveal", "");
    element.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 55}ms`);
    observer.observe(element);
  });

  document
    .querySelectorAll(".grid, .process, .donation-options, .qr-grid, .governance-list, .stats, .timeline, .belief-list, .notice-list")
    .forEach((group) => {
      Array.from(group.children).forEach((child, index) => {
        child.style.setProperty("--item-delay", `${Math.min(index, 7) * 45}ms`);
      });
    });
} else {
  document.documentElement.classList.add("reduced-motion");
}
