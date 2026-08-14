const api = require("../../utils/api");
const cache = require("../../utils/cache");
const { stripHtml, responsiveRichTextHtml, roomStatusView, toRoomLogView } = require("../../utils/format");
const share = require("../../utils/share");
const shareImage = require("../../utils/share-image");

const ROOM_LOG_TTL = 2 * 60 * 1000;
const EDITOR_MIN_HEIGHT = 300;
const EDITOR_MAX_HEIGHT = 760;

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
  return Math.max(EDITOR_MIN_HEIGHT, Math.min(EDITOR_MAX_HEIGHT, 200 + lines * 34));
}

function editorState(field, html = "", text = "") {
  const safeHtml = normalizeRichHtml(html || "");
  return {
    [`form.${field}`]: safeHtml,
    [`${field}Preview`]: responsiveRichTextHtml(safeHtml),
    [`${field}EditorHeight`]: estimateEditorHeight(safeHtml, text || stripHtml(safeHtml)),
  };
}

function roomLogsCacheKey(page, pageSize) {
  return cache.keys.roomLogs(cache.currentIdentityPart(), page, pageSize);
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    refreshing: false,
    submitting: false,
    error: "",
    message: "",
    today: "",
    page: 1,
    pageSize: 10,
    hasMore: true,
    editingId: "",
    roomStatus: roomStatusView({}),
    roomLogs: [],
    openFormats: {},
    nightFormats: {},
    openNotePreview: "",
    nightNotePreview: "",
    openNoteEditorHeight: EDITOR_MIN_HEIGHT,
    nightNoteEditorHeight: EDITOR_MIN_HEIGHT,
    shareImageLoading: false,
    shareCanvasWidth: 900,
    shareCanvasHeight: 1260,
    form: {
      keeperName: "有空朋友",
      openDate: "",
      openTime: "",
      closeDate: "",
      closeTime: "",
      openNote: "",
      nightNote: "",
    },
  },

  onLoad() {
    share.enableShareMenu();
    this.openPendingHtml = "";
    this.nightPendingHtml = "";
    this.resetForm();
    this.loadStatus();
    this.loadRoomLogs({ reset: true, preferCache: true });
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadStatus({ force: true }),
      this.loadRoomLogs({ reset: true, force: true }),
    ]).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.loadRoomLogs({ reset: false });
  },

  resetForm() {
    const now = new Date();
    const open = addHours(now, 2);
    const close = addHours(open, 4);
    this.openPendingHtml = "";
    this.nightPendingHtml = "";
    this.setData({
      today: datePart(now),
      editingId: "",
      message: "",
      "form.keeperName": this.data.form.keeperName || "有空朋友",
      "form.openDate": datePart(open),
      "form.openTime": timePart(open),
      "form.closeDate": datePart(close),
      "form.closeTime": timePart(close),
      ...editorState("openNote", "", ""),
      ...editorState("nightNote", "", ""),
    });
    this.setEditorContent("openNote", "");
    this.setEditorContent("nightNote", "");
  },

  renderStatus(data = {}) {
    this.setData({ roomStatus: roomStatusView(data.roomStatus || data) });
  },

  async loadStatus() {
    try {
      const data = await api.get("/api/room-logs/status");
      cache.set(cache.keys.publicRoomStatus(), data, 60 * 1000);
      this.renderStatus(data);
      return data;
    } catch {
      const fallback = cache.get(cache.keys.publicRoomStatus(), { allowExpired: true });
      if (fallback) this.renderStatus(fallback);
      return null;
    }
  },

  renderRoomLogs(data = {}, options = {}) {
    const nextRows = (data.roomLogs || []).map(toRoomLogView);
    const pageInfo = data.pageInfo || {};
    this.setData({
      page: options.page,
      roomLogs: options.reset ? nextRows : this.data.roomLogs.concat(nextRows),
      hasMore: Boolean(pageInfo.hasMore),
      loading: false,
      loadingMore: false,
      refreshing: false,
      error: "",
    });
  },

  async loadRoomLogs(options = {}) {
    const reset = options.reset !== false;
    const page = reset ? 1 : this.data.page + 1;
    const key = roomLogsCacheKey(page, this.data.pageSize);
    const cached = cache.getWithMeta(key);
    const force = Boolean(options.force);
    if (reset && options.preferCache !== false && cached.exists && !force) {
      this.renderRoomLogs(cached.data, { reset, page });
      if (!cached.expired) return cached.data;
      this.setData({ refreshing: true });
      return this.refreshRoomLogs({ reset, page, key });
    }
    this.setData(reset ? { loading: true, error: "" } : { loadingMore: true, error: "" });
    return this.refreshRoomLogs({ reset, page, key });
  },

  async refreshRoomLogs(options = {}) {
    try {
      const data = await api.get(`/api/my/room-logs?page=${options.page}&pageSize=${this.data.pageSize}`);
      cache.set(options.key, data, ROOM_LOG_TTL);
      this.renderRoomLogs(data, options);
      return data;
    } catch (error) {
      const fallback = cache.get(options.key, { allowExpired: true });
      if (fallback) {
        this.renderRoomLogs(fallback, options);
        return fallback;
      }
      this.setData({
        error: error.message || "我的值班记录读取失败",
        loading: false,
        loadingMore: false,
        refreshing: false,
      });
      return null;
    }
  },

  onEditorReady(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    wx.createSelectorQuery()
      .in(this)
      .select(`#${field}Editor`)
      .context((res) => {
        if (field === "openNote") this.openEditorCtx = res && res.context;
        if (field === "nightNote") this.nightEditorCtx = res && res.context;
        this.setEditorContent(field, field === "openNote" ? this.openPendingHtml : this.nightPendingHtml);
      })
      .exec();
  },

  editorContext(field) {
    return field === "nightNote" ? this.nightEditorCtx : this.openEditorCtx;
  },

  setEditorContent(field, html = "") {
    const ctx = this.editorContext(field);
    const safeHtml = normalizeRichHtml(html || "");
    if (field === "openNote") this.openPendingHtml = safeHtml;
    if (field === "nightNote") this.nightPendingHtml = safeHtml;
    if (!ctx) return;
    ctx.setContents({
      html: safeHtml,
      success: () => {
        if (field === "openNote") this.openPendingHtml = "";
        if (field === "nightNote") this.nightPendingHtml = "";
      },
    });
  },

  syncEditor(field) {
    const ctx = this.editorContext(field);
    if (!ctx) return Promise.resolve(this.data.form[field] || "");
    return new Promise((resolve) => {
      ctx.getContents({
        success: (res) => {
          this.setData(editorState(field, res.html || "", res.text || stripHtml(res.html || "")));
          resolve(res.html || "");
        },
        fail: () => resolve(this.data.form[field] || ""),
      });
    });
  },

  handleRichTextInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    this.setData(editorState(field, event.detail.html || "", event.detail.text || ""));
  },

  handleRichTextStatusChange(event) {
    const field = event.currentTarget.dataset.field;
    if (field === "openNote") this.setData({ openFormats: event.detail || {} });
    if (field === "nightNote") this.setData({ nightFormats: event.detail || {} });
  },

  formatRichText(event) {
    const field = event.currentTarget.dataset.field;
    const name = event.currentTarget.dataset.name;
    let value = event.currentTarget.dataset.value;
    const ctx = this.editorContext(field);
    if (!field || !name || !ctx) return;
    if (name === "header") {
      const formats = field === "openNote" ? this.data.openFormats : this.data.nightFormats;
      value = value !== undefined ? value : formats.header === 1 || formats.header === "1" ? "" : "1";
    }
    ctx.format(name, value);
    setTimeout(() => this.syncEditor(field), 120);
  },

  insertDivider(event) {
    const field = event.currentTarget.dataset.field;
    const ctx = this.editorContext(field);
    if (!ctx) return;
    ctx.insertDivider();
    setTimeout(() => this.syncEditor(field), 120);
  },

  undoRichText(event) {
    const field = event.currentTarget.dataset.field;
    const ctx = this.editorContext(field);
    if (!ctx || typeof ctx.undo !== "function") return;
    ctx.undo({ success: () => this.syncEditor(field) });
  },

  clearRichText(event) {
    const field = event.currentTarget.dataset.field;
    const ctx = this.editorContext(field);
    if (!ctx) return;
    wx.showModal({
      title: "清空文字",
      content: field === "nightNote" ? "确认清空夜记吗？" : "确认清空开门文字吗？",
      success: (result) => {
        if (!result.confirm) return;
        ctx.clear({ success: () => this.setData(editorState(field, "", "")) });
      },
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
    const [openNote, nightNote] = await Promise.all([
      this.syncEditor("openNote"),
      this.syncEditor("nightNote"),
    ]);
    return {
      keeperName: String(this.data.form.keeperName || "").trim(),
      scheduledOpenAt: combineDateTime(this.data.form.openDate, this.data.form.openTime),
      scheduledCloseAt: combineDateTime(this.data.form.closeDate, this.data.form.closeTime),
      openNote: normalizeRichHtml(openNote),
      nightNote: normalizeRichHtml(nightNote),
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
    const payload = await this.buildPayload();
    const error = this.validatePayload(payload);
    if (error) {
      wx.showToast({ title: error, icon: "none" });
      return;
    }
    this.setData({ submitting: true, message: "" });
    wx.showLoading({ title: "保存中..." });
    try {
      const data = this.data.editingId
        ? await api.put(`/api/room-logs/${encodeURIComponent(this.data.editingId)}`, payload)
        : await api.post("/api/room-logs", payload);
      cache.invalidateRoomLogs();
      this.renderStatus(data);
      wx.hideLoading();
      wx.showToast({ title: data.roomLog?.hasAdminReviewNote ? "已提交审核" : "已保存", icon: "success" });
      this.setData({
        submitting: false,
        message: data.roomLog?.hasAdminReviewNote ? "记录已保存，部分文字需管理员确认后才会公开展示。" : "记录已保存并更新首页开门状态。",
      });
      await this.loadRoomLogs({ reset: true, force: true });
      this.fillForm(data.roomLog || {});
    } catch (error) {
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    }
  },

  fillForm(log = {}) {
    const open = splitLocalDateTime(log.scheduledOpenAt, addHours(new Date(), 2));
    const close = splitLocalDateTime(log.scheduledCloseAt, addHours(new Date(), 6));
    this.openPendingHtml = log.openNote || "";
    this.nightPendingHtml = log.nightNote || "";
    this.setData({
      editingId: log.id || "",
      "form.keeperName": log.keeperName || "有空朋友",
      "form.openDate": open.date,
      "form.openTime": open.time,
      "form.closeDate": close.date,
      "form.closeTime": close.time,
      ...editorState("openNote", log.openNote || "", stripHtml(log.openNote || "")),
      ...editorState("nightNote", log.nightNote || "", stripHtml(log.nightNote || "")),
    });
    this.setEditorContent("openNote", log.openNote || "");
    this.setEditorContent("nightNote", log.nightNote || "");
  },

  editLog(event) {
    const id = event.currentTarget.dataset.id;
    const log = this.data.roomLogs.find((item) => item.id === id);
    if (!log) return;
    if (!log.canEditOpenNote) {
      wx.showToast({ title: "已关门后不能编辑开门文字", icon: "none" });
      return;
    }
    this.fillForm(log);
    wx.pageScrollTo({ scrollTop: 0, duration: 220 });
  },

  async confirmOpen(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.showLoading({ title: "确认中..." });
    try {
      const data = await api.post(`/api/room-logs/${encodeURIComponent(id)}/open`, {});
      cache.invalidateRoomLogs();
      this.renderStatus(data);
      wx.hideLoading();
      wx.showToast({ title: "客厅已开门", icon: "success" });
      await this.loadRoomLogs({ reset: true, force: true });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "确认失败", icon: "none" });
    }
  },

  async confirmClose(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const payload = id === this.data.editingId ? await this.buildPayload() : {};
    wx.showModal({
      title: "确认关门",
      content: "确认将这条值班记录标记为已关门吗？如果表单里正在编辑同一条记录，也会一起保存夜记。",
      confirmText: "确认关门",
      cancelText: "再想想",
      success: async (result) => {
        if (!result.confirm) return;
        wx.showLoading({ title: "确认中..." });
        try {
          const data = await api.post(`/api/room-logs/${encodeURIComponent(id)}/close`, payload);
          cache.invalidateRoomLogs();
          this.renderStatus(data);
          wx.hideLoading();
          wx.showToast({ title: "客厅已关门", icon: "success" });
          await this.loadRoomLogs({ reset: true, force: true });
          if (id === this.data.editingId) this.fillForm(data.roomLog || {});
        } catch (error) {
          wx.hideLoading();
          wx.showToast({ title: error.message || "确认失败", icon: "none" });
        }
      },
    });
  },

  goPublicLogs() {
    wx.navigateTo({ url: "/pages/room-logs/room-logs" });
  },

  async runShareImageTask(task) {
    if (this.data.shareImageLoading) return;
    this.setData({ shareImageLoading: true });
    wx.showLoading({ title: "生成海报..." });
    try {
      const filePath = await task();
      wx.hideLoading();
      await shareImage.saveOrPreview(filePath);
      wx.showToast({ title: "已保存到相册", icon: "success" });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "图片生成失败", icon: "none" });
    } finally {
      this.setData({ shareImageLoading: false });
    }
  },

  downloadPoster() {
    this.runShareImageTask(() => shareImage.generateRoomLogPoster(this, this.data.roomStatus));
  },

  onShareAppMessage() {
    return share.roomLogShare(this.data.roomStatus);
  },
});
