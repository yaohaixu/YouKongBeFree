const api = require("../../utils/api");
const cache = require("../../utils/cache");

const MAX_AVATAR_SIZE = 4 * 1024 * 1024;

function chooseAvatarFile() {
  return new Promise((resolve, reject) => {
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        sizeType: ["compressed"],
        success: (res) => resolve((res.tempFiles || [])[0] || {}),
        fail: reject
      });
      return;
    }
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => resolve({ tempFilePath: res.tempFilePaths[0], size: 0 }),
      fail: reject
    });
  });
}

Page({
  data: {
    loading: true,
    saving: false,
    error: "",
    profile: {},
    avatarTempFilePath: "",
    avatarChanged: false,
    avatarInitial: "有",
    form: {
      displayName: "",
      bio: ""
    }
  },

  onLoad() {
    this.loadProfile();
  },

  onPullDownRefresh() {
    this.loadProfile().finally(() => wx.stopPullDownRefresh());
  },

  async loadProfile() {
    this.setData({ loading: true, error: "" });
    try {
      const data = await api.get("/api/profile/me");
      const profile = data.profile || {};
      this.setData({
        profile,
        avatarTempFilePath: profile.avatarUrl || "",
        avatarChanged: false,
        avatarInitial: (profile.displayName || "有").slice(0, 1),
        "form.displayName": profile.displayName || "",
        "form.bio": profile.bio || "",
        loading: false
      });
    } catch (error) {
      this.setData({
        error: error.message || "公开资料读取失败",
        loading: false
      });
    }
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    const value = event.detail.value || "";
    this.setData({
      [`form.${field}`]: value,
      ...(field === "displayName" ? { avatarInitial: (value || "有").slice(0, 1) } : {})
    });
  },

  chooseAvatar() {
    chooseAvatarFile().then((file) => {
      if (!file.tempFilePath) return;
      if (Number(file.size || 0) > MAX_AVATAR_SIZE) {
        wx.showToast({ title: "头像需小于 4MB", icon: "none" });
        return;
      }
      this.setData({ avatarTempFilePath: file.tempFilePath, avatarChanged: true });
    }).catch(() => {});
  },

  async saveProfile() {
    if (this.data.saving) return;
    const displayName = String(this.data.form.displayName || "").trim();
    const bio = String(this.data.form.bio || "").trim();
    if (!displayName) {
      wx.showToast({ title: "请填写昵称", icon: "none" });
      return;
    }
    this.setData({ saving: true });
    wx.showLoading({ title: "保存中..." });
    try {
      const payload = { displayName, bio };
      const data = this.data.avatarChanged && this.data.avatarTempFilePath
        ? await api.upload("/api/profile/me", this.data.avatarTempFilePath, payload, { name: "avatar" })
        : await api.put("/api/profile/me", payload);
      cache.removeByPrefix(cache.keys.userPrefix(cache.currentIdentityPart()));
      wx.hideLoading();
      wx.showToast({ title: "已保存", icon: "success" });
      this.setData({
        profile: data.profile || {},
        avatarTempFilePath: data.profile && data.profile.avatarUrl ? data.profile.avatarUrl : this.data.avatarTempFilePath,
        avatarChanged: false,
        saving: false
      });
      setTimeout(() => wx.navigateBack({ delta: 1 }), 520);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
      this.setData({ saving: false });
    }
  }
});
