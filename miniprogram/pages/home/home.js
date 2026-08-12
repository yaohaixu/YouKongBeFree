const api = require("../../utils/api");
const cache = require("../../utils/cache");
const { toActivityView, roomStatusView } = require("../../utils/format");
const { loadReminderConfig, subscribeActivityReminder } = require("../../utils/activity-reminder");
const share = require("../../utils/share");

const BOOTSTRAP_CACHE_KEY = cache.keys.publicBootstrap();
const BOOTSTRAP_TTL = 5 * 60 * 1000;

let bootstrapMemory = null;
let lastRefreshAt = 0;
let refreshPromise = null;

function homeView(data = {}) {
  return {
    activities: (data.upcomingActivities || []).map(toActivityView),
    roomStatus: roomStatusView(data.roomStatus || {}),
    notificationConfig: data.miniprogramConfig || null
  };
}

Page({
  data: {
    loading: true,
    refreshing: false,
    error: "",
    activities: [],
    roomStatus: roomStatusView({}),
    notificationConfig: null
  },

  onLoad() {
    share.enableShareMenu();
    this.loadHome({ preferCache: true });
  },

  onPullDownRefresh() {
    this.loadHome({ force: true }).finally(() => wx.stopPullDownRefresh());
  },

  renderHome(data, options = {}) {
    const view = homeView(data);
    this.setData({
      activities: view.activities,
      roomStatus: view.roomStatus,
      notificationConfig: view.notificationConfig,
      loading: false,
      refreshing: Boolean(options.refreshing),
      error: ""
    });
  },

  async loadHome(options = {}) {
    const preferCache = options.preferCache !== false;
    const force = Boolean(options.force);
    const cached = cache.getWithMeta(BOOTSTRAP_CACHE_KEY);
    const hasMemory = bootstrapMemory && !force;
    const hasCache = preferCache && cached.exists && !force;

    if (hasMemory) {
      this.renderHome(bootstrapMemory, { refreshing: cached.expired });
      if (!cached.expired && Date.now() - lastRefreshAt < BOOTSTRAP_TTL) return Promise.resolve();
      return this.refreshHome({ silent: true });
    }

    if (hasCache) {
      bootstrapMemory = cached.data;
      this.renderHome(cached.data, { refreshing: cached.expired });
      return this.refreshHome({ silent: true });
    }

    this.setData({ loading: true, refreshing: false, error: "" });
    return this.refreshHome({ silent: false });
  },

  async refreshHome(options = {}) {
    if (refreshPromise) return refreshPromise;
    if (options.silent) {
      this.setData({ refreshing: true, error: "" });
    }
    refreshPromise = api.get("/api/public/bootstrap")
      .then((data) => {
        lastRefreshAt = Date.now();
        const publicData = cache.publicBootstrapData(data);
        const changed = !cache.sameData(bootstrapMemory, publicData);
        bootstrapMemory = publicData;
        cache.set(BOOTSTRAP_CACHE_KEY, publicData, BOOTSTRAP_TTL);
        if (changed || this.data.loading || !this.data.activities.length) {
          this.renderHome(data);
        } else {
          this.setData({ refreshing: false, loading: false, error: "" });
        }
        return data;
      })
      .catch((error) => {
        const fallback = bootstrapMemory || cache.get(BOOTSTRAP_CACHE_KEY, { allowExpired: true });
        if (fallback) {
          bootstrapMemory = fallback;
          this.renderHome(fallback);
          return fallback;
        }
        this.setData({
          error: error.message || "活动读取失败",
          loading: false,
          refreshing: false
        });
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
    try {
      return await refreshPromise;
    } catch (error) {
      return null;
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

  goActivities() {
    wx.switchTab({ url: "/pages/activities/activities" });
  },

  goEditor() {
    wx.navigateTo({ url: "/pages/activity-editor/activity-editor" });
  },

  goRoomLogs() {
    wx.navigateTo({ url: "/pages/room-logs/room-logs" });
  },

  goRoomLogManage() {
    wx.navigateTo({ url: "/pages/room-log-manage/room-log-manage" });
  },

  goMe() {
    wx.switchTab({ url: "/pages/me/me" });
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
      cache.invalidatePublicActivities(activity.id);
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
  },

  onShareAppMessage(event = {}) {
    if ((event.target?.dataset || {}).shareType === "room") {
      return share.roomLogShare(this.data.roomStatus);
    }
    return share.activityShareFromEvent(event) || share.defaultShare("/pages/home/home");
  },

  onShareTimeline() {
    return share.defaultTimeline();
  }
});
