const api = require("../../utils/api");
const cache = require("../../utils/cache");

const IDENTITY_SYNC_TTL = 2 * 60 * 1000;

function identitySyncCacheKey() {
  return cache.keys.identitySync(cache.currentIdentityPart());
}

function shortId(value = "") {
  const text = String(value || "");
  if (!text) return "-";
  if (text.length <= 12) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function extractToken(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/[?&]token=([^&#]+)/);
  if (match) return decodeURIComponent(match[1]);
  return text.replace(/^token:/i, "");
}

function countsList(counts = {}) {
  return [
    { label: "活动", value: Number(counts.activities || 0) },
    { label: "报名", value: Number(counts.registrations || 0) },
    { label: "反馈", value: Number(counts.feedbacks || 0) },
    { label: "感兴趣", value: Number(counts.interests || 0) },
    { label: "举报", value: Number(counts.reports || 0) }
  ];
}

function displayDateTime(value = "") {
  if (!value) return "已绑定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "已绑定";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeIdentitySync(identitySync = {}) {
  const network = identitySync.network || {};
  const externalBindings = (identitySync.externalBindings || []).map((item) => ({
    ...item,
    displayBoundAt: displayDateTime(item.boundAt)
  }));
  const hasWechatBinding = externalBindings.some((item) => item.provider === "wechat_miniprogram");
  const displayCommunityId = network.communityId || shortId(network.id);
  return {
    ...identitySync,
    externalBindings,
    hasWechatBinding,
    devices: identitySync.devices || [],
    displayCommunityId,
    displayNetworkText: identitySync.hasNetwork
      ? `Community ID：${displayCommunityId}`
      : "开启后可以生成同步链接，给另一台设备扫码或粘贴。",
    wechatText: hasWechatBinding
      ? "已绑定微信小程序身份。换设备时再次绑定微信，可自动回到同一个身份网络。"
      : "可选绑定。微信只作为找回和同步身份的锚点，不影响匿名发起活动。"
  };
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    if (!wx.login) {
      reject(new Error("当前微信版本不支持登录接口"));
      return;
    }
    wx.login({
      timeout: 10000,
      success: (res) => {
        if (res.code) {
          resolve(res.code);
          return;
        }
        reject(new Error("微信登录没有返回 code"));
      },
      fail: (error) => reject(new Error(error.errMsg || "微信登录失败"))
    });
  });
}

Page({
  data: {
    loading: true,
    syncing: false,
    error: "",
    refreshing: false,
    identitySync: {},
    counts: {},
    countItems: [],
    invite: null,
    inviteToken: "",
    preview: null,
    profileSource: "target",
    wechatBinding: false
  },

  onLoad(options = {}) {
    const token = extractToken(options.token || "");
    this.setData({ inviteToken: token });
    this.loadIdentitySync({ preferCache: true }).then(() => {
      if (token) this.loadInvitePreview(token);
    });
  },

  onPullDownRefresh() {
    this.loadIdentitySync({ force: true }).finally(() => wx.stopPullDownRefresh());
  },

  renderIdentitySync(data = {}) {
    this.setData({
      identitySync: normalizeIdentitySync(data.identitySync || {}),
      counts: data.counts || {},
      countItems: countsList(data.counts || {}),
      loading: false,
      refreshing: false,
      error: ""
    });
  },

  async loadIdentitySync(options = {}) {
    const key = identitySyncCacheKey();
    const cached = cache.getWithMeta(key);
    const force = Boolean(options.force);
    if (options.preferCache !== false && cached.exists && !force) {
      this.renderIdentitySync(cached.data);
      if (!cached.expired) return Promise.resolve(cached.data);
      this.setData({ refreshing: true });
      return this.refreshIdentitySync(key);
    }

    this.setData({ loading: true, refreshing: false, error: "" });
    return this.refreshIdentitySync(key);
  },

  async refreshIdentitySync(key = identitySyncCacheKey()) {
    try {
      const data = await api.get("/api/identity-sync/me");
      cache.set(key, data, IDENTITY_SYNC_TTL);
      this.renderIdentitySync(data);
      return data;
    } catch (error) {
      const fallback = cache.get(key, { allowExpired: true });
      if (fallback) {
        this.renderIdentitySync(fallback);
        return fallback;
      }
      this.setData({
        error: error.message || "身份网络读取失败",
        loading: false,
        refreshing: false
      });
      return null;
    }
  },

  async createNetwork() {
    if (this.data.syncing) return;
    this.setData({ syncing: true });
    wx.showLoading({ title: "开启同步..." });
    try {
      const data = await api.post("/api/identity-sync/create", {});
      cache.removeByPrefix(cache.keys.userPrefix(cache.currentIdentityPart()));
      wx.hideLoading();
      wx.showToast({ title: "已开启", icon: "success" });
      this.setData({
        identitySync: normalizeIdentitySync(data.identitySync || {}),
        counts: data.counts || {},
        countItems: countsList(data.counts || {}),
        syncing: false
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "开启失败", icon: "none" });
      this.setData({ syncing: false });
    }
  },

  async createInvite() {
    if (this.data.syncing) return;
    this.setData({ syncing: true });
    wx.showLoading({ title: "生成中..." });
    try {
      const data = await api.post("/api/identity-sync/invites", {});
      wx.hideLoading();
      this.setData({
        invite: data.invite || null,
        identitySync: normalizeIdentitySync(data.identitySync || this.data.identitySync),
        syncing: false
      });
      wx.showToast({ title: "同步链接已生成", icon: "success" });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "生成失败", icon: "none" });
      this.setData({ syncing: false });
    }
  },

  copyInvite() {
    const url = this.data.invite && this.data.invite.url;
    if (!url) return;
    wx.setClipboardData({ data: url });
  },

  async bindWechat() {
    if (this.data.syncing || this.data.wechatBinding) return;
    this.setData({ wechatBinding: true });
    wx.showLoading({ title: "绑定微信..." });
    try {
      const code = await wxLogin();
      const data = await api.post("/api/identity-sync/wechat/bind", { code, label: "微信小程序" });
      cache.removeByPrefix(cache.keys.userPrefix(cache.currentIdentityPart()));
      wx.hideLoading();
      wx.showToast({ title: data.merged ? "已同步身份" : "已绑定微信", icon: "success" });
      this.setData({
        identitySync: normalizeIdentitySync(data.identitySync || {}),
        counts: data.counts || this.data.counts || {},
        countItems: countsList(data.counts || this.data.counts || {}),
        wechatBinding: false
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "微信绑定失败", icon: "none" });
      this.setData({ wechatBinding: false });
    }
  },

  handleTokenInput(event) {
    this.setData({ inviteToken: event.detail.value || "" });
  },

  scanInvite() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        const token = extractToken(res.result || "");
        if (!token) {
          wx.showToast({ title: "没有识别到同步令牌", icon: "none" });
          return;
        }
        this.setData({ inviteToken: token });
        this.loadInvitePreview(token);
      },
      fail: () => {}
    });
  },

  loadInputPreview() {
    const token = extractToken(this.data.inviteToken);
    if (!token) {
      wx.showToast({ title: "请粘贴同步链接或令牌", icon: "none" });
      return;
    }
    this.setData({ inviteToken: token });
    this.loadInvitePreview(token);
  },

  async loadInvitePreview(token) {
    if (this.data.syncing) return;
    this.setData({ syncing: true, preview: null });
    wx.showLoading({ title: "读取邀请..." });
    try {
      const data = await api.get(`/api/identity-sync/invites/${encodeURIComponent(token)}`);
      wx.hideLoading();
      if (data.alreadyJoined) {
        wx.showToast({ title: "已经同步过", icon: "success" });
        this.setData({ syncing: false });
        return;
      }
      this.setData({
        preview: {
          ...data.preview,
          targetCountItems: countsList(data.preview?.target?.counts || {}),
          sourceCountItems: countsList(data.preview?.source?.counts || {}),
          mergedCountItems: countsList(data.preview?.merged?.counts || {})
        },
        syncing: false
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || "邀请不可用", icon: "none" });
      this.setData({ syncing: false });
    }
  },

  chooseProfileSource(event) {
    this.setData({ profileSource: event.currentTarget.dataset.value || "target" });
  },

  acceptInvite() {
    const token = extractToken(this.data.inviteToken);
    if (!token) return;
    wx.showModal({
      title: "同步设备",
      content: "确认把当前设备合并到这个身份网络吗？历史活动、报名和反馈都会保留。",
      confirmText: "确认同步",
      cancelText: "再想想",
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ syncing: true });
        wx.showLoading({ title: "同步中..." });
        try {
          const data = await api.post(`/api/identity-sync/invites/${encodeURIComponent(token)}/accept`, {
            profileSource: this.data.profileSource
          });
          cache.removeByPrefix(cache.keys.userPrefix(cache.currentIdentityPart()));
          wx.hideLoading();
          wx.showToast({ title: data.alreadyJoined ? "已同步过" : "同步完成", icon: "success" });
          this.setData({
            inviteToken: "",
            preview: null,
            syncing: false
          });
          this.loadIdentitySync();
        } catch (error) {
          wx.hideLoading();
          wx.showToast({ title: error.message || "同步失败", icon: "none" });
          this.setData({ syncing: false });
        }
      }
    });
  }
});
