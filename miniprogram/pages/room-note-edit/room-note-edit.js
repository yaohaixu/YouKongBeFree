const api = require("../../utils/api");
const cache = require("../../utils/cache");
const { stripHtml, responsiveRichTextHtml, toRoomLogView } = require("../../utils/format");

const EDITOR_MIN_HEIGHT = 520;
const EDITOR_MAX_HEIGHT = 1000;

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

function estimateHeight(html = "", text = "") {
  const plain = String(text || stripHtml(html || ""));
  const explicitLines = (plain.match(/\n/g) || []).length;
  const wrappedLines = Math.ceil(plain.length / 18);
  const blockLines = (String(html || "").match(/<\/p>|<h1\b|<li\b|<br\b|<hr\b/gi) || []).length;
  const lines = Math.max(6, explicitLines + wrappedLines + blockLines);
  return Math.max(EDITOR_MIN_HEIGHT, Math.min(EDITOR_MAX_HEIGHT, 300 + lines * 34));
}

function editorState(html = "", text = "") {
  const safeHtml = normalizeRichHtml(html || "");
  return {
    content: safeHtml,
    preview: responsiveRichTextHtml(safeHtml),
    editorHeight: estimateHeight(safeHtml, text || stripHtml(safeHtml))
  };
}

Page({
  data: {
    loading: true,
    submitting: false,
    roomLogId: "",
    noteId: "",
    roomLog: null,
    content: "",
    preview: "",
    editorHeight: EDITOR_MIN_HEIGHT,
    formats: {}
  },

  onLoad(options = {}) {
    this.pendingEditorHtml = "";
    this.setData({ roomLogId: options.id || "", noteId: options.noteId || "" });
    this.loadRoomLog();
  },

  async loadRoomLog() {
    if (!this.data.roomLogId) {
      this.setData({ loading: false });
      wx.showToast({ title: "缺少值班记录", icon: "none" });
      return;
    }
    try {
      const data = await api.get(`/api/room-logs/${encodeURIComponent(this.data.roomLogId)}`);
      const roomLog = toRoomLogView(data.roomLog || {});
      const myNote = roomLog.myNightNote || null;
      const html = myNote && (!this.data.noteId || myNote.id === this.data.noteId) ? myNote.content || "" : "";
      this.pendingEditorHtml = html;
      this.setData({
        roomLog,
        noteId: myNote?.id || this.data.noteId || "",
        ...editorState(html, stripHtml(html)),
        loading: false
      });
      this.setEditorContent(html);
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || "读取失败", icon: "none" });
    }
  },

  onEditorReady() {
    wx.createSelectorQuery()
      .in(this)
      .select("#noteEditor")
      .context((res) => {
        this.editorCtx = res && res.context;
        this.setEditorContent(this.pendingEditorHtml || this.data.content || "");
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
    if (!this.editorCtx) return Promise.resolve(this.data.content || "");
    return new Promise((resolve) => {
      this.editorCtx.getContents({
        success: (res) => {
          this.setData(editorState(res.html || "", res.text || stripHtml(res.html || "")));
          resolve(res.html || "");
        },
        fail: () => resolve(this.data.content || "")
      });
    });
  },

  handleInput(event) {
    this.setData(editorState(event.detail.html || "", event.detail.text || ""));
  },

  handleStatusChange(event) {
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
      title: "清空夜记",
      content: "确认清空这条夜记吗？",
      success: (result) => {
        if (!result.confirm) return;
        this.editorCtx.clear({ success: () => this.setData(editorState("", "")) });
      }
    });
  },

  async submitNote() {
    if (this.data.submitting) return;
    const html = normalizeRichHtml(await this.syncEditor());
    if (!stripHtml(html).trim()) {
      wx.showToast({ title: "请先写一点夜记内容", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    wx.showLoading({ title: "提交中..." });
    try {
      const path = this.data.noteId
        ? `/api/room-logs/${encodeURIComponent(this.data.roomLogId)}/night-notes/${encodeURIComponent(this.data.noteId)}`
        : `/api/room-logs/${encodeURIComponent(this.data.roomLogId)}/night-notes`;
      const data = await api.post(path, { content: html });
      cache.invalidateRoomLogs();
      wx.hideLoading();
      wx.showToast({ title: data.roomNote?.status === "admin_review" ? "已提交审核" : "已发布", icon: "success" });
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/room-log-detail/room-log-detail?id=${encodeURIComponent(this.data.roomLogId)}` });
      }, 520);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "提交失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
