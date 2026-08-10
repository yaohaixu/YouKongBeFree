const api = require("../../utils/api");
const { formatDateTime, toActivityView } = require("../../utils/format");

function decorateRegistration(item = {}) {
  return {
    ...item,
    displayCreatedAt: formatDateTime(item.createdAt)
  };
}

function registrationExportText(activity = {}, registrations = []) {
  const lines = [
    `活动报名表：${activity.title || "未命名活动"}`,
    `时间：${activity.displayTime || "时间待定"}`,
    `地点：${activity.location || "地点待定"}`,
    `报名：${registrations.length}/${activity.capacity || 99} 人`,
  ];
  if (activity.displayFormation) lines.push(`成团：${activity.displayFormation}`);
  lines.push("", "报名名单：");
  if (!registrations.length) {
    lines.push("暂无报名");
  } else {
    registrations.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.nickname || "未命名报名"} · ${item.displayCreatedAt || "刚刚"}`);
    });
  }
  return lines.join("\n");
}

Page({
  data: {
    id: "",
    loading: true,
    error: "",
    activity: null,
    registrations: []
  },

  onLoad(options = {}) {
    this.setData({ id: options.id || "" });
    this.loadRegistrations();
  },

  onPullDownRefresh() {
    this.loadRegistrations().finally(() => wx.stopPullDownRefresh());
  },

  async loadRegistrations() {
    if (!this.data.id) {
      this.setData({ loading: false, error: "缺少活动 ID" });
      return;
    }
    this.setData({ loading: true, error: "" });
    try {
      const [activityData, registrationData] = await Promise.all([
        api.get(`/api/activities/${encodeURIComponent(this.data.id)}`),
        api.get(`/api/activities/${encodeURIComponent(this.data.id)}/registrations`)
      ]);
      const activity = toActivityView(activityData.activity || {});
      this.setData({
        activity,
        registrations: (registrationData.registrations || []).map(decorateRegistration),
        loading: false
      });
    } catch (error) {
      this.setData({
        error: error.message || "报名表读取失败",
        loading: false
      });
    }
  },

  deleteRegistration(event) {
    const registrationId = event.currentTarget.dataset.id;
    const nickname = event.currentTarget.dataset.nickname || "这条报名";
    if (!registrationId || !this.data.id) return;
    wx.showModal({
      title: "删除报名记录",
      content: `确认删除「${nickname}」的报名吗？`,
      confirmText: "删除",
      cancelText: "再想想",
      success: async (result) => {
        if (!result.confirm) return;
        wx.showLoading({ title: "删除中..." });
        try {
          await api.del(`/api/activities/${encodeURIComponent(this.data.id)}/registrations/${encodeURIComponent(registrationId)}`);
          wx.hideLoading();
          wx.showToast({ title: "已删除", icon: "success" });
          this.loadRegistrations();
        } catch (error) {
          wx.hideLoading();
          wx.showToast({ title: error.message || "删除失败", icon: "none" });
        }
      }
    });
  },

  copyRegistrationsText() {
    const text = registrationExportText(this.data.activity || {}, this.data.registrations || []);
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: "已复制名单", icon: "success" })
    });
  }
});
