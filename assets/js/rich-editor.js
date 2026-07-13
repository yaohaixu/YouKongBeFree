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

  function execEditorCommand(command, editor, imageInput) {
    editor.focus();
    if (command === "p") {
      document.execCommand("formatBlock", false, "p");
    } else if (command === "h1" || command === "h2" || command === "h3" || command === "blockquote") {
      document.execCommand("formatBlock", false, command);
    } else if (command === "ul") {
      document.execCommand("insertUnorderedList", false);
    } else if (command === "ol") {
      document.execCommand("insertOrderedList", false);
    } else if (command === "hr") {
      document.execCommand("insertHTML", false, "<hr>");
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
        ${makeButton("—", "hr", "分隔线")}
        ${makeButton("图", "image", "插入正文图片")}
      </div>
      <div class="rich-canvas" data-rich-canvas contenteditable="true" role="textbox" aria-multiline="true"></div>
      <input data-rich-image-input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden />
      <p class="rich-hint">正文图片可选择 10MB 以内文件，系统会压缩到约 1MB 后上传；图片不计入描述字数上限。</p>
    `;
    source.insertAdjacentElement("afterend", editor);

    const canvas = qs("[data-rich-canvas]", editor);
    const imageInput = qs("[data-rich-image-input]", editor);
    canvas.dataset.placeholder = source.placeholder || "写下活动介绍。";
    setHtml(form, source.value || "");

    document.execCommand("defaultParagraphSeparator", false, "p");
    editor.addEventListener("click", (event) => {
      const button = event.target.closest("[data-rich-command]");
      if (!button) return;
      execEditorCommand(button.dataset.richCommand, canvas, imageInput);
      sync(form);
    });
    canvas.addEventListener("input", () => sync(form));
    canvas.addEventListener("paste", (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") || "";
      document.execCommand("insertText", false, text);
      sync(form);
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
        document.execCommand("insertHTML", false, `<p><img src="${url}" alt=""></p>`);
        sync(form);
        window.dispatchEvent(new CustomEvent("youkong-toast", { detail: "图片已插入" }));
      } catch (error) {
        window.dispatchEvent(new CustomEvent("youkong-toast", { detail: error.message || "图片处理失败" }));
      }
    });

    return { sync: () => sync(form), setHtml: (value) => setHtml(form, value), reset: () => reset(form) };
  }

  window.youkongRichEditor = {
    mount,
    reset,
    setHtml,
    sync,
  };
})();
