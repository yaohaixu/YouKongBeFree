const api = require("../../utils/api");
const { toActivityView } = require("../../utils/format");

Page({
  data: {
    loading: true,
    loadingMore: false,
    error: "",
    page: 1,
    pageSize: 10,
    hasMore: true,
    status: "",
    activities: []
  },

  onLoad() {
    this.loadActivities({ reset: true });
  },

  onPullDownRefresh() {
    this.loadActivities({ reset: true }).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.loadActivities({ reset: false });
  },

  switchStatus(event) {
    const status = event.currentTarget.dataset.status || "";
    if (status === this.data.status) return;
    this.setData({ status, page: 1, hasMore: true, activities: [] });
    this.loadActivities({ reset: true });
  },

  goEditor(event) {
    const id = event && event.currentTarget ? event.currentTarget.dataset.id : "";
    wx.navigateTo({ url: id ? `/pages/activity-editor/activity-editor?id=${encodeURIComponent(id)}` : "/pages/activity-editor/activity-editor" });
  },

  goRegistrations(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/activity-registrations/activity-registrations?id=${encodeURIComponent(id)}` });
  },

  runActivityAction(event) {
    const id = event.currentTarget.dataset.id;
    const action = event.currentTarget.dataset.action;
    const title = event.currentTarget.dataset.title || "这个活动";
    const labels = {
      withdraw: "撤回为草稿",
      cancel: "取消活动",
      end: "结束活动"
    };
    if (!id || !action) return;
    wx.showModal({
      title: labels[action] || "处理活动",
      content: `确认要${labels[action] || "处理"}「${title}」吗？`,
      confirmText: "确认",
      cancelText: "再想想",
      success: async (result) => {
        if (!result.confirm) return;
        wx.showLoading({ title: "处理中..." });
        try {
          await api.post(`/api/activities/${encodeURIComponent(id)}/${action}`, {});
          wx.hideLoading();
          wx.showToast({ title: "已处理", icon: "success" });
          this.loadActivities({ reset: true });
        } catch (error) {
          wx.hideLoading();
          wx.showToast({ title: error.message || "处理失败", icon: "none" });
        }
      }
    });
  },

  async loadActivities(options = {}) {
    const reset = options.reset !== false;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true, error: "" } : { loadingMore: true, error: "" });
    try {
      const statusParam = this.data.status ? `&status=${encodeURIComponent(this.data.status)}` : "";
      const data = await api.get(`/api/activities?owner=me&page=${page}&pageSize=${this.data.pageSize}&sort=created-desc${statusParam}`);
      const nextRows = (data.activities || []).map((item) => {
        const view = toActivityView(item);
        view.permissions = view.permissions || {};
        return view;
      });
      const pageInfo = data.pageInfo || {};
      this.setData({
        page,
        activities: reset ? nextRows : this.data.activities.concat(nextRows),
        hasMore: Boolean(pageInfo.hasMore),
        loading: false,
        loadingMore: false
      });
    } catch (error) {
      this.setData({
        error: error.message || "我的活动读取失败",
        loading: false,
        loadingMore: false
      });
    }
  }
});
