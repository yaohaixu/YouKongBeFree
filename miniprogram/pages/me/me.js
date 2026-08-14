const api = require("../../utils/api");
const cache = require("../../utils/cache");
const registrationToken = require("../../utils/registration-token");

const ME_TTL = 2 * 60 * 1000;

function meCacheKey() {
  return cache.keys.meSummary(cache.currentIdentityPart());
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function displayTime(value = "") {
  if (!value) return "时间待定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace("T", " ").slice(5, 16);
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function eventTone(type = "") {
  return {
    registration: "green",
    activity: "amber",
    roomLog: "rose",
    roomStatus: "rose",
    roomActivity: "blue"
  }[type] || "neutral";
}

function eventIcon(type = "") {
  return {
    registration: "ticket",
    activity: "activity",
    roomLog: "door",
    roomStatus: "door",
    roomActivity: "activity"
  }[type] || "activity";
}

function eventUrl(event = {}) {
  if (event.type === "registration" && event.activityId) {
    const savedById = event.registrationId ? registrationToken.get(event.registrationId) : {};
    const saved = savedById && savedById.accessToken ? savedById : (registrationToken.findByActivity(event.activityId) || {});
    const registrationQuery = event.registrationId ? `&registration=${encodeURIComponent(event.registrationId)}` : "";
    const tokenQuery = saved && saved.accessToken ? `&token=${encodeURIComponent(saved.accessToken)}` : "";
    return `/pages/registration-success/registration-success?activity=${encodeURIComponent(event.activityId)}${registrationQuery}${tokenQuery}`;
  }
  if ((event.type === "activity" || event.type === "roomActivity") && event.activityId) {
    return `/pages/activity-detail/activity-detail?id=${encodeURIComponent(event.activityId)}`;
  }
  if ((event.type === "roomLog" || event.type === "roomStatus") && event.roomLogId) {
    return `/pages/room-log-detail/room-log-detail?id=${encodeURIComponent(event.roomLogId)}`;
  }
  return "";
}

function normalizeRecentEvents(events = []) {
  return (events || []).slice(0, 6).map((event) => ({
    ...event,
    icon: eventIcon(event.type),
    tone: eventTone(event.type),
    displayTime: displayTime(event.time),
    url: eventUrl(event)
  }));
}

function openPage(url = "") {
  if (!url) return;
  if (["/pages/home/home", "/pages/activities/activities", "/pages/me/me"].includes(url.split("?")[0])) {
    wx.switchTab({ url: url.split("?")[0] });
    return;
  }
  wx.navigateTo({ url });
}

Page({
  data: {
    loading: true,
    error: "",
    refreshing: false,
    profile: null,
    avatarInitial: "有",
    dashboard: { summary: {} },
    registrations: [],
    identitySync: { counts: {} },
    recentEvents: [],
    bottomEntries: []
  },

  onLoad() {
    this.loadMe({ preferCache: true });
  },

  onShow() {
    if (this.loadedOnce) this.loadMe({ force: true, silent: true });
    this.loadedOnce = true;
  },

  onPullDownRefresh() {
    this.loadMe({ force: true }).finally(() => wx.stopPullDownRefresh());
  },

  renderMe(data) {
    const identitySync = data.identitySync || { counts: {} };
    const deviceCount = Number(identitySync.counts?.devices || identitySync.devices?.length || 1);
    this.setData({
      profile: data.profile || {},
      avatarInitial: ((data.profile || {}).displayName || "有").slice(0, 1),
      dashboard: data.dashboard || { summary: {} },
      registrations: data.registrations || [],
      identitySync,
      recentEvents: normalizeRecentEvents(data.recentEvents || []),
      bottomEntries: [
        {
          title: "我的活动",
          text: "管理我发起或共同发起的活动",
          meta: `${Number(data.dashboard?.summary?.total || 0)} 个`,
          icon: "activity",
          tone: "amber",
          url: "/pages/my-activities/my-activities"
        },
        {
          title: "我的报名",
          text: "查看报名成功页和待参加活动",
          meta: `${Number((data.registrations || []).length)} 条近期`,
          icon: "ticket",
          tone: "green",
          url: "/pages/registrations/registrations"
        },
        {
          title: "同步设备",
          text: deviceCount > 1 ? "当前身份已连接多台设备" : "把手机和电脑连成同一身份",
          meta: `${deviceCount} 台设备`,
          icon: "sync",
          tone: "neutral",
          url: "/pages/identity-sync/identity-sync"
        }
      ],
      loading: false,
      refreshing: false,
      error: ""
    });
  },

  async loadMe(options = {}) {
    const key = meCacheKey();
    const cached = cache.getWithMeta(key);
    const force = Boolean(options.force);
    if (options.preferCache !== false && cached.exists && !force) {
      this.renderMe(cached.data);
      if (!cached.expired) return Promise.resolve(cached.data);
      this.setData({ refreshing: true });
      return this.refreshMe(key);
    }

    if (!options.silent) this.setData({ loading: true, refreshing: false, error: "" });
    return this.refreshMe(key);
  },

  async refreshMe(key = meCacheKey()) {
    try {
      const data = await api.get("/api/me/summary");
      cache.set(key, data, ME_TTL);
      this.renderMe(data);
      return data;
    } catch (error) {
      const fallback = cache.get(key, { allowExpired: true });
      if (fallback) {
        this.renderMe(fallback);
        return fallback;
      }
      this.setData({
        error: error.message || "我的页面读取失败",
        loading: false,
        refreshing: false
      });
      return null;
    }
  },

  openEntry(event) {
    const url = event.currentTarget.dataset.url;
    openPage(url);
  },

  openRecent(event) {
    const url = event.currentTarget.dataset.url;
    openPage(url);
  }
});
