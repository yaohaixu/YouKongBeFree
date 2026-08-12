const api = require("../../utils/api");
const cache = require("../../utils/cache");

const ME_TTL = 2 * 60 * 1000;

function meCacheKey() {
  return cache.keys.meSummary(cache.currentIdentityPart());
}

Page({
  data: {
    loading: true,
    error: "",
    refreshing: false,
    profile: null,
    avatarInitial: "有",
    dashboard: { summary: {} },
    registrations: [],
    identitySync: { counts: {} }
  },

  onLoad() {
    this.loadMe({ preferCache: true });
  },

  onPullDownRefresh() {
    this.loadMe({ force: true }).finally(() => wx.stopPullDownRefresh());
  },

  renderMe(data) {
    this.setData({
      profile: data.profile || {},
      avatarInitial: ((data.profile || {}).displayName || "有").slice(0, 1),
      dashboard: data.dashboard || { summary: {} },
      registrations: data.registrations || [],
      identitySync: data.identitySync || { counts: {} },
      loading: false,
      refreshing: false,
      error: ""
    });
  },

  async loadMe(options = {}) {
    const key = meCacheKey();
    const cached = cache.getWithMeta(key);
    const force = Boolean(options.force);
    if (options.preferCache !== false && cached.exists && !force) {
      this.renderMe(cached.data);
      if (!cached.expired) return Promise.resolve(cached.data);
      this.setData({ refreshing: true });
      return this.refreshMe(key);
    }

    this.setData({ loading: true, refreshing: false, error: "" });
    return this.refreshMe(key);
  },

  async refreshMe(key = meCacheKey()) {
    try {
      const data = await api.get("/api/me/summary");
      cache.set(key, data, ME_TTL);
      this.renderMe(data);
      return data;
    } catch (error) {
      const fallback = cache.get(key, { allowExpired: true });
      if (fallback) {
        this.renderMe(fallback);
        return fallback;
      }
      this.setData({
        error: error.message || "我的页面读取失败",
        loading: false,
        refreshing: false
      });
      return null;
    }
  },

  openEntry(event) {
    const url = event.currentTarget.dataset.url;
    if (!url) return;
    wx.navigateTo({ url });
  }
});
