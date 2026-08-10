const api = require("../../utils/api");
const { toActivityView, stripHtml } = require("../../utils/format");
const shareImage = require("../../utils/share-image");
const share = require("../../utils/share");
const registrationToken = require("../../utils/registration-token");

const REPORT_REASONS = ["广告营销", "虚假活动", "违法违规", "人身攻击", "其他"];

function extractInviteToken(invite = {}) {
  const text = String(invite.inviteUrl || invite.url || invite.invitePath || invite.path || "");
  const match = text.match(/[?&]token=([^&#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function decorateActivity(raw = {}) {
  const activity = toActivityView(raw || {});
  activity.plainDescription = stripHtml(activity.description || "");
  activity.richDescription = activity.description || "";
  activity.permissions = activity.permissions || {};
  activity.publicRegistrations = activity.publicRegistrations || [];
  activity.publicFeedbacks = activity.publicFeedbacks || [];
  activity.coInitiators = (activity.coInitiators || []).map((item) => ({
    ...item,
    avatarInitial: String(item.displayName || "共").slice(0, 1),
    profileId: item.communityId || item.id || ""
  }));
  return activity;
}

Page({
  data: {
    id: "",
    loading: true,
    registering: false,
    interestLoading: false,
    reportSubmitting: false,
    error: "",
    nickname: "",
    activity: null,
    showReportForm: false,
    reportReasons: REPORT_REASONS,
    reportReasonIndex: 0,
    reportDetail: "",
    coInvite: null,
    notificationConfig: null,
    subscribingReminder: false,
    reminderSubscribed: false,
    shareImageLoading: false,
    shareCanvasWidth: 900,
    shareCanvasHeight: 1180
  },

  onLoad(options = {}) {
    share.enableShareMenu();
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
      const [data, config] = await Promise.all([
        api.get(`/api/activities/${encodeURIComponent(this.data.id)}`),
        api.get("/api/miniprogram/config").catch(() => ({ notifications: null }))
      ]);
      const activity = decorateActivity(data.activity || {});
      this.setData({
        activity,
        notificationConfig: config.notifications || null,
        loading: false
      });
    } catch (error) {
      this.setData({
        error: error.message || "活动读取失败",
        loading: false
      });
    }
  },

  handleNicknameInput(event) {
    this.setData({ nickname: event.detail.value || "" });
  },

  async registerActivity() {
    if (!this.data.activity || this.data.registering) return;
    if (!this.data.activity.canRegister) {
      wx.showToast({ title: this.data.activity.registrationNotice || "这个活动暂时不能报名", icon: "none" });
      return;
    }
    const nickname = String(this.data.nickname || "").trim();
    if (!nickname) {
      wx.showToast({ title: "请先填写昵称", icon: "none" });
      return;
    }
    this.setData({ registering: true });
    try {
      const data = await api.post(`/api/activities/${encodeURIComponent(this.data.activity.id)}/register`, { nickname });
      registrationToken.save(data.registration, data.accessToken);
      const activity = decorateActivity(data.activity || this.data.activity);
      this.setData({ activity, registering: false });
      const registrationId = data.registration && data.registration.id;
      const accessToken = data.accessToken || data.registration?.accessToken || "";
      if (registrationId && accessToken) {
        wx.navigateTo({
          url: `/pages/registration-success/registration-success?activity=${encodeURIComponent(activity.id)}&registration=${encodeURIComponent(registrationId)}&token=${encodeURIComponent(accessToken)}`
        });
      } else {
        wx.showToast({ title: data.existing ? "已报名过" : "报名成功", icon: "success" });
      }
    } catch (error) {
      this.setData({ registering: false });
      wx.showToast({ title: error.message || "报名失败", icon: "none" });
    }
  },

  async markInterest() {
    if (!this.data.activity || this.data.interestLoading) return;
    this.setData({ interestLoading: true });
    try {
      const data = await api.post(`/api/activities/${encodeURIComponent(this.data.activity.id)}/interests`, {});
      const activity = decorateActivity(data.activity || {
        ...this.data.activity,
        interestCount: data.interestCount
      });
      this.setData({ activity, interestLoading: false });
      wx.showToast({ title: data.existing ? "已经点过啦" : "已记录感兴趣", icon: "success" });
    } catch (error) {
      this.setData({ interestLoading: false });
      wx.showToast({ title: error.message || "暂时不能记录", icon: "none" });
    }
  },

  activityReminderTemplateIds() {
    const scene = this.data.notificationConfig
      && this.data.notificationConfig.scenes
      && this.data.notificationConfig.scenes.activityReminder;
    return scene && Array.isArray(scene.templateIds) ? scene.templateIds.filter(Boolean) : [];
  },

  async subscribeActivityReminder() {
    const activity = this.data.activity;
    if (!activity || this.data.subscribingReminder) return;
    const templateIds = this.activityReminderTemplateIds();
    if (!templateIds.length) {
      wx.showToast({ title: "活动提醒模板暂未配置", icon: "none" });
      return;
    }
    if (!wx.requestSubscribeMessage) {
      wx.showToast({ title: "当前微信版本不支持订阅提醒", icon: "none" });
      return;
    }
    this.setData({ subscribingReminder: true });
    try {
      const authorization = await new Promise((resolve, reject) => {
        wx.requestSubscribeMessage({
          tmplIds: templateIds,
          success: resolve,
          fail: reject
        });
      });
      const data = await api.post(`/api/activities/${encodeURIComponent(activity.id)}/notification-subscriptions`, {
        source: "wechat_miniprogram",
        scene: "activity_reminder",
        templateIds,
        authorization
      });
      const accepted = data.subscription && data.subscription.status === "accepted";
      this.setData({
        reminderSubscribed: accepted,
        subscribingReminder: false
      });
      wx.showToast({ title: accepted ? "已订阅提醒" : "暂未授权提醒", icon: "none" });
    } catch (error) {
      this.setData({ subscribingReminder: false });
      wx.showToast({ title: error.message || "订阅失败", icon: "none" });
    }
  },

  shareActivity() {
    if (!this.data.activity) return;
    wx.setClipboardData({
      data: `https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/activity.html?id=${this.data.activity.id}`
    });
  },

  async runShareImageTask(loadingTitle, task) {
    if (!this.data.activity || this.data.shareImageLoading) return;
    this.setData({ shareImageLoading: true });
    wx.showLoading({ title: loadingTitle || "生成中..." });
    try {
      const filePath = await task();
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

  downloadActivityQr() {
    const activity = this.data.activity;
    if (!activity || !activity.id) return;
    this.runShareImageTask("生成二维码...", () => shareImage.generateQrCard(this, {
      text: shareImage.activityUrl(activity.id),
      eyebrow: "活动二维码",
      title: activity.title || "有空活动",
      subtitle: `${activity.displayTime || shareImage.formatActivityTime(activity.startsAt, activity.endsAt)} · ${activity.location || "地点待定"}`,
      label: "扫码查看活动"
    }));
  },

  downloadFeedbackQr() {
    const activity = this.data.activity;
    if (!activity || !activity.id) return;
    if (!activity.permissions.canEdit && !activity.permissions.canManageCoInitiators) {
      wx.showToast({ title: "只有发起人可以下载反馈二维码", icon: "none" });
      return;
    }
    this.runShareImageTask("生成反馈码...", () => shareImage.generateQrCard(this, {
      text: shareImage.feedbackUrl(activity.id),
      eyebrow: "活动反馈二维码",
      title: activity.title || "有空活动",
      subtitle: "活动结束后，扫码填写匿名反馈。",
      label: "扫码填写反馈"
    }));
  },

  downloadInvitationPoster() {
    const activity = this.data.activity;
    if (!activity || !activity.id) return;
    const inviteeNickname = String(this.data.nickname || "").trim() || "有空的朋友";
    this.runShareImageTask("生成邀请函...", () => shareImage.generateActivityPoster(this, activity, {
      inviteeNickname
    }));
  },

  addToCalendar() {
    const activity = this.data.activity;
    if (!activity || !activity.startsAt) return;
    if (!wx.addPhoneCalendar) {
      wx.showToast({ title: "当前微信版本暂不支持加日历", icon: "none" });
      return;
    }
    const start = new Date(activity.startsAt);
    const end = activity.endsAt ? new Date(activity.endsAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    if (Number.isNaN(start.getTime())) {
      wx.showToast({ title: "活动时间不正确", icon: "none" });
      return;
    }
    wx.addPhoneCalendar({
      title: activity.title || "有空客厅活动",
      startTime: Math.floor(start.getTime() / 1000),
      endTime: Math.floor(end.getTime() / 1000),
      location: activity.location || "有空客厅",
      description: activity.displaySummary || activity.plainDescription || "",
      success: () => wx.showToast({ title: "已打开日历", icon: "success" }),
      fail: (error) => wx.showToast({ title: error.errMsg || "加日历失败", icon: "none" })
    });
  },

  goFeedback() {
    const activity = this.data.activity;
    if (!activity || !activity.id) return;
    wx.navigateTo({ url: `/pages/feedback/feedback?id=${encodeURIComponent(activity.id)}` });
  },

  goEditor() {
    const activity = this.data.activity;
    if (!activity || !activity.id) return;
    wx.navigateTo({ url: `/pages/activity-editor/activity-editor?id=${encodeURIComponent(activity.id)}` });
  },

  goRegistrations() {
    const activity = this.data.activity;
    if (!activity || !activity.id) return;
    wx.navigateTo({ url: `/pages/activity-registrations/activity-registrations?id=${encodeURIComponent(activity.id)}` });
  },

  goActivityFeedbacks() {
    const activity = this.data.activity;
    if (!activity || !activity.id) return;
    wx.navigateTo({ url: `/pages/activity-feedbacks/activity-feedbacks?id=${encodeURIComponent(activity.id)}` });
  },

  openInitiatorProfile() {
    const profile = this.data.activity && this.data.activity.initiatorProfile;
    const id = profile && (profile.communityId || profile.id);
    if (!id) return;
    wx.navigateTo({ url: `/pages/profile/profile?id=${encodeURIComponent(id)}` });
  },

  openCoProfile(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/profile/profile?id=${encodeURIComponent(id)}` });
  },

  toggleReportForm() {
    this.setData({ showReportForm: !this.data.showReportForm });
  },

  handleReportReasonChange(event) {
    this.setData({ reportReasonIndex: Number(event.detail.value || 0) });
  },

  handleReportDetailInput(event) {
    this.setData({ reportDetail: event.detail.value || "" });
  },

  async submitReport() {
    if (!this.data.activity || this.data.reportSubmitting) return;
    const reason = this.data.reportReasons[this.data.reportReasonIndex] || "其他";
    this.setData({ reportSubmitting: true });
    wx.showLoading({ title: "提交中..." });
    try {
      const data = await api.post(`/api/activities/${encodeURIComponent(this.data.activity.id)}/reports`, {
        reason,
        detail: this.data.reportDetail
      });
      const activity = decorateActivity(data.activity || this.data.activity);
      wx.hideLoading();
      wx.showToast({ title: data.existing ? "已经反馈过" : "已提交", icon: "success" });
      this.setData({
        activity,
        showReportForm: false,
        reportDetail: "",
        reportSubmitting: false
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "提交失败", icon: "none" });
      this.setData({ reportSubmitting: false });
    }
  },

  async createCoInvite() {
    if (!this.data.activity) return;
    wx.showLoading({ title: "生成邀请..." });
    try {
      const result = await api.post(`/api/activities/${encodeURIComponent(this.data.activity.id)}/co-initiator-invites`, {});
      const invite = result.invite || {};
      const token = extractInviteToken(invite);
      this.setData({ coInvite: { ...invite, token } });
      wx.hideLoading();
      wx.setClipboardData({ data: invite.inviteUrl || token || "" });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "邀请生成失败", icon: "none" });
    }
  },

  copyCoInvite() {
    const invite = this.data.coInvite || {};
    const value = invite.inviteUrl || invite.token || "";
    if (!value) return;
    wx.setClipboardData({ data: value });
  },

  removeCoInitiator(event) {
    const identityId = event.currentTarget.dataset.id;
    const name = event.currentTarget.dataset.name || "这位共同发起人";
    const activity = this.data.activity;
    if (!identityId || !activity) return;
    wx.showModal({
      title: "移除共同发起人",
      content: `确认移除「${name}」吗？`,
      confirmText: "移除",
      cancelText: "再想想",
      success: async (result) => {
        if (!result.confirm) return;
        wx.showLoading({ title: "移除中..." });
        try {
          const data = await api.del(`/api/activities/${encodeURIComponent(activity.id)}/co-initiators/${encodeURIComponent(identityId)}`);
          const nextActivity = decorateActivity(data.activity || activity);
          wx.hideLoading();
          wx.showToast({ title: "已移除", icon: "success" });
          this.setData({ activity: nextActivity });
        } catch (error) {
          wx.hideLoading();
          wx.showToast({ title: error.message || "移除失败", icon: "none" });
        }
      }
    });
  },

  onShareAppMessage() {
    const activity = this.data.activity || {};
    if (this.data.coInvite && this.data.coInvite.token) {
      return {
        title: `邀请你共同发起：${activity.title || "有空客厅活动"}`,
        path: `/pages/co-invite/co-invite?token=${encodeURIComponent(this.data.coInvite.token)}`
      };
    }
    return share.activityShare({ ...activity, id: activity.id || this.data.id });
  },

  onShareTimeline() {
    const activity = this.data.activity || {};
    return {
      title: activity.title || "有空客厅活动",
      query: `id=${encodeURIComponent(activity.id || this.data.id || "")}`,
    };
  }
});
