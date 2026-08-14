const api = require("../../utils/api");
const cache = require("../../utils/cache");
const { roomStatusView, toRoomLogView } = require("../../utils/format");

const ROOM_LOG_TTL = 2 * 60 * 1000;

function roomLogsCacheKey(page, pageSize) {
  return cache.keys.roomLogs(cache.currentIdentityPart(), page, pageSize);
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    refreshing: false,
    error: "",
    page: 1,
    pageSize: 10,
    hasMore: true,
    roomStatus: roomStatusView({}),
    roomLogs: []
  },

  onLoad() {
    this.loadStatus();
    this.loadRoomLogs({ reset: true, preferCache: true });
  },

  onShow() {
    if (this.loadedOnce) {
      this.loadStatus();
      this.loadRoomLogs({ reset: true, force: true, silent: true });
    }
    this.loadedOnce = true;
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadStatus({ force: true }),
      this.loadRoomLogs({ reset: true, force: true })
    ]).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.loadRoomLogs({ reset: false });
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
      error: ""
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
    if (!options.silent) this.setData(reset ? { loading: true, error: "" } : { loadingMore: true, error: "" });
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
        refreshing: false
      });
      return null;
    }
  },

  goCreate() {
    wx.navigateTo({ url: "/pages/room-log-edit/room-log-edit" });
  },

  goPublicLogs() {
    wx.navigateTo({ url: "/pages/room-logs/room-logs" });
  },

  openLog(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/room-log-detail/room-log-detail?id=${encodeURIComponent(id)}` });
  },

  deleteExpired(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: "删除过期预约",
      content: "这条预约从未确认开门，删除后会从你的值班记录里移除。",
      confirmText: "删除",
      confirmColor: "#9f392b",
      cancelText: "再想想",
      success: async (result) => {
        if (!result.confirm) return;
        wx.showLoading({ title: "删除中..." });
        try {
          await api.del(`/api/room-logs/${encodeURIComponent(id)}`, {});
          cache.invalidateRoomLogs();
          wx.hideLoading();
          wx.showToast({ title: "已删除", icon: "success" });
          this.setData({ roomLogs: this.data.roomLogs.filter((item) => item.id !== id) });
          this.loadStatus();
        } catch (error) {
          wx.hideLoading();
          wx.showToast({ title: error.message || "删除失败", icon: "none" });
        }
      }
    });
  }
});
