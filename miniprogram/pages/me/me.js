const api = require("../../utils/api");

Page({
  data: {
    loading: true,
    error: "",
    profile: null,
    avatarInitial: "有",
    dashboard: { summary: {} },
    registrations: [],
    identitySync: { counts: {} }
  },

  onLoad() {
    this.loadMe();
  },

  onPullDownRefresh() {
    this.loadMe().finally(() => wx.stopPullDownRefresh());
  },

  async loadMe() {
    this.setData({ loading: true, error: "" });
    try {
      const data = await api.get("/api/me/summary");
      this.setData({
        profile: data.profile || {},
        avatarInitial: ((data.profile || {}).displayName || "有").slice(0, 1),
        dashboard: data.dashboard || { summary: {} },
        registrations: data.registrations || [],
        identitySync: data.identitySync || { counts: {} },
        loading: false
      });
    } catch (error) {
      this.setData({
        error: error.message || "我的页面读取失败",
        loading: false
      });
    }
  },

  openEntry(event) {
    const url = event.currentTarget.dataset.url;
    if (!url) return;
    wx.navigateTo({ url });
  }
});
