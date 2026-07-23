const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
const navWrap = document.querySelector(".nav-wrap");
const mainSurface = document.querySelector("main");
const productSurfaceSelectors = [
  "[data-admin-dashboard]",
  "[data-admin-activities-page]",
  "[data-admin-members-page]",
  "[data-admin-modules-page]",
  "[data-admin-templates-page]",
  "[data-admin-template-editor-page]",
  "[data-admin-logs-page]",
  "[data-admin-reports-page]",
  "[data-admin-safety-page]",
  "[data-admin-ai-page]",
  "[data-admin-governance-page]",
  "[data-admin-trust-policy-page]",
  "[data-admin-badges-page]",
  "[data-admin-badge-policy-page]",
  "[data-admin-trust-page]",
  "[data-admin-trust-detail-page]",
  "[data-admin-activity-confidence-page]",
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
  if (!navWrap || !window.youkongTheme || document.querySelector("[data-theme-switch]")) return;
  const switcher = document.createElement("button");
  switcher.className = "theme-switch";
  switcher.type = "button";
  switcher.setAttribute("data-theme-switch", "");
  switcher.innerHTML = [
    '<span class="theme-switch-ring" aria-hidden="true">',
    '<span class="theme-switch-icon moon">',
    '<svg viewBox="0 0 24 24" focusable="false">',
    '<path d="M20.2 14.1A7.9 7.9 0 0 1 9.9 3.8a8.5 8.5 0 1 0 10.3 10.3Z"></path>',
    "</svg>",
    "</span>",
    '<span class="theme-switch-icon sun">',
    '<svg viewBox="0 0 24 24" focusable="false">',
    '<circle cx="12" cy="12" r="4.1"></circle>',
    '<path d="M12 2.8v2.1M12 19.1v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"></path>',
    "</svg>",
    "</span>",
    '<span class="theme-switch-icon system">',
    '<svg viewBox="0 0 24 24" focusable="false">',
    '<rect x="4.1" y="5.2" width="15.8" height="10.7" rx="2.2"></rect>',
    '<path d="M9 20h6M12 15.9V20"></path>',
    "</svg>",
    "</span>",
    "</span>",
    '<span class="sr-only" data-theme-switch-label>切换主题模式</span>',
  ].join("");

  switcher.addEventListener("click", () => {
    const mode = window.youkongTheme.getMode ? window.youkongTheme.getMode() : "system";
    const nextMode = mode === "dark" ? "light" : mode === "light" ? "system" : "dark";
    window.youkongTheme.setMode(nextMode);
  });

  const brand = navWrap.querySelector(".brand");
  if (brand && brand.nextSibling) {
    navWrap.insertBefore(switcher, brand.nextSibling);
  } else {
    navWrap.prepend(switcher);
  }

  const syncThemeButton = () => {
    const mode = window.youkongTheme.getMode ? window.youkongTheme.getMode() : "system";
    const resolved = window.youkongTheme.resolveMode();
    const isDark = mode === "dark";
    const isLight = mode === "light";
    const isSystem = mode === "system";
    const nextLabel = isDark ? "白天模式" : isLight ? "跟随系统" : "黑夜模式";
    const currentLabel = isSystem ? `跟随系统（当前${resolved === "dark" ? "黑夜" : "白天"}）` : isDark ? "黑夜模式" : "白天模式";
    const label = `当前${currentLabel}，点击切换到${nextLabel}`;
    switcher.dataset.themeMode = mode;
    switcher.dataset.themeState = resolved;
    switcher.classList.toggle("is-dark", isDark);
    switcher.classList.toggle("is-light", isLight);
    switcher.classList.toggle("is-system", isSystem);
    switcher.setAttribute("aria-label", label);
    switcher.setAttribute("title", label);
    switcher.querySelector("[data-theme-switch-label]").textContent = label;
  };
  window.addEventListener("youkong-theme-change", syncThemeButton);
  syncThemeButton();
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

  const syncQuickHome = () => {
    home.classList.toggle("is-visible", window.scrollY > Math.min(window.innerHeight * 0.55, 520));
  };
  window.addEventListener("scroll", syncQuickHome, { passive: true });
  syncQuickHome();
}

window.addEventListener("youkong-theme-change", mountThemeSwitch);
mountThemeSwitch();
setTimeout(mountThemeSwitch, 0);
setTimeout(mountThemeSwitch, 160);
mountQuickHome();

function mountAdminLoginFooterLink() {
  document.querySelectorAll(".site-footer .footer-links").forEach((links) => {
    if (links.querySelector('[href="login.html"]')) return;
    const link = document.createElement("a");
    link.href = "login.html";
    link.textContent = "管理员登录";
    links.append(link);
  });
}

mountAdminLoginFooterLink();

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
