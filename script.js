const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    document.body.classList.toggle("menu-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      document.body.classList.remove("menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
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
