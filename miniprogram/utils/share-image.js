const api = require("./api");
const { formatActivityTime } = require("./format");

const WEB_BASE = "https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com";
const CANVAS_ID = "shareCanvas";

function pad(value) {
  return String(value).padStart(2, "0");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setCanvasData(page, width, height) {
  return new Promise((resolve) => {
    page.setData({ shareCanvasWidth: width, shareCanvasHeight: height }, resolve);
  });
}

function setFill(ctx, color) {
  if (ctx.setFillStyle) ctx.setFillStyle(color);
  else ctx.fillStyle = color;
}

function setStroke(ctx, color) {
  if (ctx.setStrokeStyle) ctx.setStrokeStyle(color);
  else ctx.strokeStyle = color;
}

function setText(ctx, size, color, align = "left") {
  setFill(ctx, color);
  if (ctx.setFontSize) ctx.setFontSize(size);
  if (ctx.setTextAlign) ctx.setTextAlign(align);
  if ("font" in ctx) ctx.font = `${size}px -apple-system, BlinkMacSystemFont, PingFang SC, sans-serif`;
  if ("textAlign" in ctx) ctx.textAlign = align;
}

function measureText(ctx, text, size) {
  if (ctx.measureText) {
    const measured = ctx.measureText(String(text || ""));
    if (measured && Number.isFinite(measured.width)) return measured.width;
  }
  return Array.from(String(text || "")).length * size * 0.56;
}

function fillRoundedRect(ctx, x, y, width, height, radius, color) {
  setFill(ctx, color);
  if (ctx.beginPath && ctx.arcTo) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.fillRect(x, y, width, height);
}

function strokeRoundedRect(ctx, x, y, width, height, radius, color) {
  setStroke(ctx, color);
  if (ctx.beginPath && ctx.arcTo) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.stroke();
    return;
  }
  ctx.strokeRect(x, y, width, height);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines, size) {
  const chars = Array.from(String(text || ""));
  let line = "";
  let lines = 0;
  for (const char of chars) {
    const next = line + char;
    if (line && measureText(ctx, next, size) > maxWidth) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lines += 1;
      line = char;
      if (lines >= maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y);
  return y + lineHeight;
}

function drawLabelValue(ctx, label, value, x, y, maxWidth) {
  const labelText = `${label}: `;
  setText(ctx, 34, "#8d4637");
  ctx.fillText(labelText, x, y);
  const offset = measureText(ctx, labelText, 34) + 6;
  setText(ctx, 34, "#17231f");
  return wrapText(ctx, value || "待定", x + offset, y, maxWidth - offset, 48, 2, 34);
}

function drawInlineValue(ctx, label, value, x, y, maxWidth) {
  const labelText = `${label}: `;
  setText(ctx, 31, "#8d4637");
  ctx.fillText(labelText, x, y);
  const offset = measureText(ctx, labelText, 31) + 5;
  const text = String(value || "待定");
  let size = 31;
  while (size > 23 && measureText(ctx, text, size) > maxWidth - offset) {
    size -= 1;
  }
  setText(ctx, size, "#17231f");
  ctx.fillText(text, x + offset, y);
  return y + 46;
}

function activityUrl(activityId) {
  return `${WEB_BASE}/activity.html?id=${encodeURIComponent(activityId || "")}`;
}

function feedbackUrl(activityId) {
  return `${WEB_BASE}/activity-feedback.html?id=${encodeURIComponent(activityId || "")}`;
}

function roomLogsUrl(roomLogId = "") {
  const query = roomLogId ? `#${encodeURIComponent(roomLogId)}` : "";
  return `${WEB_BASE}/room-logs.html${query}`;
}

function safeFileName(value = "youkong") {
  return String(value || "youkong").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60);
}

function posterTitle(activity = {}) {
  const title = String(activity.title || "有空活动").trim();
  const moduleName = String(activity.moduleName || activity.displaySource || "有空活动").trim();
  if (title.includes("丨") || title.includes("|")) return title.replace(/\|/g, "丨");
  return `${moduleName}丨${title}`;
}

