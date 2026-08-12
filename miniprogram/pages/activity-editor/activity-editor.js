const api = require("../../utils/api");
const cache = require("../../utils/cache");
const { stripHtml, responsiveRichTextHtml } = require("../../utils/format");
const share = require("../../utils/share");

const MAX_COVER_SIZE = 10 * 1024 * 1024;
const MAX_RICH_IMAGE_SIZE = 10 * 1024 * 1024;
const RICH_EDITOR_MIN_HEIGHT = 520;
const RICH_EDITOR_MAX_HEIGHT = 980;

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
  return `${date}T${time}:00+08:00`;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function chooseImageFile() {
  return new Promise((resolve, reject) => {
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        sizeType: ["compressed"],
        success: (res) => resolve((res.tempFiles || [])[0] || {}),
        fail: reject
      });
      return;
    }
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => resolve({ tempFilePath: res.tempFilePaths[0], size: 0 }),
      fail: reject
    });
  });
}

function getTempFileSize(file = {}) {
  if (!file.tempFilePath || !wx.getFileInfo) return Promise.resolve(Number(file.size || 0));
  return new Promise((resolve) => {
    wx.getFileInfo({
      filePath: file.tempFilePath,
      success: (res) => resolve(Number(res.size || file.size || 0)),
      fail: () => resolve(Number(file.size || 0))
    });
  });
}

