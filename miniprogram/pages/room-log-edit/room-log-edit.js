const api = require("../../utils/api");
const cache = require("../../utils/cache");
const { stripHtml, responsiveRichTextHtml } = require("../../utils/format");

const EDITOR_MIN_HEIGHT = 340;
const EDITOR_MAX_HEIGHT = 820;

function pad(value) {
  return String(value).padStart(2, "0");
}

function datePart(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timePart(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function combineDateTime(date, time) {
  if (!date || !time) return "";
  return `${date}T${time}`;
}

function splitLocalDateTime(value = "", fallback = new Date()) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (match) return { date: match[1], time: match[2] };
  return { date: datePart(fallback), time: timePart(fallback) };
}

function normalizeRichHtml(value = "") {
  return String(value || "")
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\s+(style|class)\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+(style|class)\s*=\s*'[^']*'/gi, "")
    .replace(/\s+(href|src)\s*=\s*"(javascript:[^"]*)"/gi, "")
    .replace(/\s+(href|src)\s*=\s*'(javascript:[^']*)'/gi, "")
    .replace(/<p>\s*<\/p>/gi, "")
    .trim();
}

function estimateEditorHeight(html = "", text = "") {
  const plain = String(text || stripHtml(html || ""));
  const explicitLines = (plain.match(/\n/g) || []).length;
  const wrappedLines = Math.ceil(plain.length / 18);
  const blockLines = (String(html || "").match(/<\/p>|<h1\b|<li\b|<br\b|<hr\b/gi) || []).length;
  const lines = Math.max(4, explicitLines + wrappedLines + blockLines);
  return Math.max(EDITOR_MIN_HEIGHT, Math.min(EDITOR_MAX_HEIGHT, 220 + lines * 34));
}

function editorState(html = "", text = "") {
  const safeHtml = normalizeRichHtml(html || "");
  return {
    openNotePreview: responsiveRichTextHtml(safeHtml),
    openNoteEditorHeight: estimateEditorHeight(safeHtml, text || stripHtml(safeHtml))
  };
}

