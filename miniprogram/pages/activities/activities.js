const api = require("../../utils/api");
const { toActivityView } = require("../../utils/format");
const { loadReminderConfig, subscribeActivityReminder } = require("../../utils/activity-reminder");
const share = require("../../utils/share");

Page({
  data: {
    view: "upcoming",
    sourceType: "",
    seriesId: "",
    seriesTabs: [{ id: "", name: "全部系列" }],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: true,
    loadingMore: false,
    error: "",
    activities: [],
    notificationConfig: null
  },

  onLoad(options = {}) {
    share.enableShareMenu();
    const view = options.view === "history" ? "history" : "upcoming";
    const sourceType = view === "history" ? options.sourceType || "" : "";
    const seriesId = options.seriesId || "";
    this.setData({ view, sourceType, seriesId });
    this.loadActivitySeries();
    this.loadNotificationConfig();
    this.loadActivities({ reset: true });
  },

  onPullDownRefresh() {
    this.loadActivities({ reset: true }).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.loadActivities({ reset: false });
  },

  switchView(event) {
    const view = event.currentTarget.dataset.view;
    if (!view || view === this.data.view) return;
    this.setData({ view, sourceType: view === "history" ? this.data.sourceType : "", page: 1, hasMore: true, activities: [] });
    this.loadActivities({ reset: true });
  },

  switchSourceType(event) {
    const sourceType = event.currentTarget.dataset.sourceType || "";
    if (sourceType === this.data.sourceType) return;
    this.setData({ sourceType, page: 1, hasMore: true, activities: [] });
    this.loadActivities({ reset: true });
  },

  switchSeries(event) {
    const seriesId = event.currentTarget.dataset.seriesId || "";
    if (seriesId === this.data.seriesId) return;
    this.setData({ seriesId, page: 1, hasMore: true, activities: [] });
    this.loadActivities({ reset: true });
  },

  async loadActivitySeries() {
    try {
      const data = await api.get("/api/activity-series");
      const series = data.series || [];
      this.setData({
        seriesTabs: [{ id: "", name: "全部系列" }].concat(series.map((item) => ({
          id: item.id,
          name: item.name || "未命名系列"
        })))
      });
    } catch (error) {
      this.setData({ seriesTabs: [{ id: "", name: "全部系列" }] });
    }
  },

  async loadNotificationConfig() {
    try {
      const notificationConfig = await loadReminderConfig();
      this.setData({ notificationConfig });
    } catch {
      this.setData({ notificationConfig: null });
    }
  },

  async loadActivities(options = {}) {
    const reset = options.reset !== false;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true, error: "" } : { loadingMore: true, error: "" });
    try {
      const sort = this.data.view === "history" ? "start-desc" : "start-asc";
      const sourceQuery = this.data.view === "history" && this.data.sourceType
        ? `&sourceType=${encodeURIComponent(this.data.sourceType)}`
        : "";
      const seriesQuery = this.data.seriesId ? `&seriesId=${encodeURIComponent(this.data.seriesId)}` : "";
      const data = await api.get(`/api/activities?view=${this.data.view}&page=${page}&pageSize=${this.data.pageSize}&sort=${sort}${sourceQuery}${seriesQuery}`);
      const nextActivities = (data.activities || []).map(toActivityView);
      const pageInfo = data.pageInfo || {};
      this.setData({
        page,
        activities: reset ? nextActivities : this.data.activities.concat(nextActivities),
        hasMore: Boolean(pageInfo.hasMore),
        loading: false,
        loadingMore: false
      });
    } catch (error) {
      this.setData({
        error: error.message || "活动读取失败",
        loading: false,
        loadingMore: false
      });
    }
  },

  onShareAppMessage(event = {}) {
    return share.activityShareFromEvent(event) || share.defaultShare("/pages/activities/activities");
  },

  onShareTimeline() {
    const query = this.data.view === "history" ? "view=history" : "";
    return share.defaultTimeline(query);
  },

  openActivityDetail(event) {
    const activity = event.detail?.activity || {};
    if (!activity.id) return;
    wx.navigateTo({ url: `/pages/activity-detail/activity-detail?id=${encodeURIComponent(activity.id)}` });
  },

  async recordInterest(event) {
    const activity = event.detail?.activity || {};
    if (!activity.id) return;
    try {
      const data = await api.post(`/api/activities/${encodeURIComponent(activity.id)}/interests`, {});
      this.setData({
        activities: this.data.activities.map((item) => item.id === activity.id ? toActivityView({
          ...item,
          interestCount: data.interestCount,
          interestedByMe: true
        }) : item)
      });
      wx.showToast({ title: data.existing ? "已经点过啦" : "已记录感兴趣", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "暂时不能记录", icon: "none" });
    }
  },

  async subscribeReminder(event) {
    const activity = event.detail?.activity || {};
    if (!activity.id) return;
    if (!this.data.notificationConfig) await this.loadNotificationConfig();
    try {
      const data = await subscribeActivityReminder(activity.id, this.data.notificationConfig || {});
      const accepted = data.subscription && data.subscription.status === "accepted";
      wx.showToast({ title: accepted ? "已订阅提醒" : "暂未授权提醒", icon: "none" });
    } catch (error) {
      wx.showToast({ title: error.message || "订阅失败", icon: "none" });
    }
  }
});