function truthy(value) {
  return value === true || value === "true" || value === "1" || value === 1;
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

function imageCount(html = "") {
  return (String(html || "").match(/<img\b/gi) || []).length;
}

function estimateRichEditorHeight(html = "", text = "") {
  const plain = String(text || stripHtml(html || ""));
  const explicitLines = (plain.match(/\n/g) || []).length;
  const wrappedLines = Math.ceil(plain.length / 18);
  const blockLines = (String(html || "").match(/<\/p>|<h1\b|<li\b|<br\b|<hr\b/gi) || []).length;
  const imageLines = imageCount(html) * 8;
  const lines = Math.max(6, explicitLines + wrappedLines + blockLines + imageLines);
  return Math.max(RICH_EDITOR_MIN_HEIGHT, Math.min(RICH_EDITOR_MAX_HEIGHT, 300 + lines * 34));
}

function richEditorState(html = "", text = "") {
  const description = String(html || "");
  const descriptionText = String(text || stripHtml(description));
  return {
    "form.description": description,
    "form.descriptionText": descriptionText,
    descriptionPreview: responsiveRichTextHtml(normalizeRichHtml(description)),
    richEditorHeight: estimateRichEditorHeight(description, descriptionText)
  };
}

function saveManageToken(activity, manageToken) {
  if (!activity || !activity.id || !manageToken) return;
  try {
    const key = "yk_mp_activity_manage_tokens";
    const tokens = wx.getStorageSync(key) || {};
    tokens[activity.id] = {
      token: manageToken,
      title: activity.title || "",
      savedAt: new Date().toISOString()
    };
    wx.setStorageSync(key, tokens);
  } catch (error) {
    // 令牌只用于兜底找回管理权；写入失败不影响当前活动创建。
  }
}

function getManageToken(activityId) {
  try {
    const tokens = wx.getStorageSync("yk_mp_activity_manage_tokens") || {};
    return tokens[activityId] && tokens[activityId].token ? tokens[activityId].token : "";
  } catch (error) {
    return "";
  }
}

function extractInviteToken(invite = {}) {
  const text = String(invite.inviteUrl || invite.url || invite.invitePath || invite.path || "");
  const match = text.match(/[?&]token=([^&#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

Page({
  data: {
    loading: true,
    submitting: false,
    richImageUploading: false,
    error: "",
    editingId: "",
    editingActivity: null,
    editingActivityVersion: 1,
    editLockToken: "",
    editLockConflict: false,
    editLockMessage: "",
    modules: [],
    moduleNames: [],
    moduleIndex: -1,
    selectedModuleName: "暂无可选模块",
    series: [],
    seriesNames: ["不归入系列"],
    seriesIndex: 0,
    selectedSeriesName: "不归入系列",
    templates: [],
    templateNames: ["无，自己写"],
    templateIndex: 0,
    selectedTemplateName: "无，自己写",
    friends: [],
    friendNames: [],
    friendIndex: 0,
    selectedFriendName: "暂无已启用的客厅朋友",
    sourceTypeOptions: ["有空客厅", "客厅的朋友们"],
    sourceTypeValues: ["living_room", "friend"],
    sourceTypeIndex: 0,
    selectedSourceTypeName: "有空客厅",
    coverTempFilePath: "",
    coverChanged: false,
    today: "",
    editorTitle: "发起活动",
    editorBody: "保存草稿不会触发安全分析；正式提交后，系统会先做安全分析，再决定公开或进入社区复核。",
    formats: {},
    descriptionPreview: "",
    richEditorHeight: RICH_EDITOR_MIN_HEIGHT,
    coInvite: null,
    form: {
      title: "",
      moduleId: "",
      seriesId: "",
      sourceType: "living_room",
      friendId: "",
      initiator: "有空朋友",
      startsDate: "",
      startsTime: "",
      endsDate: "",
      endsTime: "",
      location: "有空客厅",
      capacity: "99",
      showInitiatorContact: false,
      initiatorContact: "",
      showRegistrationNames: false,
      showFeedbacks: true,
      minRegistrationEnabled: false,
      minRegistrationCount: "",
      deadlineDate: "",
      deadlineTime: "",
      description: "",
      descriptionText: ""
    }
  },

  onLoad(options = {}) {
    share.enableShareMenu();
    this.pendingEditorHtml = "";
    this.setData({ editingId: options.id || "" });
    this.bootstrap();
  },

  onUnload() {
    this.releaseEditLock();
  },

  onPullDownRefresh() {
    this.bootstrap().finally(() => wx.stopPullDownRefresh());
  },

  setDefaultTimes() {
    const now = new Date();
    const start = addHours(now, 24);
    const end = addHours(start, 2);
    this.setData({
      today: datePart(now),
      "form.startsDate": datePart(start),
      "form.startsTime": timePart(start),
      "form.endsDate": datePart(end),
      "form.endsTime": timePart(end),
      "form.deadlineDate": datePart(start),
      "form.deadlineTime": timePart(start)
    });
  },

  async bootstrap() {
    this.setDefaultTimes();
    this.setData({
      loading: true,
      error: "",
      editLockConflict: false,
      editorTitle: this.data.editingId ? "编辑活动" : "发起活动",
      editorBody: this.data.editingId
        ? "保存草稿不会触发安全分析；重新提交发布时，系统会重新分析。"
        : "保存草稿不会触发安全分析；正式提交后，系统会先做安全分析，再决定公开或进入社区复核。"
    });
    try {
      const [modulesData, meData, templatesData, friendsData, seriesData] = await Promise.all([
        api.get("/api/modules"),
        api.get("/api/me/summary").catch(() => ({})),
        api.get("/api/templates?page=1&pageSize=100").catch(() => ({ templates: [] })),
        api.get("/api/living-room-friends?enabled=true&page=1&pageSize=100").catch(() => ({ friends: [] })),
        api.get("/api/activity-series").catch(() => ({ series: [] }))
      ]);
      const modules = modulesData.modules || [];
      const firstModule = modules[0] || {};
      const profile = meData.profile || {};
      const templates = templatesData.templates || [];
      const friends = friendsData.friends || [];
      const series = seriesData.series || [];
      this.setData({
        modules,
        moduleNames: modules.map((item) => item.name || "未命名模块"),
        moduleIndex: modules.length ? 0 : -1,
        selectedModuleName: firstModule.name || "暂无可选模块",
        series,
        seriesNames: ["不归入系列"].concat(series.map((item) => item.name || "未命名系列")),
        seriesIndex: 0,
        selectedSeriesName: "不归入系列",
        templates,
        templateNames: ["无，自己写"].concat(templates.map((item) => item.name || "未命名模板")),
        templateIndex: 0,
        selectedTemplateName: "无，自己写",
        friends,
        friendNames: friends.length ? friends.map((item) => item.name || "未命名朋友") : ["暂无已启用的客厅朋友"],
        friendIndex: 0,
        selectedFriendName: friends[0]?.name || "暂无已启用的客厅朋友",
        "form.moduleId": firstModule.id || "",
        "form.seriesId": "",
        "form.initiator": profile.displayName || "有空朋友"
      });
      if (this.data.editingId) {
        await this.loadEditingActivity(this.data.editingId);
      }
      this.setData({ loading: false });
    } catch (error) {
      this.setData({
        error: error.message || "发起页初始化失败",
        loading: false
      });
    }
  },

  async loadEditingActivity(id) {
    const data = await api.get(`/api/activities/${encodeURIComponent(id)}`);
    const activity = data.activity || {};
    this.fillActivity(activity);
    await this.acquireEditLock(id).catch((error) => {
      if (error.status === 423) {
        this.setData({
          editLockConflict: true,
          editLockMessage: error.message || "另一位共同发起人正在编辑这个活动。"
        });
        return;
      }
      throw error;
    });
  },

  fillActivity(activity = {}) {
    const starts = parseDate(activity.startsAt) || addHours(new Date(), 24);
    const ends = parseDate(activity.endsAt) || addHours(starts, 2);
    const deadline = parseDate(activity.registrationDeadline) || starts;
    const moduleIndex = this.data.modules.findIndex((item) => item.id === activity.moduleId);
    const selectedModule = moduleIndex >= 0 ? this.data.modules[moduleIndex] : this.data.modules[0] || {};
    const seriesIndex = this.data.series.findIndex((item) => item.id === activity.seriesId);
    const selectedSeries = seriesIndex >= 0 ? this.data.series[seriesIndex] : null;
    const sourceType = activity.sourceType === "friend" ? "friend" : "living_room";
    const friendIndex = this.data.friends.findIndex((item) => item.id === activity.friendId);
    const selectedFriend = friendIndex >= 0 ? this.data.friends[friendIndex] : this.data.friends[0] || {};
    const html = activity.description || "";
    this.pendingEditorHtml = html;
    this.setData({
      editingActivity: activity,
      editingActivityVersion: Number(activity.activityVersion || activity.analysisVersion || 1),
      moduleIndex: moduleIndex >= 0 ? moduleIndex : (this.data.modules.length ? 0 : -1),
      selectedModuleName: selectedModule.name || "暂无可选模块",
      seriesIndex: seriesIndex >= 0 ? seriesIndex + 1 : 0,
      selectedSeriesName: selectedSeries?.name || "不归入系列",
      sourceTypeIndex: sourceType === "friend" ? 1 : 0,
      selectedSourceTypeName: sourceType === "friend" ? "客厅的朋友们" : "有空客厅",
      friendIndex: friendIndex >= 0 ? friendIndex : 0,
      selectedFriendName: selectedFriend.name || "暂无已启用的客厅朋友",
      coverTempFilePath: activity.coverUrl || "",
      coverChanged: false,
      "form.title": activity.title || "",
      "form.moduleId": selectedModule.id || activity.moduleId || "",
      "form.seriesId": selectedSeries?.id || activity.seriesId || "",
      "form.sourceType": sourceType,
      "form.friendId": sourceType === "friend" ? selectedFriend.id || activity.friendId || "" : "",
      "form.initiator": activity.initiator || activity.creatorName || "有空朋友",
      "form.startsDate": datePart(starts),
      "form.startsTime": timePart(starts),
      "form.endsDate": datePart(ends),
      "form.endsTime": timePart(ends),
      "form.location": activity.location || "有空客厅",
      "form.capacity": String(activity.capacity || 99),
      "form.showInitiatorContact": Boolean(activity.showInitiatorContact),
      "form.initiatorContact": activity.initiatorContact || "",
      "form.showRegistrationNames": Boolean(activity.showRegistrationNames),
      "form.showFeedbacks": activity.showFeedbacks !== false,
      "form.minRegistrationEnabled": Boolean(activity.minRegistrationEnabled),
      "form.minRegistrationCount": activity.minRegistrationEnabled ? String(activity.minRegistrationCount || "") : "",
      "form.deadlineDate": datePart(deadline),
      "form.deadlineTime": timePart(deadline),
      ...richEditorState(html, stripHtml(html))
    });
    this.setEditorContent(html);
  },

  acquireEditLock(id, options = {}) {
    return api.post(`/api/activities/${encodeURIComponent(id)}/edit-lock`, {
      takeover: options.takeover === true
    }).then((result) => {
      this.setData({
        editLockToken: result.editLockToken || "",
        editLockConflict: false,
        editLockMessage: "",
        editingActivityVersion: Number(result.activityVersion || this.data.editingActivityVersion || 1)
      });
      this.startEditLockRefresh(id);
      return result;
    });
  },

  startEditLockRefresh(id) {
    if (this.editLockRefreshTimer) clearInterval(this.editLockRefreshTimer);
    this.editLockRefreshTimer = setInterval(() => {
      if (!this.data.editLockToken || !id) return;
      api.request(`/api/activities/${encodeURIComponent(id)}/edit-lock/refresh`, {
        method: "POST",
        data: { editLockToken: this.data.editLockToken },
        header: { "X-YK-Edit-Lock-Token": this.data.editLockToken }
      }).catch(() => {});
    }, 2 * 60 * 1000);
  },

  releaseEditLock() {
    if (this.editLockRefreshTimer) {
      clearInterval(this.editLockRefreshTimer);
      this.editLockRefreshTimer = null;
    }
    const id = this.data.editingId;
    const token = this.data.editLockToken;
    if (!id || !token) return Promise.resolve();
    this.setData({ editLockToken: "" });
    return api.del(`/api/activities/${encodeURIComponent(id)}/edit-lock`, { editLockToken: token }).catch(() => {});
  },

  takeoverEditLock() {
    if (!this.data.editingId) return;
    wx.showModal({
      title: "接管编辑",
      content: "确认接管这个活动的编辑权吗？对方未保存的本地改动可能不会保留。",
      confirmText: "接管",
      cancelText: "再想想",
      success: async (result) => {
        if (!result.confirm) return;
        try {
          await this.acquireEditLock(this.data.editingId, { takeover: true });
          wx.showToast({ title: "已接管编辑", icon: "success" });
        } catch (error) {
          wx.showToast({ title: error.message || "接管失败", icon: "none" });
        }
      }
    });
  },

  onRichEditorReady() {
    wx.createSelectorQuery()
      .in(this)
      .select("#activityEditor")
      .context((res) => {
        this.editorCtx = res && res.context;
        this.setEditorContent(this.pendingEditorHtml || this.data.form.description || "");
      })
      .exec();
  },

  setEditorContent(html = "") {
    const safeHtml = normalizeRichHtml(html || "");
    this.pendingEditorHtml = safeHtml;
    if (!this.editorCtx) return;
    this.editorCtx.setContents({
      html: safeHtml,
      success: () => {
        this.pendingEditorHtml = "";
      }
    });
  },

  syncRichEditorContent() {
    if (!this.editorCtx) return Promise.resolve(this.data.form.description || "");
    return new Promise((resolve) => {
      this.editorCtx.getContents({
        success: (res) => {
          this.setData({
            ...richEditorState(res.html || "", res.text || stripHtml(res.html || ""))
          });
          resolve(res.html || "");
        },
        fail: () => resolve(this.data.form.description || "")
      });
    });
  },

  handleRichTextInput(event) {
    this.setData({
      ...richEditorState(event.detail.html || "", event.detail.text || "")
    });
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
      value = value !== undefined
        ? value
        : this.data.formats.header === 1 || this.data.formats.header === "1" ? "" : "1";
    }
    this.editorCtx.format(name, value);
    setTimeout(() => this.syncRichEditorContent(), 120);
  },

  insertDivider() {
    if (!this.editorCtx) return;
    this.editorCtx.insertDivider();
  },

  undoRichText() {
    if (!this.editorCtx || typeof this.editorCtx.undo !== "function") return;
    this.editorCtx.undo({
      success: () => this.syncRichEditorContent()
    });
  },

  clearRichText() {
    if (!this.editorCtx) return;
    wx.showModal({
      title: "清空介绍",
      content: "确认清空活动介绍吗？",
      success: (result) => {
        if (!result.confirm) return;
        this.editorCtx.clear({
          success: () => this.setData(richEditorState("", ""))
        });
      }
    });
  },

  async insertRichImage() {
    if (!this.editorCtx || this.data.richImageUploading) return;
    try {
      const file = await chooseImageFile();
      if (!file.tempFilePath) return;
      const finalSize = await getTempFileSize(file);
      if (finalSize > MAX_RICH_IMAGE_SIZE) {
        wx.showToast({ title: "压缩后需小于 10MB", icon: "none" });
        return;
      }
      this.setData({ richImageUploading: true });
      wx.showLoading({ title: "上传图片..." });
      const result = await api.upload("/api/uploads/rich-image", file.tempFilePath, {}, { name: "image" });
      this.editorCtx.insertImage({
        src: result.url,
        alt: "活动图片",
        width: "100%",
        success: () => this.syncRichEditorContent()
      });
      wx.hideLoading();
      wx.showToast({ title: "已插入图片", icon: "success" });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "图片上传失败", icon: "none" });
    } finally {
      this.setData({ richImageUploading: false });
    }
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  handleSwitch(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    const value = Boolean(event.detail.value);
    this.setData({
      [`form.${field}`]: value,
      ...(field === "minRegistrationEnabled" && !value ? { "form.minRegistrationCount": "" } : {})
    });
  },

  handleModuleChange(event) {
    const index = Number(event.detail.value);
    const module = this.data.modules[index] || {};
    this.setData({
      moduleIndex: index,
      selectedModuleName: module.name || "暂无可选模块",
      "form.moduleId": module.id || ""
    });
  },

  handleSeriesChange(event) {
    const index = Number(event.detail.value || 0);
    const series = index > 0 ? this.data.series[index - 1] || null : null;
    this.setData({
      seriesIndex: index,
      selectedSeriesName: series ? series.name || "未命名系列" : "不归入系列",
      "form.seriesId": series ? series.id || "" : ""
    });
  },

  handleSourceTypeChange(event) {
    const index = Number(event.detail.value);
    const sourceType = this.data.sourceTypeValues[index] || "living_room";
    const firstFriend = this.data.friends[0] || {};
    this.setData({
      sourceTypeIndex: index,
      selectedSourceTypeName: this.data.sourceTypeOptions[index] || "有空客厅",
      "form.sourceType": sourceType,
      "form.friendId": sourceType === "friend" ? firstFriend.id || "" : "",
      friendIndex: sourceType === "friend" ? 0 : this.data.friendIndex,
      selectedFriendName: sourceType === "friend" ? firstFriend.name || "暂无已启用的客厅朋友" : this.data.selectedFriendName
    });
  },

  handleFriendChange(event) {
    const index = Number(event.detail.value);
    const friend = this.data.friends[index] || {};
    this.setData({
      friendIndex: this.data.friends.length ? index : 0,
      selectedFriendName: friend.name || "暂无已启用的客厅朋友",
      "form.friendId": friend.id || ""
    });
  },

  handleTemplateChange(event) {
    const nextIndex = Number(event.detail.value || 0);
    const template = nextIndex > 0 ? this.data.templates[nextIndex - 1] || null : null;
    const previousIndex = this.data.templateIndex;
    const applyTemplate = () => {
      const content = template ? template.content || "" : "";
      this.setData({
        templateIndex: nextIndex,
        selectedTemplateName: template ? template.name || "未命名模板" : "无，自己写",
        ...richEditorState(content, stripHtml(content))
      });
      if (template) this.setEditorContent(content);
    };
    if (!template) {
      this.setData({
        templateIndex: 0,
        selectedTemplateName: "无，自己写"
      });
      return;
    }
    const hasDescription = Boolean(stripHtml(this.data.form.description || "").trim());
    if (!hasDescription) {
      applyTemplate();
      return;
    }
    wx.showModal({
      title: "覆盖当前描述",
      content: "是否用这个模板覆盖当前活动介绍？",
      confirmText: "覆盖",
      cancelText: "取消",
      success: (result) => {
        if (result.confirm) {
          applyTemplate();
          return;
        }
        this.setData({ templateIndex: previousIndex });
      }
    });
  },

  handlePickerChange(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  chooseCover() {
    chooseImageFile().then((file) => {
      const size = Number(file.size || 0);
      if (size > MAX_COVER_SIZE) {
        wx.showToast({ title: "封面需小于 10MB", icon: "none" });
        return;
      }
      this.setData({ coverTempFilePath: file.tempFilePath || "", coverChanged: true });
    }).catch(() => {});
  },

  removeCover() {
    if (this.data.editingId && this.data.editingActivity?.coverUrl) {
      this.setData({ coverTempFilePath: this.data.editingActivity.coverUrl, coverChanged: false });
      wx.showToast({ title: "已恢复原封面", icon: "none" });
      return;
    }
    this.setData({ coverTempFilePath: "", coverChanged: true });
  },

  validatePayload(payload, intent) {
    const minEnabled = truthy(payload.minRegistrationEnabled);
    if (!payload.title) return "请填写活动标题";
    if (!payload.moduleId) return "请选择活动模块";
    if (intent !== "draft") {
      if (!payload.initiator) return "请填写发起人";
      if (!payload.startsAt) return "请选择开始时间";
      if (!payload.location) return "请填写地点";
      if (!stripHtml(payload.description || "").trim()) return "请填写活动介绍";
    }
    if (payload.sourceType === "friend" && !payload.friendId) return "请选择客厅的朋友主体";
    const capacity = Number(payload.capacity || 99);
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 99) return "人数限额需为 1-99";
    if (minEnabled) {
      const min = Number(payload.minRegistrationCount || 0);
      if (!Number.isFinite(min) || min < 1) return "请填写最低报名人数";
      if (capacity <= min) return "人数限额需要大于最低报名人数";
    }
    if (payload.endsAt && payload.startsAt && new Date(payload.endsAt).getTime() < new Date(payload.startsAt).getTime()) {
      return "结束时间不能早于开始时间";
    }
    return "";
  },

  buildPayload(intent, description) {
    const form = this.data.form;
    const minEnabled = Boolean(form.minRegistrationEnabled);
    const startsAt = combineDateTime(form.startsDate, form.startsTime);
    const endsAt = combineDateTime(form.endsDate, form.endsTime);
    const registrationDeadline = minEnabled
      ? combineDateTime(form.deadlineDate || form.startsDate, form.deadlineTime || form.startsTime)
      : startsAt;
    const payload = {
      intent,
      title: String(form.title || "").trim(),
      moduleId: form.moduleId,
      seriesId: form.seriesId || "",
      initiator: String(form.initiator || "").trim(),
      startsAt,
      endsAt,
      location: String(form.location || "").trim(),
      capacity: String(form.capacity || "99").trim(),
      showInitiatorContact: form.showInitiatorContact ? "true" : "false",
      initiatorContact: String(form.initiatorContact || "").trim(),
      showRegistrationNames: form.showRegistrationNames ? "true" : "false",
      showFeedbacks: form.showFeedbacks ? "true" : "false",
      minRegistrationEnabled: minEnabled ? "true" : "false",
      minRegistrationCount: minEnabled ? String(form.minRegistrationCount || "").trim() : "0",
      registrationDeadline,
      sourceType: form.sourceType || "living_room",
      friendId: form.sourceType === "friend" ? form.friendId || "" : "",
      description: normalizeRichHtml(description || form.description || "")
    };
    if (this.data.editingId) {
      payload.editLockToken = this.data.editLockToken || "";
      payload.activityVersion = String(this.data.editingActivityVersion || 1);
      payload.manageToken = getManageToken(this.data.editingId);
    }
    return payload;
  },

  submitDraft() {
    this.submitActivity("draft");
  },

  submitPublish() {
    this.submitActivity("submit");
  },

  async submitActivity(intent, options = {}) {
    if (this.data.submitting && !options.force) return null;
    if (this.data.editLockConflict) {
      wx.showToast({ title: "请先接管编辑权", icon: "none" });
      return null;
    }
    const description = await this.syncRichEditorContent();
    const payload = this.buildPayload(intent, description);
    const error = this.validatePayload(payload, intent);
    if (error) {
      wx.showToast({ title: error, icon: "none" });
      return null;
    }
    this.setData({ submitting: true });
    if (!options.silent) wx.showLoading({ title: intent === "draft" ? "保存草稿..." : "提交活动..." });
    try {
      const editingId = this.data.editingId;
      const endpoint = editingId ? `/api/activities/${encodeURIComponent(editingId)}` : "/api/activities";
      const header = {
        ...(this.data.editLockToken ? { "X-YK-Edit-Lock-Token": this.data.editLockToken } : {}),
        ...(editingId && getManageToken(editingId) ? { "X-YK-Manage-Token": getManageToken(editingId) } : {})
      };
      const shouldUploadCover = Boolean(this.data.coverTempFilePath && (this.data.coverChanged || !editingId));
      const data = shouldUploadCover
        ? await api.upload(endpoint, this.data.coverTempFilePath, payload, { header })
        : editingId
          ? await api.request(endpoint, { method: "PUT", data: payload, header })
          : await api.post(endpoint, payload);
      cache.invalidatePublicActivities(data.activity && data.activity.id);
      cache.removeByPrefix(cache.keys.userPrefix(cache.currentIdentityPart()));
      saveManageToken(data.activity, data.manageToken);
      if (data.activity && data.activity.id) {
        this.setData({
          editingId: data.activity.id,
          editingActivity: data.activity,
          editingActivityVersion: Number(data.activity.activityVersion || data.activity.analysisVersion || 1),
          coverChanged: false
        });
      }
      if (options.stay && data.activity?.id) {
        await this.acquireEditLock(data.activity.id).catch(() => {});
      }
      if (!options.silent) {
        wx.hideLoading();
        wx.showToast({
          title: intent === "draft" ? "草稿已保存" : "已提交分析",
          icon: "success"
        });
      }
      if (!options.stay) {
        setTimeout(() => {
          wx.redirectTo({ url: "/pages/my-activities/my-activities" });
        }, 520);
      }
      return data;
    } catch (error) {
      if (!options.silent) wx.hideLoading();
      wx.showToast({ title: error.message || "提交失败", icon: "none" });
      return null;
    } finally {
      this.setData({ submitting: false });
    }
  },

  async createCoInvite() {
    if (this.data.submitting) return;
    if (this.data.editLockConflict) {
      wx.showToast({ title: "请先接管编辑权", icon: "none" });
      return;
    }
    let activityId = this.data.editingId;
    if (!activityId || this.data.editingActivity?.status === "draft") {
      const saved = await this.submitActivity("draft", { stay: true, silent: false, force: true });
      activityId = saved?.activity?.id || activityId;
    }
    if (!activityId) return;
    wx.showLoading({ title: "生成邀请..." });
    try {
      const result = await api.post(`/api/activities/${encodeURIComponent(activityId)}/co-initiator-invites`, {});
      const invite = result.invite || {};
      const token = extractInviteToken(invite);
      const miniPath = token ? `/pages/co-invite/co-invite?token=${encodeURIComponent(token)}` : "";
      const nextInvite = { ...invite, token, miniPath };
      this.setData({ coInvite: nextInvite });
      wx.hideLoading();
      wx.setClipboardData({ data: invite.inviteUrl || token || miniPath });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "邀请生成失败", icon: "none" });
    }
  },

  copyCoInvite() {
    const invite = this.data.coInvite || {};
    const value = invite.inviteUrl || invite.token || invite.miniPath || "";
    if (!value) return;
    wx.setClipboardData({ data: value });
  },

  onShareAppMessage() {
    const invite = this.data.coInvite || {};
    if (invite.token) {
      return {
        title: `邀请你共同发起：${this.data.form.title || "有空客厅活动"}`,
        path: `/pages/co-invite/co-invite?token=${encodeURIComponent(invite.token)}`
      };
    }
    return {
      title: this.data.form.title || "有空客厅活动",
      path: this.data.editingId
        ? `/pages/activity-detail/activity-detail?id=${encodeURIComponent(this.data.editingId)}`
        : "/pages/activity-editor/activity-editor"
    };
  },

  onShareTimeline() {
    return share.defaultTimeline();
  }
});