Page({
  data: {
    loading: false,
    submitting: false,
    editingId: "",
    today: "",
    formats: {},
    openNotePreview: "",
    openNoteEditorHeight: EDITOR_MIN_HEIGHT,
    form: {
      keeperName: "有空朋友",
      openDate: "",
      openTime: "",
      closeDate: "",
      closeTime: "",
      openNote: ""
    }
  },

  onLoad(options = {}) {
    this.pendingEditorHtml = "";
    this.setData({ editingId: options.id || "" });
    this.resetForm();
    if (options.id) this.loadRoomLog(options.id);
  },

  resetForm() {
    const now = new Date();
    const open = addHours(now, 2);
    const close = addHours(open, 4);
    this.pendingEditorHtml = "";
    this.setData({
      today: datePart(now),
      "form.openDate": datePart(open),
      "form.openTime": timePart(open),
      "form.closeDate": datePart(close),
      "form.closeTime": timePart(close),
      ...editorState("", "")
    });
  },

  async loadRoomLog(id) {
    this.setData({ loading: true });
    try {
      const data = await api.get(`/api/room-logs/${encodeURIComponent(id)}`);
      const roomLog = data.roomLog || {};
      this.loadedRoomLog = roomLog;
      if (!roomLog.canEditOpenNote) {
        this.setData({ loading: false });
        wx.showToast({ title: "已关门后不能编辑开门文字", icon: "none" });
        setTimeout(() => {
          wx.redirectTo({ url: `/pages/room-log-detail/room-log-detail?id=${encodeURIComponent(id)}` });
        }, 520);
        return;
      }
      this.fillForm(roomLog);
      this.setData({ loading: false });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || "读取失败", icon: "none" });
    }
  },

  fillForm(log = {}) {
    const open = splitLocalDateTime(log.scheduledOpenAt, addHours(new Date(), 2));
    const close = splitLocalDateTime(log.scheduledCloseAt, addHours(new Date(), 6));
    const html = log.openNote || "";
    this.pendingEditorHtml = html;
    this.setData({
      "form.keeperName": log.keeperName || "有空朋友",
      "form.openDate": open.date,
      "form.openTime": open.time,
      "form.closeDate": close.date,
      "form.closeTime": close.time,
      ...editorState(html, stripHtml(html))
    });
    this.setEditorContent(html);
  },

  onEditorReady() {
    wx.createSelectorQuery()
      .in(this)
      .select("#openNoteEditor")
      .context((res) => {
        this.editorCtx = res && res.context;
        this.setEditorContent(this.pendingEditorHtml || this.data.form.openNote || "");
      })
      .exec();
  },

  setEditorContent(html = "") {
    const safeHtml = normalizeRichHtml(html || "");
    this.pendingEditorHtml = safeHtml;
    if (!this.editorCtx) return;
    this.editorCtx.setContents({
      html: safeHtml,
      success: () => { this.pendingEditorHtml = ""; }
    });
  },

  syncEditor() {
    if (!this.editorCtx) return Promise.resolve(this.pendingEditorHtml || "");
    return new Promise((resolve) => {
      this.editorCtx.getContents({
        success: (res) => {
          this.setData(editorState(res.html || "", res.text || stripHtml(res.html || "")));
          resolve(res.html || "");
        },
        fail: () => resolve(this.pendingEditorHtml || "")
      });
    });
  },

  handleRichTextInput(event) {
    this.setData(editorState(event.detail.html || "", event.detail.text || ""));
  },

  handleRichTextStatusChange(event) {
    this.setData({ formats: event.detail || {} });
  },

  formatRichText(event) {
    if (!this.editorCtx) return;
    const name = event.currentTarget.dataset.name;
    let value = event.currentTarget.dataset.value;
    if (!name) return;
    if (name === "header") {
      value = value !== undefined ? value : this.data.formats.header === 1 || this.data.formats.header === "1" ? "" : "1";
    }
    this.editorCtx.format(name, value);
    setTimeout(() => this.syncEditor(), 120);
  },

  insertDivider() {
    if (!this.editorCtx) return;
    this.editorCtx.insertDivider();
    setTimeout(() => this.syncEditor(), 120);
  },

  undoRichText() {
    if (!this.editorCtx || typeof this.editorCtx.undo !== "function") return;
    this.editorCtx.undo({ success: () => this.syncEditor() });
  },

  clearRichText() {
    if (!this.editorCtx) return;
    wx.showModal({
      title: "清空文字",
      content: "确认清空开门文字吗？",
      success: (result) => {
        if (!result.confirm) return;
        this.editorCtx.clear({ success: () => this.setData(editorState("", "")) });
      }
    });
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  handlePickerChange(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  async buildPayload() {
    const openNote = await this.syncEditor();
    return {
      keeperName: String(this.data.form.keeperName || "").trim(),
      scheduledOpenAt: combineDateTime(this.data.form.openDate, this.data.form.openTime),
      scheduledCloseAt: combineDateTime(this.data.form.closeDate, this.data.form.closeTime),
      openNote: normalizeRichHtml(openNote),
      nightNote: ""
    };
  },

  validatePayload(payload = {}) {
    if (!payload.keeperName) return "请填写轮值看门人";
    if (!payload.scheduledOpenAt) return "请选择计划开门时间";
    if (payload.scheduledCloseAt && payload.scheduledCloseAt <= payload.scheduledOpenAt) return "计划关门时间需晚于开门时间";
    return "";
  },

  async submitRoomLog() {
    if (this.data.submitting) return;
    if (this.data.editingId && this.loadedRoomLog && !this.loadedRoomLog.canEditOpenNote) {
      wx.showToast({ title: "已关门后不能编辑开门文字", icon: "none" });
      return;
    }
    const payload = await this.buildPayload();
    const error = this.validatePayload(payload);
    if (error) {
      wx.showToast({ title: error, icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    wx.showLoading({ title: "保存中..." });
    try {
      const data = this.data.editingId
        ? await api.put(`/api/room-logs/${encodeURIComponent(this.data.editingId)}`, payload)
        : await api.post("/api/room-logs", payload);
      cache.invalidateRoomLogs();
      wx.hideLoading();
      wx.showToast({ title: data.roomLog?.hasAdminReviewNote ? "已提交审核" : "已保存", icon: "success" });
      const id = data.roomLog?.id || this.data.editingId;
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/room-log-detail/room-log-detail?id=${encodeURIComponent(id)}` });
      }, 520);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
