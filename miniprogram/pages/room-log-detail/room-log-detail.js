const api = require("../../utils/api");
const cache = require("../../utils/cache");
const { toRoomLogView } = require("../../utils/format");

Page({
  data: {
    id: "",
    loading: true,
    error: "",
    roomLog: null,
    actionLoading: false
  },

  onLoad(options = {}) {
    this.setData({ id: options.id || "" });
    this.loadRoomLog();
  },

  onShow() {
    if (this.loadedOnce) this.loadRoomLog({ silent: true });
    this.loadedOnce = true;
  },

  onPullDownRefresh() {
    this.loadRoomLog({ force: true }).finally(() => wx.stopPullDownRefresh());
  },

  async loadRoomLog(options = {}) {
    if (!this.data.id) {
      this.setData({ loading: false, error: "缺少值班记录 ID" });
      return null;
    }
    if (!options.silent) this.setData({ loading: true, error: "" });
    try {
      const data = await api.get(`/api/room-logs/${encodeURIComponent(this.data.id)}`);
      this.setData({ roomLog: toRoomLogView(data.roomLog || {}), loading: false, error: "" });
      return data;
    } catch (error) {
      this.setData({ loading: false, error: error.message || "值班记录读取失败" });
      return null;
    }
  },

  goEditOpenNote() {
    const log = this.data.roomLog;
    if (!log?.id) return;
    if (!log.canEditOpenNote) {
      wx.showToast({ title: "已关门后不能编辑开门文字", icon: "none" });
      return;
    }
    wx.navigateTo({ url: `/pages/room-log-edit/room-log-edit?id=${encodeURIComponent(log.id)}` });
  },

  goWriteNote() {
    const log = this.data.roomLog;
    if (!log?.id || !log.canWriteNightNote) {
      wx.showToast({ title: "客厅开门后才可以写夜记", icon: "none" });
      return;
    }
    const noteId = log.myNightNote?.id ? `&noteId=${encodeURIComponent(log.myNightNote.id)}` : "";
    wx.navigateTo({ url: `/pages/room-note-edit/room-note-edit?id=${encodeURIComponent(log.id)}${noteId}` });
  },

  async confirmOpen() {
    const log = this.data.roomLog;
    if (!log?.id || this.data.actionLoading) return;
    this.setData({ actionLoading: true });
    wx.showLoading({ title: "确认中..." });
    try {
      await api.post(`/api/room-logs/${encodeURIComponent(log.id)}/open`, {});
      cache.invalidateRoomLogs();
      wx.hideLoading();
      wx.showToast({ title: "客厅已开门", icon: "success" });
      await this.loadRoomLog({ silent: true });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "确认失败", icon: "none" });
    } finally {
      this.setData({ actionLoading: false });
    }
  },

  confirmClose() {
    const log = this.data.roomLog;
    if (!log?.id || this.data.actionLoading) return;
    wx.showModal({
      title: "确认关门",
      content: "确认将这条值班记录标记为已关门吗？夜记可以关门后继续补写。",
      confirmText: "确认关门",
      cancelText: "再想想",
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ actionLoading: true });
        wx.showLoading({ title: "确认中..." });
        try {
          await api.post(`/api/room-logs/${encodeURIComponent(log.id)}/close`, {});
          cache.invalidateRoomLogs();
          wx.hideLoading();
          wx.showToast({ title: "客厅已关门", icon: "success" });
          await this.loadRoomLog({ silent: true });
        } catch (error) {
          wx.hideLoading();
          wx.showToast({ title: error.message || "确认失败", icon: "none" });
        } finally {
          this.setData({ actionLoading: false });
        }
      }
    });
  },

  deleteExpired() {
    const log = this.data.roomLog;
    if (!log?.id || !log.canDeleteExpired || this.data.actionLoading) return;
    wx.showModal({
      title: "删除过期预约",
      content: "这条预约从未确认开门，删除后会从你的值班记录里移除。管理员仍可在后台全量数据中查看。",
      confirmText: "删除",
      confirmColor: "#9f392b",
      cancelText: "再想想",
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ actionLoading: true });
        wx.showLoading({ title: "删除中..." });
        try {
          await api.del(`/api/room-logs/${encodeURIComponent(log.id)}`, {});
          cache.invalidateRoomLogs();
          wx.hideLoading();
          wx.showToast({ title: "已删除", icon: "success" });
          setTimeout(() => wx.navigateBack({ delta: 1 }), 420);
        } catch (error) {
          wx.hideLoading();
          wx.showToast({ title: error.message || "删除失败", icon: "none" });
        } finally {
          this.setData({ actionLoading: false });
        }
      }
    });
  }
});
