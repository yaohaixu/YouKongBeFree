const api = require("../../utils/api");
const { toRegistrationView } = require("../../utils/format");
const registrationToken = require("../../utils/registration-token");

Page({
  data: {
    loading: true,
    loadingMore: false,
    error: "",
    page: 1,
    pageSize: 10,
    hasMore: true,
    registrations: []
  },

  onLoad() {
    this.loadRegistrations({ reset: true });
  },

  onPullDownRefresh() {
    this.loadRegistrations({ reset: true }).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.loadRegistrations({ reset: false });
  },

  async loadRegistrations(options = {}) {
    const reset = options.reset !== false;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true, error: "" } : { loadingMore: true, error: "" });
    try {
      const data = await api.get(`/api/my/registrations?page=${page}&pageSize=${this.data.pageSize}`);
      const tokens = registrationToken.all();
      const nextRows = (data.registrations || []).map((item) => {
        const view = toRegistrationView(item);
        const saved = tokens[item.id] || {};
        return {
          ...view,
          canCancel: Boolean(saved.accessToken),
          accessToken: saved.accessToken || ""
        };
      });
      const pageInfo = data.pageInfo || {};
      this.setData({
        page,
        registrations: reset ? nextRows : this.data.registrations.concat(nextRows),
        hasMore: Boolean(pageInfo.hasMore),
        loading: false,
        loadingMore: false
      });
    } catch (error) {
      this.setData({
        error: error.message || "报名记录读取失败",
        loading: false,
        loadingMore: false
      });
    }
  },

  openActivity(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/activity-detail/activity-detail?id=${encodeURIComponent(id)}` });
  },

  cancelRegistration(event) {
    const item = event.currentTarget.dataset.item;
    if (!item || !item.id || !item.activity || !item.activity.id || !item.accessToken) {
      wx.showToast({ title: "当前设备缺少取消凭证", icon: "none" });
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
          await api.post(`/api/activities/${encodeURIComponent(item.activity.id)}/registrations/${encodeURIComponent(item.id)}/cancel`, {
            token: item.accessToken
          });
          registrationToken.forget(item.id);
          wx.hideLoading();
          wx.showToast({ title: "已取消", icon: "success" });
          this.loadRegistrations({ reset: true });
        } catch (error) {
          wx.hideLoading();
          wx.showToast({ title: error.message || "取消失败", icon: "none" });
        }
      }
    });
  }
});
