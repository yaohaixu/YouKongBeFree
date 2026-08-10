Component({
  properties: {
    activity: {
      type: Object,
      value: {}
    }
  },
  methods: {
    noop() {},

    handleOpen() {
      const id = this.data.activity && this.data.activity.id;
      if (!id) return;
      wx.navigateTo({
        url: `/pages/activity-detail/activity-detail?id=${encodeURIComponent(id)}`
      });
    }
  }
});
