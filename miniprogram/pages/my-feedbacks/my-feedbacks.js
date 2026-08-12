const api = require("../../utils/api");
const cache = require("../../utils/cache");
const { toFeedbackView } = require("../../utils/format");

const FEEDBACKS_TTL = 2 * 60 * 1000;

function feedbacksCacheKey(page, pageSize) {
  return cache.keys.feedbacks(cache.currentIdentityPart(), page, pageSize);
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
    feedbacks: []
  },

  onLoad() {
    this.loadFeedbacks({ reset: true, preferCache: true });
  },

  onPullDownRefresh() {
    this.loadFeedbacks({ reset: true, force: true }).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.loadFeedbacks({ reset: false });
  },

  async loadFeedbacks(options = {}) {
    const reset = options.reset !== false;
    const page = reset ? 1 : this.data.page + 1;
    const key = feedbacksCacheKey(page, this.data.pageSize);
    const cached = cache.getWithMeta(key);
    const force = Boolean(options.force);
    if (reset && options.preferCache !== false && cached.exists && !force) {
      this.renderFeedbacks(cached.data, { reset, page });
      if (!cached.expired) return Promise.resolve(cached.data);
      this.setData({ refreshing: true });
      return this.refreshFeedbacks({ reset, page, key });
    }

    this.setData(reset ? { loading: true, error: "" } : { loadingMore: true, error: "" });
    return this.refreshFeedbacks({ reset, page, key });
  },

  renderFeedbacks(data = {}, options = {}) {
    const nextRows = (data.feedbacks || []).map(toFeedbackView);
    const pageInfo = data.pageInfo || {};
    this.setData({
      page: options.page,
      feedbacks: options.reset ? nextRows : this.data.feedbacks.concat(nextRows),
      hasMore: Boolean(pageInfo.hasMore),
      loading: false,
      loadingMore: false,
      refreshing: false,
      error: ""
    });
  },

  async refreshFeedbacks(options = {}) {
    try {
      const data = await api.get(`/api/my/feedbacks?page=${options.page}&pageSize=${this.data.pageSize}`);
      cache.set(options.key, data, FEEDBACKS_TTL);
      this.renderFeedbacks(data, options);
      return data;
    } catch (error) {
      const fallback = cache.get(options.key, { allowExpired: true });
      if (fallback) {
        this.renderFeedbacks(fallback, options);
        return fallback;
      }
      this.setData({
        error: error.message || "活动反馈读取失败",
        loading: false,
        loadingMore: false,
        refreshing: false
      });
      return null;
    }
  },

  openActivity(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/activity-detail/activity-detail?id=${encodeURIComponent(id)}` });
  }
});
