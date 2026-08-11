Component({
  properties: {
    activity: {
      type: Object,
      value: {}
    }
  },
  methods: {
    noop() {},

    handleRegisterTap() {
      this.triggerEvent("register", { activity: this.data.activity });
    },

    handleInterestTap() {
      this.triggerEvent("interest", { activity: this.data.activity });
    },

    handleReminderTap() {
      this.triggerEvent("reminder", { activity: this.data.activity });
    },

    handleOpen() {
      const id = this.data.activity && this.data.activity.id;
      if (!id) return;
      wx.navigateTo({
        url: `/pages/activity-detail/activity-detail?id=${encodeURIComponent(id)}`
      });
    }
  }
});
