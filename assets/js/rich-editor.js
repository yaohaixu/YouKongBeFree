(() => {
  const MAX_INLINE_IMAGE_BYTES = 160 * 1024;

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
    return /<(p|h2|h3|ul|ol|li|blockquote|strong|b|em|i|u|a|img|br|hr)(\s|>|\/)/i.test(String(value || ""));
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
    } else if (command === "h2" || command === "h3" || command === "blockquote") {
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
    const source = qs('textarea[name="description"]', form);
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
      <p class="rich-hint">正文图片会随描述保存，建议用于小图。大图仍建议上传为首页图。</p>
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
    imageInput.addEventListener("change", () => {
      const file = imageInput.files && imageInput.files[0];
      imageInput.value = "";
      if (!file) return;
      if (file.size > MAX_INLINE_IMAGE_BYTES) {
        window.dispatchEvent(new CustomEvent("youkong-toast", { detail: "正文图片不能超过 160KB" }));
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        canvas.focus();
        document.execCommand("insertHTML", false, `<p><img src="${reader.result}" alt=""></p>`);
        sync(form);
      });
      reader.readAsDataURL(file);
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
