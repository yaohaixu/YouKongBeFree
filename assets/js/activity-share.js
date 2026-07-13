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

  async function drawCover(ctx, activity) {
    if (!activity.coverUrl) return false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = activity.coverUrl;
    await image.decode();
    ctx.save();
    drawRoundRect(ctx, 72, 96, 936, 500, 28);
    ctx.clip();
    const ratio = Math.max(936 / image.width, 500 / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    ctx.drawImage(image, 72 + (936 - width) / 2, 96 + (500 - height) / 2, width, height);
    ctx.restore();
    return true;
  }

  async function downloadPoster(activity, url, formatActivityTime) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1440;
    const ctx = canvas.getContext("2d");
    const bg = ctx.createLinearGradient(0, 0, 1080, 1440);
    bg.addColorStop(0, "#f8f5ef");
    bg.addColorStop(0.56, "#e9f1ee");
    bg.addColorStop(1, "#d8e6f1");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(16, 32, 38, 0.08)";
    drawRoundRect(ctx, 54, 74, 972, 1292, 36);
    ctx.fill();

    let hasCover = false;
    try {
      hasCover = await drawCover(ctx, activity);
    } catch {
      hasCover = false;
    }
    if (!hasCover) {
      ctx.fillStyle = "#203d38";
      drawRoundRect(ctx, 72, 96, 936, 500, 28);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.font = "700 72px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(activity.moduleName || "有空活动", 120, 370);
    }

    ctx.fillStyle = "#17231f";
    ctx.font = "700 74px -apple-system, BlinkMacSystemFont, sans-serif";
    wrapText(ctx, activity.title || "有空活动", 92, 710, 896, 92, 3);

    ctx.fillStyle = "#34524a";
    ctx.font = "400 38px -apple-system, BlinkMacSystemFont, sans-serif";
    wrapText(ctx, `${activity.location || "地点待定"} · ${formatActivityTime(activity)}`, 96, 1008, 880, 56, 3);

    ctx.fillStyle = "#b84b38";
    ctx.font = "700 34px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("有空客厅", 96, 1196);
    ctx.fillStyle = "#304540";
    ctx.font = "400 30px -apple-system, BlinkMacSystemFont, sans-serif";
    wrapText(ctx, "复制报名链接，来客厅坐坐。", 96, 1250, 720, 44, 2);
    ctx.fillStyle = "#4f665f";
    ctx.font = "400 24px -apple-system, BlinkMacSystemFont, sans-serif";
    wrapText(ctx, url, 96, 1326, 860, 34, 2);

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
        await downloadPoster(activity, url, formatActivityTime);
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
