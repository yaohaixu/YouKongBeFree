const api = require("../../utils/api");
const { toActivityView } = require("../../utils/format");
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
    activities: []
  },

  onLoad(options = {}) {
    share.enableShareMenu();
    const view = options.view === "history" ? "history" : "upcoming";
    const sourceType = view === "history" ? options.sourceType || "" : "";
    const seriesId = options.seriesId || "";
    this.setData({ view, sourceType, seriesId });
    this.loadActivitySeries();
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
  }
});
