const api = require("../../utils/api");
const cache = require("../../utils/cache");
const { toRegistrationView } = require("../../utils/format");
const registrationToken = require("../../utils/registration-token");

const REGISTRATIONS_TTL = 2 * 60 * 1000;

function registrationsCacheKey(page, pageSize) {
  return cache.keys.registrations(cache.currentIdentityPart(), page, pageSize);
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    error: "",
    refreshing: false,
    page: 1,
    pageSize: 10,
    hasMore: true,
    registrations: []
  },

  onLoad() {
    this.loadRegistrations({ reset: true, preferCache: true });
  },

  onPullDownRefresh() {
    this.loadRegistrations({ reset: true, force: true }).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.loadRegistrations({ reset: false });
  },

  async loadRegistrations(options = {}) {
    const reset = options.reset !== false;
    const page = reset ? 1 : this.data.page + 1;
    const key = registrationsCacheKey(page, this.data.pageSize);
    const cached = cache.getWithMeta(key);
    const force = Boolean(options.force);
    if (reset && options.preferCache !== false && cached.exists && !force) {
      this.renderRegistrations(cached.data, { reset, page });
      if (!cached.expired) return Promise.resolve(cached.data);
      this.setData({ refreshing: true });
      return this.refreshRegistrations({ reset, page, key });
    }

    this.setData(reset ? { loading: true, error: "" } : { loadingMore: true, error: "" });
    return this.refreshRegistrations({ reset, page, key });
  },

  renderRegistrations(data = {}, options = {}) {
    try {
      const tokens = registrationToken.all();
      const nextRows = (data.registrations || []).map((item) => {
        const view = toRegistrationView(item);
        const saved = tokens[item.id] || {};
        return {
          ...view,
          canCancel: true,
          accessToken: saved.accessToken || ""
        };
      });
      const pageInfo = data.pageInfo || {};
      this.setData({
        page: options.page,
        registrations: options.reset ? nextRows : this.data.registrations.concat(nextRows),
        hasMore: Boolean(pageInfo.hasMore),
        loading: false,
        loadingMore: false,
        refreshing: false,
        error: ""
      });
    } catch (error) {
      this.setData({ loading: false, loadingMore: false, refreshing: false });
    }
  },

  async refreshRegistrations(options = {}) {
    try {
      const data = await api.get(`/api/my/registrations?page=${options.page}&pageSize=${this.data.pageSize}`);
      cache.set(options.key, data, REGISTRATIONS_TTL);
      this.renderRegistrations(data, options);
      return data;
    } catch (error) {
      const fallback = cache.get(options.key, { allowExpired: true });
      if (fallback) {
        this.renderRegistrations(fallback, options);
        return fallback;
      }
      this.setData({
        error: error.message || "报名记录读取失败",
        loading: false,
        loadingMore: false,
        refreshing: false
      });
      return null;
    }
  },

  openActivity(event) {
    const id = event.currentTarget.dataset.id;
    const registrationId = event.currentTarget.dataset.registrationId;
    if (!id) return;
    const query = registrationId ? `&registration=${encodeURIComponent(registrationId)}` : "";
    wx.navigateTo({ url: `/pages/registration-success/registration-success?activity=${encodeURIComponent(id)}${query}` });
  },

  cancelRegistration(event) {
    const item = event.currentTarget.dataset.item;
    if (!item || !item.id || !item.activity || !item.activity.id) {
      wx.showToast({ title: "缺少报名信息", icon: "none" });
      return;
    }
    wx.showModal({
      title: "取消报名",
      content: `确认取消「${item.activity.title || "这个活动"}」的报名吗？`,
      confirmText: "取消报名",
      cancelText: "再想想",
      success: async (result) => {
        if (!result.confirm) return;
        wx.showLoading({ title: "取消中..." });
        try {
          await api.post(`/api/activities/${encodeURIComponent(item.activity.id)}/registrations/${encodeURIComponent(item.id)}/cancel`, item.accessToken ? {
            token: item.accessToken
          } : {});
          registrationToken.forget(item.id);
          cache.removeByPrefix(cache.keys.userPrefix(cache.currentIdentityPart()));
          cache.invalidatePublicActivities(item.activity.id);
          wx.hideLoading();
          wx.showToast({ title: "已取消", icon: "success" });
          this.loadRegistrations({ reset: true, force: true });
        } catch (error) {
          wx.hideLoading();
          wx.showToast({ title: error.message || "取消失败", icon: "none" });
        }
      }
    });
  }
});
