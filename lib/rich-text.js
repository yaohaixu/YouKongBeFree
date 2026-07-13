"use strict";

const ALLOWED_INLINE_TAGS = new Set(["strong", "b", "em", "i", "u", "br"]);
const ALLOWED_BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "hr"]);
const ALLOWED_TAGS = new Set([...ALLOWED_INLINE_TAGS, ...ALLOWED_BLOCK_TAGS, "a", "img"]);
const MAX_INLINE_IMAGE_CHARS = 220000;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function getAttribute(tagSource, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = String(tagSource || "").match(pattern);
  return match ? (match[2] || match[3] || match[4] || "") : "";
}

function safeUrl(value = "") {
  const url = String(value || "").trim();
  if (/^(https?:|mailto:)/i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return "";
}

function safeImageSource(value = "") {
  const source = String(value || "").trim();
  if (/^https?:\/\//i.test(source)) return source;
  if (source.startsWith("/") && !source.startsWith("//")) return source;
  if (
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i.test(source)
    && source.length <= MAX_INLINE_IMAGE_CHARS
  ) {
    return source;
  }
  return "";
}

function sanitizeTag(tagSource = "") {
  const closing = /^<\s*\//.test(tagSource);
  const tagMatch = String(tagSource).match(/^<\s*\/?\s*([a-z0-9]+)/i);
  if (!tagMatch) return "";

  const tag = tagMatch[1].toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) return "";
  if (tag === "br" || tag === "hr") return closing ? "" : `<${tag}>`;
  if (closing) return tag === "img" ? "" : `</${tag}>`;

  if (tag === "a") {
    const href = safeUrl(getAttribute(tagSource, "href"));
    return href ? `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">` : "<a>";
  }

  if (tag === "img") {
    const src = safeImageSource(getAttribute(tagSource, "src"));
    if (!src) return "";
    const alt = getAttribute(tagSource, "alt").slice(0, 120);
    return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}">`;
  }

  return `<${tag}>`;
}

function sanitizeRichText(value = "") {
  const raw = String(value || "")
    .replace(/\u0000/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .trim();
  if (!raw) return "";

  let output = "";
  let cursor = 0;
  const tagPattern = /<[^>]*>/g;
  for (const match of raw.matchAll(tagPattern)) {
    output += escapeHtml(raw.slice(cursor, match.index));
    output += sanitizeTag(match[0]);
    cursor = match.index + match[0].length;
  }
  output += escapeHtml(raw.slice(cursor));

  return output
    .replace(/(<br>\s*){4,}/g, "<br><br>")
    .replace(/<p>\s*<\/p>/g, "")
    .trim();
}

function richTextLengthExcludingImages(value = "") {
  return String(value || "").replace(/<img\b[^>]*>/gi, "").length;
}

function hasRichMarkup(value = "") {
  return /<(p|h1|h2|h3|ul|ol|li|blockquote|strong|b|em|i|u|a|img|br|hr)(\s|>|\/)/i.test(String(value || ""));
}

module.exports = {
  escapeHtml,
  hasRichMarkup,
  richTextLengthExcludingImages,
  sanitizeRichText,
};
