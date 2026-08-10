const api = require("../../utils/api");
const { toFeedbackView } = require("../../utils/format");

Page({
  data: {
    loading: true,
    loadingMore: false,
    error: "",
    page: 1,
    pageSize: 10,
    hasMore: true,
    feedbacks: []
  },

  onLoad() {
    this.loadFeedbacks({ reset: true });
  },

  onPullDownRefresh() {
    this.loadFeedbacks({ reset: true }).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.loadFeedbacks({ reset: false });
  },

  async loadFeedbacks(options = {}) {
    const reset = options.reset !== false;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true, error: "" } : { loadingMore: true, error: "" });
    try {
      const data = await api.get(`/api/my/feedbacks?page=${page}&pageSize=${this.data.pageSize}`);
      const nextRows = (data.feedbacks || []).map(toFeedbackView);
      const pageInfo = data.pageInfo || {};
      this.setData({
        page,
        feedbacks: reset ? nextRows : this.data.feedbacks.concat(nextRows),
        hasMore: Boolean(pageInfo.hasMore),
        loading: false,
        loadingMore: false
      });
    } catch (error) {
      this.setData({
        error: error.message || "活动反馈读取失败",
        loading: false,
        loadingMore: false
      });
    }
  },

  openActivity(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/activity-detail/activity-detail?id=${encodeURIComponent(id)}` });
  }
});
