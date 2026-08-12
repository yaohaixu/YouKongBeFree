const api = require("../../utils/api");
const cache = require("../../utils/cache");
const { toActivityView } = require("../../utils/format");
const shareImage = require("../../utils/share-image");
const share = require("../../utils/share");
const registrationToken = require("../../utils/registration-token");

function decorateActivity(raw = {}) {
  return toActivityView(raw || {});
}

Page({
  data: {
    activityId: "",
    registrationId: "",
    token: "",
    loading: true,
    cancelling: false,
    shareImageLoading: false,
    error: "",
    cancelled: false,
    activity: {},
    registration: {},
    shareCanvasWidth: 900,
    shareCanvasHeight: 1180,
  },

  onLoad(options = {}) {
    share.enableShareMenu();
    this.setData({
      activityId: options.activity || options.activityId || "",
      registrationId: options.registration || options.registrationId || "",
      token: options.token || "",
    });
    this.loadConfirmation();
  },

  onPullDownRefresh() {
    this.loadConfirmation().finally(() => wx.stopPullDownRefresh());
  },

  async loadConfirmation() {
    const { activityId, registrationId, token } = this.data;
    if (!activityId || !registrationId) {
      this.setData({ loading: false, error: "缺少报名确认信息" });
      return;
    }
    this.setData({ loading: true, error: "" });
    try {
      const query = token ? `?token=${encodeURIComponent(token)}` : "";
      const data = await api.get(`/api/activities/${encodeURIComponent(activityId)}/registrations/${encodeURIComponent(registrationId)}${query}`);
      const activity = decorateActivity(data.activity || {});
      const registration = data.registration || {};
      registrationToken.save(registration, token);
      this.setData({ activity, registration, loading: false, cancelled: false });
    } catch (error) {
      this.setData({
        error: error.message || "报名确认读取失败",
        loading: false,
      });
    }
  },

  openActivity() {
    const id = this.data.activity.id || this.data.activityId;
    if (!id) return;
    wx.redirectTo({ url: `/pages/activity-detail/activity-detail?id=${encodeURIComponent(id)}` });
  },

  goMyRegistrations() {
    wx.redirectTo({ url: "/pages/registrations/registrations" });
  },

  copyActivityLink() {
    const id = this.data.activity.id || this.data.activityId;
    if (!id) return;
    wx.setClipboardData({ data: shareImage.activityUrl(id) });
  },

  addToCalendar() {
    const activity = this.data.activity || {};
    if (!activity.startsAt) {
      wx.showToast({ title: "活动时间不正确", icon: "none" });
      return;
    }
    if (!wx.addPhoneCalendar) {
      wx.showToast({ title: "当前微信版本暂不支持加日历", icon: "none" });
      return;
    }
    const start = new Date(activity.startsAt);
    const end = activity.endsAt ? new Date(activity.endsAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    wx.addPhoneCalendar({
      title: activity.title || "有空客厅活动",
      startTime: Math.floor(start.getTime() / 1000),
      endTime: Math.floor(end.getTime() / 1000),
      location: activity.location || "有空客厅",
      description: activity.displayFormation || activity.displayTime || "",
      success: () => wx.showToast({ title: "已打开日历", icon: "success" }),
      fail: (error) => wx.showToast({ title: error.errMsg || "加日历失败", icon: "none" })
    });
  },

  goFeedback() {
    const activity = this.data.activity || {};
    const id = activity.id || this.data.activityId;
    if (!id) return;
    wx.navigateTo({ url: `/pages/feedback/feedback?id=${encodeURIComponent(id)}` });
  },

  async cancelRegistration() {
    const { activityId, registrationId, token, cancelling, cancelled } = this.data;
    if (!activityId || !registrationId || cancelling || cancelled) return;
    wx.showModal({
      title: "取消报名",
      content: `确认取消「${this.data.activity.title || "这个活动"}」的报名吗？`,
      confirmText: "取消报名",
      cancelText: "再想想",
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ cancelling: true });
        wx.showLoading({ title: "取消中..." });
        try {
          await api.post(`/api/activities/${encodeURIComponent(activityId)}/registrations/${encodeURIComponent(registrationId)}/cancel`, token ? { token } : {});
          registrationToken.forget(registrationId);
          cache.removeByPrefix(cache.keys.userPrefix(cache.currentIdentityPart()));
          cache.invalidatePublicActivities(activityId);
          wx.hideLoading();
          this.setData({ cancelling: false, cancelled: true });
          wx.showToast({ title: "已取消", icon: "success" });
        } catch (error) {
          wx.hideLoading();
          this.setData({ cancelling: false });
          wx.showToast({ title: error.message || "取消失败", icon: "none" });
        }
      },
    });
  },

  async downloadInvitationPoster() {
    const activity = this.data.activity;
    if (!activity || !activity.id || this.data.shareImageLoading) return;
    this.setData({ shareImageLoading: true });
    wx.showLoading({ title: "生成邀请函..." });
    try {
      const filePath = await shareImage.generateActivityPoster(this, activity, {
        inviteeNickname: this.data.registration.nickname || "有空的朋友",
      });
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

  onShareAppMessage() {
    return share.activityShare(this.data.activity || { id: this.data.activityId });
  },

  onShareTimeline() {
    return {
      title: this.data.activity.title || "有空客厅活动",
      query: `id=${encodeURIComponent(this.data.activity.id || this.data.activityId || "")}`,
    };
  },
});
