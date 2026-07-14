(() => {
  const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
  const MAX_COMPRESSED_IMAGE_BYTES = 1024 * 1024;
  const MAX_IMAGE_SIDE = 1600;

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function looksLikeHtml(value = "") {
    return /<(p|h1|h2|h3|ul|ol|li|blockquote|strong|b|em|i|u|a|img|br|hr)(\s|>|\/)/i.test(String(value || ""));
  }

  function textToParagraphs(value = "") {
    return String(value || "")
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function normalizeHtml(value = "") {
    return String(value || "")
      .replace(/<div><br><\/div>/gi, "<p><br></p>")
      .replace(/<div>/gi, "<p>")
      .replace(/<\/div>/gi, "</p>")
      .replace(/<span[^>]*>/gi, "")
      .replace(/<\/span>/gi, "")
      .replace(/\s?style="[^"]*"/gi, "")
      .replace(/\s?class="[^"]*"/gi, "")
      .trim();
  }

  function makeButton(label, command, title = label) {
    return `<button class="rich-tool" type="button" data-rich-command="${command}" title="${title}" aria-label="${title}">${label}</button>`;
  }

  function activeBlockTag(editor) {
    const block = activeBlockElement(editor);
    return block ? block.tagName.toLowerCase() : "p";
  }

  function activeBlockElement(editor) {
    const selection = window.getSelection();
    let node = selection && selection.rangeCount ? selection.anchorNode : null;
    if (!node || !editor.contains(node)) return null;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const block = node && node.closest ? node.closest("h1,h2,h3,blockquote,p,li") : null;
    if (!block || !editor.contains(block)) return null;
    return block;
  }

  function saveSelection(editor) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    if (!container || !editor.contains(container)) return null;
    return range.cloneRange();
  }

  function restoreSelection(range) {
    if (!range) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function insertHtmlAtSelection(html) {
    if (document.queryCommandSupported && document.queryCommandSupported("insertHTML")) {
      document.execCommand("insertHTML", false, html);
      return;
    }
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const template = document.createElement("template");
    template.innerHTML = html;
    range.insertNode(template.content);
    selection.collapseToEnd();
  }

  function insertBlockHtmlAtSelection(editor, html) {
    const selection = window.getSelection();
    const template = document.createElement("template");
    template.innerHTML = html;
    const fragment = template.content;
    const lastNode = fragment.lastElementChild;
    if (!selection || !selection.rangeCount) {
      editor.append(fragment);
      return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    let node = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    const block = node && node.closest ? node.closest("p,h1,h2,h3,blockquote,li") : null;
    if (block && editor.contains(block)) {
      if (!block.textContent.trim() && !block.querySelector("img")) {
        block.replaceWith(fragment);
      } else {
        block.after(fragment);
      }
    } else {
      range.insertNode(fragment);
    }
    if (lastNode) {
      const nextRange = document.createRange();
      nextRange.selectNodeContents(lastNode);
      nextRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(nextRange);
    }
  }

  function formatBlock(editor, tagName) {
    const current = activeBlockTag(editor);
    const next = current === tagName ? "p" : tagName;
    document.execCommand("formatBlock", false, next);
    if (activeBlockTag(editor) === next) return;
    const block = activeBlockElement(editor);
    if (!block || block.tagName.toLowerCase() === "li") return;
    const replacement = document.createElement(next);
    while (block.firstChild) replacement.appendChild(block.firstChild);
    block.replaceWith(replacement);
    const range = document.createRange();
    range.selectNodeContents(replacement);
    range.collapse(false);
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function updateToolbarState(form) {
    const editor = qs("[data-rich-editor]", form);
    const canvas = qs("[data-rich-canvas]", form);
    if (!editor || !canvas) return;
    const block = activeBlockTag(canvas);
    const states = {
      p: block === "p" || block === "li",
      h1: block === "h1",
      h2: block === "h2",
      h3: block === "h3",
      blockquote: block === "blockquote",
      bold: document.queryCommandState("bold"),
      ul: document.queryCommandState("insertUnorderedList"),
      ol: document.queryCommandState("insertOrderedList"),
    };
    qsa("[data-rich-command]", editor).forEach((button) => {
      const active = Boolean(states[button.dataset.richCommand]);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function execEditorCommand(command, editor, imageInput) {
    editor.focus();
    if (command === "p") {
      document.execCommand("formatBlock", false, "p");
    } else if (command === "h1" || command === "h2" || command === "h3" || command === "blockquote") {
      formatBlock(editor, command);
    } else if (command === "ul") {
      document.execCommand("insertUnorderedList", false);
    } else if (command === "ol") {
      document.execCommand("insertOrderedList", false);
    } else if (command === "hr") {
      insertHtmlAtSelection("<hr><p><br></p>");
    } else if (command === "image") {
      imageInput.click();
    } else {
      document.execCommand(command, false);
    }
  }

  function apiBaseUrl() {
    return location.hostname.endsWith("tcloudbaseapp.com")
      ? "https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com"
      : "";
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("图片读取失败"));
      };
      image.src = url;
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });
  }

  async function compressImage(file) {
    const image = await loadImage(file);
    const attempts = [
      [MAX_IMAGE_SIDE, 0.82],
      [MAX_IMAGE_SIDE, 0.72],
      [MAX_IMAGE_SIDE, 0.62],
      [1280, 0.72],
      [1280, 0.6],
      [1024, 0.66],
      [1024, 0.54],
    ];

    let fallback = null;
    for (const [maxSide, quality] of attempts) {
      const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
      const width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
      const height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const blob = await canvasToBlob(canvas, quality);
      if (!blob) continue;
      fallback = blob;
      if (blob.size <= MAX_COMPRESSED_IMAGE_BYTES) return blob;
    }

    if (fallback && fallback.size <= MAX_COMPRESSED_IMAGE_BYTES * 1.1) return fallback;
    throw new Error("图片压缩后仍超过 1MB，请换一张图或先裁剪");
  }

  async function uploadRichImage(blob, originalName = "rich-image.jpg") {
    const token = localStorage.getItem("yk_session_token");
    const formData = new FormData();
    const safeName = /\.[^.]+$/.test(originalName) ? originalName.replace(/\.[^.]+$/, ".jpg") : `${originalName}.jpg`;
    formData.append("image", blob, safeName);
    const response = await fetch(`${apiBaseUrl()}/api/uploads/rich-image`, {
      method: "POST",
      credentials: "include",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "图片上传失败");
    return data.url;
  }

  function sync(form) {
    const source = qs("[data-rich-source]", form);
    const editor = qs("[data-rich-canvas]", form);
    if (!source || !editor) return "";
    const html = normalizeHtml(editor.innerHTML);
    source.value = html;
    return html;
  }

  function setHtml(form, value = "") {
    const source = qs("[data-rich-source]", form);
    const editor = qs("[data-rich-canvas]", form);
    if (!source || !editor) return;
    const html = looksLikeHtml(value) ? normalizeHtml(value) : textToParagraphs(value);
    source.value = html;
    editor.innerHTML = html;
  }

  function reset(form) {
    setHtml(form, "");
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function mount(form) {
    const source = qs("[data-rich-textarea], textarea[name=\"description\"], textarea[name=\"content\"]", form);
    if (!source || qs("[data-rich-editor]", form)) return null;

    source.classList.add("rich-source");
    source.setAttribute("data-rich-source", "");
    source.removeAttribute("required");

    const editor = document.createElement("div");
    editor.className = "rich-editor";
    editor.setAttribute("data-rich-editor", "");
    editor.innerHTML = `
      <div class="rich-toolbar" aria-label="活动描述排版工具">
        ${makeButton("正文", "p", "正文段落")}
        ${makeButton("H1", "h1", "一级标题")}
        ${makeButton("H2", "h2", "二级标题")}
        ${makeButton("H3", "h3", "三级标题")}
        ${makeButton("B", "bold", "加粗")}
        ${makeButton("“”", "blockquote", "引用")}
        ${makeButton("•", "ul", "项目列表")}
        ${makeButton("1.", "ol", "编号列表")}
        ${makeButton("线", "hr", "分隔线")}
        ${makeButton("图", "image", "插入正文图片")}
      </div>
      <div class="rich-canvas" data-rich-canvas contenteditable="true" role="textbox" aria-multiline="true"></div>
      <input data-rich-image-input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden />
      <p class="rich-hint">正文图片可选择 10MB 以内文件，系统会压缩到约 1MB 后上传；图片不计入描述字数上限。</p>
    `;
    source.insertAdjacentElement("afterend", editor);

    const canvas = qs("[data-rich-canvas]", editor);
    const imageInput = qs("[data-rich-image-input]", editor);
    let savedRange = null;
    let lastPointerCommandAt = 0;
    canvas.dataset.placeholder = source.placeholder || "写下活动介绍。";
    setHtml(form, source.value || "");

    document.execCommand("defaultParagraphSeparator", false, "p");
    const runCommand = (button) => {
      restoreSelection(savedRange);
      execEditorCommand(button.dataset.richCommand, canvas, imageInput);
      sync(form);
      savedRange = saveSelection(canvas);
      updateToolbarState(form);
    };
    editor.addEventListener("pointerdown", (event) => {
      if (event.target.closest("[data-rich-command]")) {
        event.preventDefault();
        savedRange = saveSelection(canvas) || savedRange;
      }
    });
    editor.addEventListener("pointerup", (event) => {
      const button = event.target.closest("[data-rich-command]");
      if (!button) return;
      event.preventDefault();
      lastPointerCommandAt = Date.now();
      runCommand(button);
    });
    editor.addEventListener("click", (event) => {
      const button = event.target.closest("[data-rich-command]");
      if (!button) return;
      if (Date.now() - lastPointerCommandAt < 450) return;
      runCommand(button);
    });
    canvas.addEventListener("keyup", () => {
      savedRange = saveSelection(canvas);
      updateToolbarState(form);
    });
    canvas.addEventListener("mouseup", () => {
      savedRange = saveSelection(canvas);
      updateToolbarState(form);
    });
    canvas.addEventListener("focus", () => {
      savedRange = saveSelection(canvas);
      updateToolbarState(form);
    });
    canvas.addEventListener("input", () => {
      savedRange = saveSelection(canvas);
      sync(form);
      updateToolbarState(form);
    });
    canvas.addEventListener("paste", (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") || "";
      if (/\n/.test(text)) {
        insertBlockHtmlAtSelection(canvas, textToParagraphs(text));
      } else {
        document.execCommand("insertText", false, text);
      }
      sync(form);
      savedRange = saveSelection(canvas);
      updateToolbarState(form);
    });
    document.addEventListener("selectionchange", () => {
      if (document.activeElement === canvas) {
        savedRange = saveSelection(canvas);
        updateToolbarState(form);
      }
    });
    imageInput.addEventListener("change", async () => {
      const file = imageInput.files && imageInput.files[0];
      imageInput.value = "";
      if (!file) return;
      if (file.size > MAX_SOURCE_IMAGE_BYTES) {
        window.dispatchEvent(new CustomEvent("youkong-toast", { detail: "请选择 10MB 以内的图片" }));
        return;
      }
      try {
        window.dispatchEvent(new CustomEvent("youkong-toast", { detail: "正在压缩并上传图片..." }));
        const compressed = await compressImage(file);
        const url = await uploadRichImage(compressed, file.name || "rich-image.jpg");
        canvas.focus();
        restoreSelection(savedRange);
        insertHtmlAtSelection(`<p><img src="${url}" alt=""></p><p><br></p>`);
        sync(form);
        savedRange = saveSelection(canvas);
        updateToolbarState(form);
        window.dispatchEvent(new CustomEvent("youkong-toast", { detail: "图片已插入" }));
      } catch (error) {
        window.dispatchEvent(new CustomEvent("youkong-toast", { detail: error.message || "图片处理失败" }));
      }
    });

    updateToolbarState(form);

    return {
      sync: () => sync(form),
      setHtml: (value) => {
        setHtml(form, value);
        updateToolbarState(form);
      },
      reset: () => {
        reset(form);
        updateToolbarState(form);
      },
    };
  }

  window.youkongRichEditor = {
    mount,
    reset,
    setHtml,
    sync,
  };
})();
