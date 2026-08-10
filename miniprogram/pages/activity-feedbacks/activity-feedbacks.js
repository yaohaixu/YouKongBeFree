const api = require("../../utils/api");
const { formatActivityTime, formatDateTime } = require("../../utils/format");
const shareImage = require("../../utils/share-image");
const share = require("../../utils/share");

const FEEDBACK_FILTERS = [
  { key: "all", label: "全部" },
  { key: "approved", label: "已展示" },
  { key: "admin_review", label: "待审核" },
  { key: "rejected", label: "不展示" },
];

function decorateFeedback(item = {}) {
  const statusKey = item.status || "admin_review";
  const canRestore = statusKey === "rejected" && item.ownerHiddenPreviousStatus === "approved";
  const canHide = statusKey === "approved" || statusKey === "admin_review";
  return {
    ...item,
    displayCreatedAt: formatDateTime(item.createdAt),
    statusLabel: item.statusLabel || item.status || "反馈",
    statusKey,
    feedbackWeight: Number(item.feedbackWeight || 0),
    reviewAction: canRestore ? "approve" : canHide ? "reject" : "",
    reviewActionText: canRestore ? "恢复展示" : statusKey === "approved" ? "隐藏" : statusKey === "admin_review" ? "不展示" : "",
    reviewActionDanger: canHide,
  };
}

function feedbackLineText(item = {}, index = 0) {
  return [
    `${index + 1}. ${item.statusLabel || "反馈"} · 权重 ${Number(item.feedbackWeight || 0)} · ${item.displayCreatedAt || "刚刚"}`,
    item.favorite ? `最喜欢：${item.favorite}` : "",
    item.improvement ? `可以改进：${item.improvement}` : "",
    item.other ? `还想说：${item.other}` : "",
    item.aiReason ? `AI：${item.aiReason}` : "",
  ].filter(Boolean).join("\n");
}

function feedbackExportText(activity = {}, feedbacks = []) {
  const lines = [
    `活动反馈：${activity.title || "未命名活动"}`,
    `时间：${activity.displayTime || "时间待定"}`,
    `地点：${activity.location || "地点待定"}`,
    `反馈数：${feedbacks.length}`,
    "",
  ];
  if (!feedbacks.length) {
    lines.push("暂无反馈");
  } else {
    feedbacks.forEach((item, index) => {
      lines.push(feedbackLineText(item, index), "");
    });
  }
  return lines.join("\n").trim();
}

function feedbackState(feedbacks = [], activeFilter = "all", total = 0) {
  const counts = feedbacks.reduce((map, item) => {
    const key = item.statusKey || item.status || "admin_review";
    map[key] = Number(map[key] || 0) + 1;
    return map;
  }, {});
  const visibleFeedbacks = activeFilter === "all"
    ? feedbacks
    : feedbacks.filter((item) => (item.statusKey || item.status) === activeFilter);
  const filterTabs = FEEDBACK_FILTERS.map((item) => ({
    ...item,
    count: item.key === "all" ? Math.max(Number(total || 0), feedbacks.length) : Number(counts[item.key] || 0),
  }));
  return {
    filterTabs,
    visibleFeedbacks,
    statusCounts: counts,
  };
}

