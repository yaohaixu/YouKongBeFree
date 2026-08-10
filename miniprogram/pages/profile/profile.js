const api = require("../../utils/api");
const { toActivityView } = require("../../utils/format");
const share = require("../../utils/share");

function initialOf(name = "") {
  return String(name || "有空朋友").slice(0, 1);
}

Page({
  data: {
    id: "",
    loading: true,
    error: "",
    profile: {},
    avatarInitial: "有",
    badges: [],
    summaryItems: [],
    activities: []
  },

  onLoad(options = {}) {
    share.enableShareMenu();
    this.setData({ id: options.id || "" });
    this.loadProfile();
  },

  onPullDownRefresh() {
    this.loadProfile().finally(() => wx.stopPullDownRefresh());
  },

  async loadProfile() {
    if (!this.data.id) {
      this.setData({ loading: false, error: "缺少公开主页 ID" });
      return;
    }
    this.setData({ loading: true, error: "" });
    try {
      const data = await api.get(`/api/profiles/${encodeURIComponent(this.data.id)}`);
      const profile = data.profile || {};
      const summary = data.summary || {};
      this.setData({
        profile,
        avatarInitial: initialOf(profile.displayName),
        badges: data.badges || [],
        summaryItems: [
          { label: "公开活动", value: Number(summary.total || 0) },
          { label: "近期活动", value: Number(summary.upcoming || 0) },
          { label: "历史活动", value: Number(summary.history || 0) },
          { label: "累计报名", value: Number(summary.registrations || 0) }
        ],
        activities: (data.activities || []).map(toActivityView),
        loading: false
      });
    } catch (error) {
      this.setData({
        error: error.message || "公开主页读取失败",
        loading: false
      });
    }
  },

  onShareAppMessage(event = {}) {
    const activityShare = share.activityShareFromEvent(event);
    if (activityShare) return activityShare;
    return {
      title: `${this.data.profile.displayName || "有空朋友"}的有空主页`,
      path: `/pages/profile/profile?id=${encodeURIComponent(this.data.id || "")}`,
    };
  },

  onShareTimeline() {
    return {
      title: `${this.data.profile.displayName || "有空朋友"}的有空主页`,
      query: `id=${encodeURIComponent(this.data.id || "")}`,
    };
  }
});
