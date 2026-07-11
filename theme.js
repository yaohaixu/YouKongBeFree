(() => {
  const STORAGE_KEY = "youkong-theme-mode";
  const MODES = ["light", "dark", "system"];
  const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function normalizeMode(mode) {
    return MODES.includes(mode) ? mode : "system";
  }

  function getMode() {
    try {
      return normalizeMode(localStorage.getItem(STORAGE_KEY));
    } catch {
      return "system";
    }
  }

  function resolveMode(mode) {
    if (mode === "system") {
      return media && media.matches ? "dark" : "light";
    }
    return mode;
  }

  function applyMode(mode) {
    const normalized = normalizeMode(mode);
    const resolved = resolveMode(normalized);
    document.documentElement.dataset.themeMode = normalized;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    window.dispatchEvent(
      new CustomEvent("youkong-theme-change", {
        detail: { mode: normalized, resolved },
      })
    );
  }

  function setMode(mode) {
    const normalized = normalizeMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // Ignore storage failures; the current page can still apply the theme.
    }
    applyMode(normalized);
  }

  window.youkongTheme = {
    modes: MODES,
    getMode,
    setMode,
    resolveMode: () => resolveMode(getMode()),
  };

  if (media) {
    const onSystemChange = () => {
      if (getMode() === "system") applyMode("system");
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onSystemChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(onSystemChange);
    }
  }

  applyMode(getMode());
})();
