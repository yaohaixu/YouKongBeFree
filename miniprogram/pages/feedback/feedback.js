const api = require("../../utils/api");
const cache = require("../../utils/cache");
const { toActivityView } = require("../../utils/format");

Page({
  data: {
    id: "",
    loading: true,
    submitting: false,
    error: "",
    activity: null,
    form: {
      favorite: "",
      improvement: "",
      other: ""
    }
  },

  onLoad(options = {}) {
    this.setData({ id: options.id || "" });
    this.loadActivity();
  },

  onPullDownRefresh() {
    this.loadActivity().finally(() => wx.stopPullDownRefresh());
  },

  async loadActivity() {
    if (!this.data.id) {
      this.setData({ loading: false, error: "缺少活动 ID" });
      return;
    }
    this.setData({ loading: true, error: "" });
    try {
      const data = await api.get(`/api/activities/${encodeURIComponent(this.data.id)}`);
      this.setData({
        activity: toActivityView(data.activity || {}),
        loading: false
      });
    } catch (error) {
      this.setData({
        error: error.message || "活动读取失败",
        loading: false
      });
    }
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`form.${field}`]: event.detail.value || "" });
  },

  async submitFeedback() {
    if (this.data.submitting || !this.data.id) return;
    if (!this.data.activity || !this.data.activity.hasEnded) {
      wx.showToast({ title: "活动结束后再来写下活动感受", icon: "none" });
      return;
    }
    const payload = {
      favorite: String(this.data.form.favorite || "").trim(),
      improvement: String(this.data.form.improvement || "").trim(),
      other: String(this.data.form.other || "").trim()
    };
    if (!payload.favorite && !payload.improvement && !payload.other) {
      wx.showToast({ title: "至少写一点活动感受", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    wx.showLoading({ title: "提交感受..." });
    try {
      const data = await api.post(`/api/activities/${encodeURIComponent(this.data.id)}/feedbacks`, payload);
      cache.removeByPrefix(cache.keys.userPrefix(cache.currentIdentityPart()));
      cache.invalidatePublicActivities(this.data.id);
      wx.hideLoading();
      wx.showToast({
        title: data.existing ? "已经提交过" : "感受已提交",
        icon: "success"
      });
      setTimeout(() => {
        wx.redirectTo({ url: "/pages/my-feedbacks/my-feedbacks" });
      }, 520);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "提交失败", icon: "none" });
      this.setData({ submitting: false });
    }
  }
});
