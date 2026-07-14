(() => {
  function safeFileName(value = "youkong-activity") {
    return String(value || "youkong-activity").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60);
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  function icsDate(value, fallback) {
    const date = new Date(value || fallback || Date.now());
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }

  function icsText(value = "") {
    return String(value || "")
      .replaceAll("\\", "\\\\")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;")
      .replace(/\r?\n/g, "\\n");
  }

  function downloadCalendar(activity, url) {
    const start = new Date(activity.startsAt || Date.now());
    const end = activity.endsAt
      ? new Date(activity.endsAt)
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const content = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//YouKongBeFree//Activity//CN",
      "BEGIN:VEVENT",
      `UID:${activity.id || Date.now()}@youkong.local`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end, start.getTime() + 2 * 60 * 60 * 1000)}`,
      `SUMMARY:${icsText(activity.title)}`,
      `LOCATION:${icsText(activity.location || "有空客厅")}`,
      `DESCRIPTION:${icsText(`${activity.moduleName || "有空活动"}\\n${url}`)}`,
      `URL:${icsText(url)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    triggerDownload(new Blob([content], { type: "text/calendar;charset=utf-8" }), `${safeFileName(activity.title)}.ics`);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const chars = Array.from(String(text || ""));
    let line = "";
    let lines = 0;
    for (const char of chars) {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        y += lineHeight;
        lines += 1;
        line = char;
        if (lines >= maxLines - 1) break;
      } else {
        line = testLine;
      }
    }
    if (line && lines < maxLines) ctx.fillText(line, x, y);
    return y + lineHeight;
  }

  function drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  function apiBaseUrl() {
    return location.hostname.endsWith("tcloudbaseapp.com")
      ? "https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com"
      : "";
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error("missing image url"));
        return;
      }
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("image load failed"));
      image.src = url;
    });
  }

  async function loadQrImage(text) {
    const response = await fetch(`${apiBaseUrl()}/api/qr?text=${encodeURIComponent(text)}`, {
      credentials: "omit",
    });
    if (!response.ok) throw new Error("qr failed");
    const svg = await response.text();
    const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const image = new Image();
    image.src = blobUrl;
    await image.decode();
    return {
      image,
      revoke: () => URL.revokeObjectURL(blobUrl),
    };
  }

  function posterTitle(activity) {
    const title = String(activity.title || "有空活动").trim();
    const moduleName = String(activity.moduleName || "有空活动").trim();
    if (title.includes("丨") || title.includes("|")) return `【${title}】`;
    return `【${moduleName}丨${title}】`;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function posterDateRange(activity) {
    const start = new Date(activity.startsAt || Date.now());
    const end = activity.endsAt
      ? new Date(activity.endsAt)
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const format = (date) => `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return `${format(start)} - ${format(end)}`;
  }

  function posterAddress(activity) {
    const location = String(activity.location || "").trim();
    if (!location || location === "有空客厅") return "有空客厅|江北劳动一村";
    return location;
  }

  function inviteeDetails(options = {}) {
    const fromRegistration = options.registration || {};
    const fromGetter = typeof options.getInvitee === "function" ? options.getInvitee() || {} : {};
    return {
      nickname: String(fromRegistration.nickname || fromGetter.nickname || "有空的朋友").trim(),
      phone: String(fromRegistration.phone || fromGetter.phone || "报名后填写手机号").trim(),
    };
  }

  function drawKeyValue(ctx, label, value, x, y, maxWidth) {
    ctx.fillStyle = "#7e3b2c";
    ctx.font = "700 34px -apple-system, BlinkMacSystemFont, sans-serif";
    const labelText = `${label}：`;
    ctx.fillText(labelText, x, y);
    const offset = ctx.measureText(labelText).width + 8;
    ctx.fillStyle = "#17231f";
    ctx.font = "500 34px -apple-system, BlinkMacSystemFont, sans-serif";
    return wrapText(ctx, `【${value || "待定"}】`, x + offset, y, maxWidth - offset, 48, 2);
  }

  function drawStackedValue(ctx, label, value, x, y, maxWidth) {
    ctx.fillStyle = "#7e3b2c";
    ctx.font = "700 34px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`${label}：`, x, y);
    ctx.fillStyle = "#17231f";
    ctx.font = "500 36px -apple-system, BlinkMacSystemFont, sans-serif";
    return wrapText(ctx, `【${value || "待定"}】`, x, y + 52, maxWidth, 52, 3);
  }

  function drawFullCover(ctx, image, x, y, width, height) {
    ctx.save();
    drawRoundRect(ctx, x, y, width, height, 28);
    ctx.clip();
    ctx.drawImage(image, x, y, width, height);
    ctx.restore();
  }

  async function downloadPoster(activity, url, formatActivityTime, options = {}) {
    let coverImage = null;
    try {
      coverImage = activity.coverUrl ? await loadImage(activity.coverUrl) : null;
    } catch {
      coverImage = null;
    }
    const coverWidth = 936;
    const coverHeight = coverImage
      ? Math.max(360, Math.round(coverWidth * (coverImage.naturalHeight || coverImage.height) / (coverImage.naturalWidth || coverImage.width)))
      : 500;
    const canvasHeight = Math.max(1540, 96 + coverHeight + 1040);
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    const bg = ctx.createLinearGradient(0, 0, 1080, canvasHeight);
    bg.addColorStop(0, "#f8f5ef");
    bg.addColorStop(0.56, "#e9f1ee");
    bg.addColorStop(1, "#d8e6f1");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(16, 32, 38, 0.08)";
    drawRoundRect(ctx, 54, 74, 972, canvasHeight - 148, 36);
    ctx.fill();

    if (coverImage) {
      drawFullCover(ctx, coverImage, 72, 96, coverWidth, coverHeight);
    } else {
      ctx.fillStyle = "#203d38";
      drawRoundRect(ctx, 72, 96, 936, 500, 28);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.font = "700 72px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(activity.moduleName || "有空活动", 120, 370);
    }

    const contentTop = 96 + coverHeight + 84;
    ctx.fillStyle = "#17231f";
    ctx.font = "760 62px -apple-system, BlinkMacSystemFont, sans-serif";
    let y = wrapText(ctx, posterTitle(activity), 92, contentTop, 896, 78, 3) + 24;

    const invitee = inviteeDetails(options);
    y = drawKeyValue(ctx, "发起人", activity.initiator || "有空伙伴", 96, y, 760);
    y = drawKeyValue(ctx, "诚邀", invitee.nickname, 96, y + 12, 760);
    y = drawKeyValue(ctx, "报名手机号", invitee.phone, 96, y + 12, 760);
    y = drawStackedValue(ctx, "地址", posterAddress(activity), 96, y + 28, 620);
    y = drawStackedValue(ctx, "日期", posterDateRange(activity) || formatActivityTime(activity), 96, y + 18, 620);

    const qrSize = 218;
    const qrX = 1080 - 96 - qrSize;
    const qrY = canvasHeight - 96 - qrSize;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    drawRoundRect(ctx, qrX - 18, qrY - 18, qrSize + 36, qrSize + 60, 28);
    ctx.fill();
    let qrResource = null;
    try {
      qrResource = await loadQrImage(url);
      ctx.drawImage(qrResource.image, qrX, qrY, qrSize, qrSize);
    } catch {
      ctx.fillStyle = "#e9f1ee";
      ctx.fillRect(qrX, qrY, qrSize, qrSize);
      ctx.fillStyle = "#17231f";
      ctx.font = "700 28px -apple-system, BlinkMacSystemFont, sans-serif";
      wrapText(ctx, "扫码报名", qrX + 38, qrY + 106, qrSize - 76, 36, 2);
    } finally {
      qrResource?.revoke();
    }
    ctx.fillStyle = "#4f665f";
    ctx.font = "700 26px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("活动二维码", qrX + qrSize / 2, qrY + qrSize + 34);
    ctx.textAlign = "start";

    const footerY = Math.max(y + 48, canvasHeight - 180);
    ctx.fillStyle = "#b84b38";
    ctx.font = "700 34px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("有空客厅", 96, footerY);
    ctx.fillStyle = "#304540";
    ctx.font = "400 30px -apple-system, BlinkMacSystemFont, sans-serif";
    wrapText(ctx, "来客厅坐坐，也可以把这个活动分享给朋友。", 96, footerY + 54, 620, 44, 2);
    ctx.fillStyle = "#4f665f";
    ctx.font = "400 24px -apple-system, BlinkMacSystemFont, sans-serif";
    wrapText(ctx, url, 96, footerY + 128, 620, 34, 2);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.94));
    if (blob) triggerDownload(blob, `${safeFileName(activity.title)}-分享海报.png`);
  }

  function mount(root, activity, options = {}) {
    if (!root || !activity) return;
    const url = new URL(`activity.html?id=${encodeURIComponent(activity.id)}`, location.href).href;
    const showToast = options.showToast || ((text) => window.dispatchEvent(new CustomEvent("youkong-toast", { detail: text })));
    const formatActivityTime = options.formatActivityTime || (() => activity.startsAt || "时间待定");

    root.querySelector("[data-copy-registration-link]")?.addEventListener("click", async () => {
      try {
        await copyText(url);
        showToast("报名链接已复制");
      } catch {
        showToast("复制失败，请手动复制地址栏链接");
      }
    });
    root.querySelector("[data-download-calendar]")?.addEventListener("click", () => {
      downloadCalendar(activity, url);
      showToast("日历文件已生成");
    });
    root.querySelector("[data-download-poster]")?.addEventListener("click", async () => {
      try {
        await downloadPoster(activity, url, formatActivityTime, options);
        showToast("分享海报已生成");
      } catch {
        showToast("海报生成失败，请稍后再试");
      }
    });
  }

  window.youkongActivityShare = {
    mount,
  };
})();