function posterDateRange(activity = {}) {
  const start = new Date(activity.startsAt || Date.now());
  const end = activity.endsAt
    ? new Date(activity.endsAt)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const format = (date) => `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${format(start)}-${format(end)}`;
}

async function qrMatrix(text) {
  return api.get(`/api/qr-data?text=${encodeURIComponent(text)}`);
}

function drawQr(ctx, matrix, x, y, size) {
  const qrSize = Number(matrix.size || 0);
  const margin = Number(matrix.margin || 2);
  const data = Array.isArray(matrix.data) ? matrix.data : [];
  const modules = qrSize + margin * 2;
  const cell = size / modules;
  setFill(ctx, "#ffffff");
  ctx.fillRect(x, y, size, size);
  setFill(ctx, "#17231f");
  for (let row = 0; row < qrSize; row += 1) {
    for (let col = 0; col < qrSize; col += 1) {
      if (!data[row * qrSize + col]) continue;
      ctx.fillRect(
        x + (col + margin) * cell,
        y + (row + margin) * cell,
        Math.ceil(cell),
        Math.ceil(cell)
      );
    }
  }
}

function getImageInfo(src) {
  return new Promise((resolve, reject) => {
    if (!src || !/^https?:\/\//.test(src)) {
      reject(new Error("missing image"));
      return;
    }
    wx.getImageInfo({
      src,
      success: resolve,
      fail: reject,
    });
  });
}

function canvasToJpg(page, width, height) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvasId: CANVAS_ID,
      x: 0,
      y: 0,
      width,
      height,
      destWidth: width,
      destHeight: height,
      fileType: "jpg",
      quality: 0.92,
      success: (res) => resolve(res.tempFilePath),
      fail: reject,
    }, page);
  });
}

function drawCanvas(ctx) {
  return new Promise((resolve) => {
    ctx.draw(false, () => setTimeout(resolve, 120));
  });
}

async function generateQrCard(page, options = {}) {
  const width = 900;
  const height = 1180;
  await setCanvasData(page, width, height);
  await sleep(80);
  const ctx = wx.createCanvasContext(CANVAS_ID, page);
  setFill(ctx, "#f8f5ef");
  ctx.fillRect(0, 0, width, height);
  fillRoundedRect(ctx, 54, 58, width - 108, height - 116, 36, "rgba(255,255,255,0.9)");
  strokeRoundedRect(ctx, 54, 58, width - 108, height - 116, 36, "rgba(23,35,31,0.14)");

  setText(ctx, 28, "#8d4637");
  ctx.fillText(options.eyebrow || "有空客厅", 100, 138);
  setText(ctx, 48, "#17231f");
  wrapText(ctx, options.title || "活动二维码", 100, 210, 700, 62, 2, 48);
  setText(ctx, 26, "#53645d");
  wrapText(ctx, options.subtitle || "扫码打开活动页面", 100, 338, 700, 42, 2, 26);

  const matrix = await qrMatrix(options.text || "");
  drawQr(ctx, matrix, 170, 430, 560);
  setText(ctx, 30, "#17231f", "center");
  ctx.fillText(options.label || "扫码查看", width / 2, 1050);
  setText(ctx, 24, "#6b776f", "center");
  ctx.fillText("youkongbefree", width / 2, 1092);

  await drawCanvas(ctx);
  return canvasToJpg(page, width, height);
}