Page({
  data: {
    id: "",
    loading: true,
    loadingMore: false,
    qrLoading: false,
    error: "",
    page: 1,
    pageSize: 10,
    hasMore: true,
    activity: {},
    recap: null,
    feedbacks: [],
    visibleFeedbacks: [],
    filterTabs: FEEDBACK_FILTERS.map((item) => ({ ...item, count: 0 })),
    statusFilter: "all",
    statusCounts: {},
    totalFeedbackCount: 0,
    exporting: false,
    reviewLoadingId: "",
    shareCanvasWidth: 900,
    shareCanvasHeight: 1180,
  },

  onLoad(options = {}) {
    share.enableShareMenu();
    this.setData({ id: options.id || "" });
    this.loadFeedbacks({ reset: true });
  },

  onPullDownRefresh() {
    this.loadFeedbacks({ reset: true }).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.loadFeedbacks({ reset: false });
  },

  async loadFeedbacks(options = {}) {
    if (!this.data.id) {
      this.setData({ loading: false, error: "缺少活动 ID" });
      return;
    }
    const reset = options.reset !== false;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true, error: "" } : { loadingMore: true, error: "" });
    try {
      const [data, recapData] = await Promise.all([
        api.get(`/api/activities/${encodeURIComponent(this.data.id)}/feedbacks?manage=true&page=${page}&pageSize=${this.data.pageSize}`),
        reset ? api.get(`/api/activities/${encodeURIComponent(this.data.id)}/recap`).catch(() => null) : Promise.resolve(this.data.recap)
      ]);
      const activity = data.activity || this.data.activity || {};
      activity.displayTime = formatActivityTime(activity.startsAt, activity.endsAt);
      const nextRows = (data.feedbacks || []).map(decorateFeedback);
      const pageInfo = data.pageInfo || {};
      const feedbacks = reset ? nextRows : this.data.feedbacks.concat(nextRows);
      const totalFeedbackCount = Number(pageInfo.total || feedbacks.length);
      const state = feedbackState(feedbacks, this.data.statusFilter, totalFeedbackCount);
      this.setData({
        page,
        activity,
        recap: recapData || this.data.recap,
        feedbacks,
        visibleFeedbacks: state.visibleFeedbacks,
        filterTabs: state.filterTabs,
        statusCounts: state.statusCounts,
        totalFeedbackCount,
        hasMore: Boolean(pageInfo.hasMore),
        loading: false,
        loadingMore: false,
      });
    } catch (error) {
      this.setData({
        error: error.message || "活动反馈读取失败",
        loading: false,
        loadingMore: false,
      });
    }
  },

  switchStatus(event) {
    const statusFilter = event.currentTarget.dataset.status || "all";
    if (statusFilter === this.data.statusFilter) return;
    const state = feedbackState(this.data.feedbacks, statusFilter, this.data.totalFeedbackCount);
    this.setData({
      statusFilter,
      visibleFeedbacks: state.visibleFeedbacks,
      filterTabs: state.filterTabs,
      statusCounts: state.statusCounts,
    });
  },

  async loadAllFeedbacksForExport() {
    const all = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 20) {
      const data = await api.get(`/api/activities/${encodeURIComponent(this.data.id)}/feedbacks?manage=true&page=${page}&pageSize=100`);
      all.push(...(data.feedbacks || []).map(decorateFeedback));
      hasMore = Boolean(data.pageInfo && data.pageInfo.hasMore);
      page += 1;
    }
    return all;
  },

  async copyFeedbacksText() {
    if (!this.data.id || this.data.exporting) return;
    this.setData({ exporting: true });
    wx.showLoading({ title: "整理反馈..." });
    try {
      const feedbacks = await this.loadAllFeedbacksForExport();
      wx.hideLoading();
      wx.setClipboardData({
        data: feedbackExportText(this.data.activity || {}, feedbacks),
        success: () => wx.showToast({ title: "已复制反馈", icon: "success" }),
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "复制失败", icon: "none" });
    } finally {
      this.setData({ exporting: false });
    }
  },

  reviewFeedback(event) {
    const feedbackId = event.currentTarget.dataset.id;
    const action = event.currentTarget.dataset.action;
    const label = event.currentTarget.dataset.label || "处理";
    if (!feedbackId || !action || this.data.reviewLoadingId) return;
    wx.showModal({
      title: "处理活动反馈",
      content: `确认${label}这条反馈吗？`,
      confirmText: label,
      cancelText: "再想想",
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ reviewLoadingId: feedbackId });
        wx.showLoading({ title: "处理中..." });
        try {
          const data = await api.post(`/api/activities/${encodeURIComponent(this.data.id)}/feedbacks/${encodeURIComponent(feedbackId)}/review`, { action });
          const updated = decorateFeedback(data.feedback || {});
          const feedbacks = this.data.feedbacks.map((item) => item.id === feedbackId ? { ...item, ...updated } : item);
          const state = feedbackState(feedbacks, this.data.statusFilter, this.data.totalFeedbackCount);
          wx.hideLoading();
          wx.showToast({ title: "已保存", icon: "success" });
          this.setData({
            feedbacks,
            visibleFeedbacks: state.visibleFeedbacks,
            filterTabs: state.filterTabs,
            statusCounts: state.statusCounts,
            reviewLoadingId: "",
          });
        } catch (error) {
          wx.hideLoading();
          this.setData({ reviewLoadingId: "" });
          wx.showToast({ title: error.message || "处理失败", icon: "none" });
        }
      },
    });
  },

  openActivity() {
    if (!this.data.id) return;
    wx.navigateTo({ url: `/pages/activity-detail/activity-detail?id=${encodeURIComponent(this.data.id)}` });
  },

  async downloadFeedbackQr() {
    if (!this.data.id || this.data.qrLoading) return;
    this.setData({ qrLoading: true });
    wx.showLoading({ title: "生成反馈码..." });
    try {
      const filePath = await shareImage.generateQrCard(this, {
        text: shareImage.feedbackUrl(this.data.id),
        eyebrow: "活动反馈二维码",
        title: this.data.activity.title || "有空活动",
        subtitle: "活动结束后，扫码填写匿名反馈。",
        label: "扫码填写反馈",
      });
      wx.hideLoading();
      await shareImage.saveOrPreview(filePath);
      wx.showToast({ title: "已保存到相册", icon: "success" });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "二维码生成失败", icon: "none" });
    } finally {
      this.setData({ qrLoading: false });
    }
  },

  onShareAppMessage() {
    return share.activityShare({ ...this.data.activity, id: this.data.id });
  },

  onShareTimeline() {
    return {
      title: this.data.activity.title || "有空客厅活动",
      query: `id=${encodeURIComponent(this.data.id || "")}`,
    };
  },
});
