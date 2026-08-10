const api = require("../../utils/api");
const { formatActivityTime } = require("../../utils/format");
const share = require("../../utils/share");

Page({
  data: {
    token: "",
    loading: true,
    accepting: false,
    error: "",
    invite: null,
    activity: null,
    inviterName: "主发起人",
    myProfile: {},
    profileReady: false
  },

  onLoad(options = {}) {
    share.enableShareMenu();
    this.setData({ token: options.token || "" });
    this.loadInvite();
  },

  onShow() {
    if (this.data.token && !this.data.loading) this.loadInvite({ quiet: true });
  },

  async loadInvite(options = {}) {
    if (!this.data.token) {
      this.setData({ loading: false, error: "缺少邀请 token" });
      return;
    }
    if (!options.quiet) this.setData({ loading: true, error: "" });
    try {
      const data = await api.get(`/api/co-initiator-invites/${encodeURIComponent(this.data.token)}`);
      const activity = data.activity || {};
      activity.displayTime = formatActivityTime(activity.startsAt, activity.endsAt);
      const myProfile = data.myProfile || {};
      this.setData({
        invite: data.invite || {},
        activity,
        inviterName: (data.inviterProfile && data.inviterProfile.displayName) || activity.initiator || "主发起人",
        myProfile,
        profileReady: Boolean(myProfile.displayName),
        loading: false
      });
    } catch (error) {
      this.setData({
        error: error.message || "邀请读取失败",
        loading: false
      });
    }
  },

  goProfileEditor() {
    wx.navigateTo({ url: "/pages/profile-editor/profile-editor" });
  },

  async acceptInvite() {
    if (!this.data.profileReady) {
      wx.showToast({ title: "请先填写公开昵称", icon: "none" });
      return;
    }
    if (this.data.accepting) return;
    this.setData({ accepting: true });
    wx.showLoading({ title: "接受邀请..." });
    try {
      const data = await api.post(`/api/co-initiator-invites/${encodeURIComponent(this.data.token)}/accept`, {});
      wx.hideLoading();
      wx.showToast({ title: "已加入", icon: "success" });
      const activity = data.activity || this.data.activity || {};
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/activity-detail/activity-detail?id=${encodeURIComponent(activity.id || "")}` });
      }, 520);
    } catch (error) {
      wx.hideLoading();
      if (error.data && error.data.code === "profile_required") {
        wx.showToast({ title: "请先填写公开昵称", icon: "none" });
      } else {
        wx.showToast({ title: error.message || "接受失败", icon: "none" });
      }
      this.setData({ accepting: false });
    }
  },

  onShareAppMessage() {
    return {
      title: `邀请你共同发起：${this.data.activity?.title || "有空客厅活动"}`,
      path: `/pages/co-invite/co-invite?token=${encodeURIComponent(this.data.token || "")}`,
    };
  }
});