async function generateActivityPoster(page, activity = {}, options = {}) {
  const coverInfo = await getImageInfo(activity.coverUrl).catch(() => null);
  const width = 1080;
  const coverWidth = 936;
  const coverHeight = coverInfo
    ? Math.max(360, Math.round(coverWidth * coverInfo.height / Math.max(coverInfo.width, 1)))
    : 500;
  const contentTop = 96 + coverHeight + 84;
  const height = Math.max(1640, contentTop + 770);

  await setCanvasData(page, width, height);
  await sleep(80);
  const ctx = wx.createCanvasContext(CANVAS_ID, page);
  setFill(ctx, "#f8f5ef");
  ctx.fillRect(0, 0, width, height);
  fillRoundedRect(ctx, 54, 72, 972, height - 144, 36, "rgba(255,255,255,0.72)");
  strokeRoundedRect(ctx, 54, 72, 972, height - 144, 36, "rgba(23,35,31,0.1)");

  if (coverInfo) {
    fillRoundedRect(ctx, 72, 96, coverWidth, coverHeight, 28, "#e7ede5");
    ctx.drawImage(coverInfo.path, 72, 96, coverWidth, coverHeight);
  } else {
    fillRoundedRect(ctx, 72, 96, coverWidth, coverHeight, 28, "#203d38");
    setText(ctx, 64, "rgba(255,255,255,0.86)");
    ctx.fillText(activity.moduleName || activity.displaySource || "有空活动", 120, 380);
  }

  setText(ctx, 62, "#17231f");
  let y = wrapText(ctx, posterTitle(activity), 92, contentTop, 896, 78, 3, 62) + 22;
  y = drawLabelValue(ctx, "发起人", activity.initiator || activity.creatorName || "有空伙伴", 96, y, 760);
  setText(ctx, 38, "#8d4637");
  ctx.fillText("诚邀: ", 96, y + 18);
  setText(ctx, 50, "#17231f");
  y = wrapText(ctx, options.inviteeNickname || "有空的朋友", 226, y + 18, 720, 64, 2, 50);
  y = drawInlineValue(ctx, "地址", activity.location || "有空客厅", 96, y + 28, 860);
  y = drawInlineValue(ctx, "日期", posterDateRange(activity), 96, y + 14, 860);

  const qrSize = 224;
  const qrX = 760;
  const qrY = height - 390;
  fillRoundedRect(ctx, qrX - 20, qrY - 72, qrSize + 40, qrSize + 92, 28, "rgba(255,255,255,0.9)");
  setText(ctx, 27, "#53645d", "center");
  ctx.fillText("活动二维码", qrX + qrSize / 2, qrY - 30);
  const matrix = await qrMatrix(activityUrl(activity.id));
  drawQr(ctx, matrix, qrX, qrY, qrSize);

  setText(ctx, 34, "#b84b38");
  ctx.fillText("有空客厅", 96, height - 220);
  setText(ctx, 28, "#304540");
  wrapText(ctx, "来客厅坐坐，也可以把这个活动分享给朋友。", 96, height - 168, 600, 42, 2, 28);

  await drawCanvas(ctx);
  return canvasToJpg(page, width, height);
}

