const api = require("../../utils/api");
const cache = require("../../utils/cache");
const { roomStatusView, toRoomLogView } = require("../../utils/format");
const share = require("../../utils/share");
const shareImage = require("../../utils/share-image");

const ROOM_LOG_TTL = 2 * 60 * 1000;
const STATUS_TTL = 60 * 1000;

function roomLogsCacheKey(page, pageSize) {
  return cache.keys.publicRoomLogs(page, pageSize);
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    refreshing: false,
    error: "",
    focusId: "",
    page: 1,
    pageSize: 10,
    hasMore: true,
    roomStatus: roomStatusView({}),
    roomLogs: [],
    shareImageLoading: false,
    shareCanvasWidth: 900,
    shareCanvasHeight: 1260,
  },

  onLoad(options = {}) {
    share.enableShareMenu();
    this.setData({ focusId: options.id || "" });
    this.loadStatus({ preferCache: true });
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

  renderStatus(data = {}) {
    this.setData({
      roomStatus: roomStatusView(data.roomStatus || data),
      refreshing: false,
    });
  },

  async loadStatus(options = {}) {
    const key = cache.keys.publicRoomStatus();
    const cached = cache.getWithMeta(key);
    const force = Boolean(options.force);
    if (options.preferCache !== false && cached.exists && !force) {
      this.renderStatus(cached.data);
      if (!cached.expired) return cached.data;
    }
    try {
      const data = await api.get("/api/room-logs/status");
      cache.set(key, data, STATUS_TTL);
      this.renderStatus(data);
      return data;
    } catch (error) {
      const fallback = cache.get(key, { allowExpired: true });
      if (fallback) {
        this.renderStatus(fallback);
        return fallback;
      }
      return null;
    }
  },

  renderRoomLogs(data = {}, options = {}) {
    const nextRows = (data.roomLogs || []).map((item) => ({
      ...toRoomLogView(item),
      highlighted: Boolean(this.data.focusId && item.id === this.data.focusId),
    }));
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
      const data = await api.get(`/api/room-logs?page=${options.page}&pageSize=${this.data.pageSize}`);
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
        error: error.message || "值班记录读取失败",
        loading: false,
        loadingMore: false,
        refreshing: false,
      });
      return null;
    }
  },

  goManage() {
    wx.navigateTo({ url: "/pages/room-log-manage/room-log-manage" });
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

  copyLink() {
    wx.setClipboardData({
      data: shareImage.roomLogsUrl(this.data.roomStatus.currentLog?.id || ""),
      success: () => wx.showToast({ title: "链接已复制", icon: "success" }),
    });
  },

  onShareAppMessage() {
    return share.roomLogShare(this.data.roomStatus);
  },

  onShareTimeline() {
    return share.defaultTimeline();
  },
});