async function generateRoomLogPoster(page, roomStatus = {}, options = {}) {
  const log = roomStatus.currentLog || options.roomLog || {};
  const width = 900;
  const height = 1260;
  const tone = roomStatus.tone || log.tone || "empty";
  const toneColors = {
    open: { bg: "#eef8ef", accent: "#257b44", deep: "#112a1d" },
    upcoming: { bg: "#fff7e4", accent: "#9b6a12", deep: "#2f2412" },
    closed: { bg: "#fff0eb", accent: "#9f392b", deep: "#311714" },
    empty: { bg: "#f3f5f0", accent: "#53645d", deep: "#17231f" },
  };
  const colors = toneColors[tone] || toneColors.empty;
  const noteText = String(options.noteText || roomStatus.text || log.plainNote || "").replace(/\s+/g, " ").trim();
  const link = roomLogsUrl(log.id || "");

  await setCanvasData(page, width, height);
  await sleep(80);
  const ctx = wx.createCanvasContext(CANVAS_ID, page);
  setFill(ctx, "#f8f5ef");
  ctx.fillRect(0, 0, width, height);
  fillRoundedRect(ctx, 54, 58, width - 108, height - 116, 36, "rgba(255,255,255,0.88)");
  strokeRoundedRect(ctx, 54, 58, width - 108, height - 116, 36, "rgba(23,35,31,0.12)");
  fillRoundedRect(ctx, 82, 86, width - 164, 276, 30, colors.bg);

  setText(ctx, 28, colors.accent);
  ctx.fillText("有空客厅开门值班记录", 116, 146);
  setText(ctx, 54, colors.deep);
  wrapText(ctx, roomStatus.title || log.statusLabel || "今日暂无开门安排", 116, 222, 660, 68, 2, 54);
  setText(ctx, 28, "#53645d");
  const timing = log.timingText || (log.scheduledOpenAt ? `计划 ${log.scheduledOpenAt.slice(11, 16)}` : "");
  ctx.fillText(timing ? `轮值：${log.keeperName || "有空朋友"} · ${timing}` : "今天有没有人在客厅，打开小程序就知道。", 116, 330);

  setText(ctx, 34, colors.deep);
  let y = 438;
  y = wrapText(ctx, noteText || "点进值班记录，可以看看今天谁在客厅。", 104, y, 692, 54, 6, 34) + 40;

  fillRoundedRect(ctx, 104, y, 692, 2, 1, "rgba(23,35,31,0.1)");
  y += 72;
  setText(ctx, 30, "#8d4637");
  ctx.fillText("开门状态由轮值看门人确认", 104, y);
  setText(ctx, 27, "#53645d");
  wrapText(ctx, "AI 只审核公开文字，不决定客厅是否开门。欢迎有空的时候来坐坐。", 104, y + 54, 640, 44, 2, 27);

  const qrSize = 260;
  const qrX = 320;
  const qrY = height - 430;
  fillRoundedRect(ctx, qrX - 26, qrY - 80, qrSize + 52, qrSize + 120, 30, "rgba(255,255,255,0.92)");
  setText(ctx, 26, "#53645d", "center");
  ctx.fillText("扫码查看值班记录", qrX + qrSize / 2, qrY - 34);
  const matrix = await qrMatrix(link);
  drawQr(ctx, matrix, qrX, qrY, qrSize);
  setText(ctx, 24, "#6b776f", "center");
  ctx.fillText("youkongbefree", width / 2, height - 82);

  await drawCanvas(ctx);
  return canvasToJpg(page, width, height);
}

function saveImageToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail: reject,
    });
  });
}

function previewImage(filePath) {
  return new Promise((resolve, reject) => {
    wx.previewImage({
      urls: [filePath],
      current: filePath,
      success: resolve,
      fail: reject,
    });
  });
}

function showModal(options = {}) {
  return new Promise((resolve) => {
    wx.showModal({
      ...options,
      success: resolve,
      fail: () => resolve({ confirm: false }),
    });
  });
}

function openSetting() {
  return new Promise((resolve) => {
    if (!wx.openSetting) {
      resolve({});
      return;
    }
    wx.openSetting({
      success: resolve,
      fail: () => resolve({}),
    });
  });
}

function isAlbumAuthError(error = {}) {
  return /auth|authorize|permission|denied|cancel/i.test(String(error.errMsg || error.message || ""));
}

async function saveOrPreview(filePath) {
  try {
    await saveImageToAlbum(filePath);
    return { saved: true };
  } catch (error) {
    if (isAlbumAuthError(error)) {
      const modal = await showModal({
        title: "需要相册权限",
        content: "保存 JPG 图片需要允许访问相册。也可以先预览图片，再长按保存。",
        confirmText: "去设置",
        cancelText: "先预览",
      });
      if (modal.confirm) {
        await openSetting();
        try {
          await saveImageToAlbum(filePath);
          return { saved: true };
        } catch {
          // 用户仍未授权时继续走预览兜底。
        }
      }
    }
    await previewImage(filePath).catch(() => {});
    const nextError = new Error("已生成图片，可在预览中长按保存");
    nextError.previewed = true;
    throw nextError;
  }
}

module.exports = {
  activityUrl,
  feedbackUrl,
  roomLogsUrl,
  safeFileName,
  formatActivityTime,
  generateQrCard,
  generateActivityPoster,
  generateRoomLogPoster,
  saveOrPreview,
};
