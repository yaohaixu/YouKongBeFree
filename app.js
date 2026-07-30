const CLIENT_ID_KEY = "yk_client_id";
const ACTIVITY_TOKEN_KEY = "yk_activity_tokens";
const ACTIVITY_INTEREST_KEY = "yk_activity_interests";
const REGISTRATION_TOKEN_KEY = "yk_registration_tokens";

function randomToken() {
  const webCrypto = window.crypto || window.msCrypto;
  if (webCrypto?.randomUUID) return webCrypto.randomUUID().replaceAll("-", "");
  const bytes = new Uint8Array(16);
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getClientId() {
  let value = localStorage.getItem(CLIENT_ID_KEY);
  if (!value) {
    value = `client_${randomToken()}`;
    localStorage.setItem(CLIENT_ID_KEY, value);
  }
  return value;
}

function simpleHash(value = "") {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function getFingerprint() {
  const parts = [
    navigator.userAgent || "",
    navigator.language || "",
    `${screen.width || 0}x${screen.height || 0}x${screen.colorDepth || 0}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  ];
  return `fp_${simpleHash(parts.join("|"))}`;
}

function readActivityTokens() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_TOKEN_KEY) || "{}");
  } catch {
    return {};
  }
}

function readActivityInterests() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_INTEREST_KEY) || "{}");
  } catch {
    return {};
  }
}

function readRegistrationTokens() {
  try {
    return JSON.parse(localStorage.getItem(REGISTRATION_TOKEN_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveRegistrationToken(activityId, registrationId, token) {
  if (!activityId || !registrationId || !token) return;
  const tokens = readRegistrationTokens();
  tokens[`${activityId}:${registrationId}`] = token;
  localStorage.setItem(REGISTRATION_TOKEN_KEY, JSON.stringify(tokens));
}

function registrationTokenFor(activityId, registrationId) {
  return readRegistrationTokens()[`${activityId}:${registrationId}`] || "";
}

function rememberActivityInterest(activityId) {
  if (!activityId) return;
  const interests = readActivityInterests();
  interests[activityId] = true;
  localStorage.setItem(ACTIVITY_INTEREST_KEY, JSON.stringify(interests));
}

function hasActivityInterest(activity) {
  if (!activity?.id) return false;
  return Boolean(activity.interestedByMe || readActivityInterests()[activity.id]);
}

function writeActivityTokens(tokens = {}) {
  localStorage.setItem(ACTIVITY_TOKEN_KEY, JSON.stringify(tokens));
}

function saveActivityManageToken(activityId, token) {
  if (!activityId || !token) return;
  const tokens = readActivityTokens();
  tokens[activityId] = token;
  writeActivityTokens(tokens);
}

function activityIdFromApiPath(path = "") {
  const match = String(path).match(/\/api\/activities\/([^/?]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function manageTokenForPath(path = "") {
  const activityId = activityIdFromApiPath(path);
  return activityId ? readActivityTokens()[activityId] || "" : "";
}

const api = {
  baseUrl: location.hostname.endsWith("tcloudbaseapp.com")
    ? "https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com"
    : "",
  async request(path, options = {}) {
    const token = localStorage.getItem("yk_session_token");
    const method = String(options.method || "GET").toUpperCase();
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-YK-Client-Id": getClientId(),
      "X-YK-Fingerprint": getFingerprint(),
      ...(manageTokenForPath(path) ? { "X-YK-Manage-Token": manageTokenForPath(path) } : {}),
      ...(!["GET", "HEAD", "OPTIONS"].includes(method) ? { "X-Requested-With": "XMLHttpRequest" } : {}),
      ...(options.headers || {}),
    };
    let response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        credentials: "include",
        ...options,
        headers,
      });
    } catch {
      throw new Error("没有连接到有空后台服务。请用 http://127.0.0.1:8080/login.html 打开页面，不要直接双击 HTML 文件。");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "操作失败，请稍后再试");
    }
    if (data.manageToken && data.activity?.id) {
      saveActivityManageToken(data.activity.id, data.manageToken);
    }
    return data;
  },
  get(path) {
    return this.request(path);
  },
  post(path, body) {
    const isForm = body instanceof FormData;
    return this.request(path, {
      method: "POST",
      headers: isForm ? undefined : { "Content-Type": "application/json" },
      body: isForm ? body : JSON.stringify(body),
    });
  },
  put(path, body) {
    const isForm = body instanceof FormData;
    return this.request(path, {
      method: "PUT",
      headers: isForm ? undefined : { "Content-Type": "application/json" },
      body: isForm ? body : JSON.stringify(body),
    });
  },
  delete(path) {
    return this.request(path, { method: "DELETE" });
  },
};

let mePageState = {
  user: null,
  modules: [],
  collaborators: [],
  editingActivity: null,
  editingTemplate: null,
  editingRole: null,
  richEditor: null,
  submitIntent: "submit",
  pageSize: 12,
  myActivityPage: 1,
  adminActivityPage: 1,
  userPage: 1,
  modulePage: 1,
  templatePage: 1,
  logPage: 1,
  reportPage: 1,
  publicActivityPage: 1,
  trustPolicyPage: 1,
  badgePage: 1,
  badgePolicyPage: 1,
  myActivities: [],
  adminActivities: [],
  publicActivities: [],
  users: [],
  roles: [],
  permissionModules: [],
  permissionActions: [],
  modulesPageItems: [],
  templates: [],
  logs: [],
  reports: [],
  safetyRules: [],
  trustProfiles: [],
  trustPolicies: [],
  badges: [],
  badgePolicies: [],
  aiModels: [],
  aiPrompts: [],
  aiUsage: null,
  friends: [],
  feedbacks: [],
  activityFeedbacks: [],
  myRegistrations: [],
  myFeedbacks: [],
  friendPage: 1,
  feedbackPage: 1,
  activityFeedbackPage: 1,
  myRegistrationPage: 1,
  myFeedbackPage: 1,
  editingFriend: null,
};

const actionLabels = {
  approve: "通过",
  reject: "拒绝",
  return: "退回",
  withdraw: "撤回",
  "activity.cancel": "取消活动",
  "activity.end": "结束活动",
};

const logActionOptions = [
  ["", "全部操作"],
  ["login", "登录"],
  ["logout", "退出"],
  ["user.create", "新增协作员"],
  ["user.update", "保存协作员"],
  ["user.delete", "删除协作员"],
  ["module.create", "新增模块"],
  ["module.update", "保存模块"],
  ["module.delete", "删除模块"],
  ["friend.create", "新增客厅朋友"],
  ["friend.update", "保存客厅朋友"],
  ["friend.delete", "删除客厅朋友"],
  ["template.create", "新增模板"],
  ["template.update", "保存模板"],
  ["template.delete", "删除模板"],
  ["activity.create_draft", "保存活动草稿"],
  ["activity.create_submit", "提交活动审核"],
  ["activity.update_draft", "保存活动草稿"],
  ["activity.update_submit", "重新提交活动审核"],
  ["activity.analysis.pending", "活动安全分析中"],
  ["activity.analysis.complete", "活动安全分析完成"],
  ["activity.analysis.failed", "活动安全分析失败"],
  ["activity.withdraw", "撤回活动"],
  ["activity.review.approve", "审核通过"],
  ["activity.review.return", "审核退回"],
  ["activity.review.reject", "审核拒绝"],
  ["activity.cancel", "取消活动"],
  ["activity.not_formed_cancel", "未成团取消"],
  ["activity.end", "结束活动"],
  ["activity.auto_end", "自动结束活动"],
  ["registration.create", "新增报名"],
  ["registration.delete", "删除报名"],
  ["registration.cancel", "取消报名"],
  ["activity.feedback.create", "提交活动反馈"],
  ["activity.feedback.review", "审核活动反馈"],
  ["activity.feedback.export", "导出活动反馈"],
  ["ai.model.create", "新增 AI 模型"],
  ["ai.model.update", "保存 AI 模型"],
  ["ai.model.delete", "删除 AI 模型"],
  ["ai.model.test", "测试 AI 模型"],
  ["ai.settings.update", "保存 AI 设置"],
  ["ai.connection.test", "测试 AI 连接"],
  ["ai.prompt.create", "新增 Prompt"],
  ["ai.prompt.update", "保存 Prompt"],
  ["ai.prompt.delete", "删除 Prompt"],
  ["ai.prompt.activate", "启用 Prompt"],
  ["activity.report", "社区举报"],
  ["activity.report.review", "举报分析"],
  ["activity.report.substantiated", "举报成立"],
  ["activity.report.unsubstantiated", "举报记录"],
  ["governance.trust_policy.create", "新增信用策略"],
  ["governance.trust_policy.update", "保存信用策略"],
  ["governance.trust_policy.delete", "删除信用策略"],
  ["governance.badge.create", "新增社区徽章"],
  ["governance.badge.update", "保存社区徽章"],
  ["governance.badge.delete", "删除社区徽章"],
  ["governance.badge_policy.update", "保存徽章展示策略"],
];

const statusOptions = [
  ["", "全部状态"],
  ["draft", "草稿"],
  ["analysis_pending", "安全分析中"],
  ["reviewing", "审核中"],
  ["admin_review", "管理员审核"],
  ["collaborator_review", "协作员审核"],
  ["returned", "退回"],
  ["rejected", "拒绝"],
  ["published_group", "已发布"],
  ["published", "活动发布"],
  ["full", "活动人满"],
  ["cancelled", "活动取消"],
  ["not_formed_cancelled", "未成团取消"],
  ["ended", "活动结束"],
];

function feedbackStatusLabel(status = "") {
  return {
    approved: "已展示",
    admin_review: "待管理员审核",
    rejected: "不展示",
  }[status] || status || "待管理员审核";
}

const statusTone = {
  draft: "草稿",
  analysis_pending: "分析中",
  admin_review: "审核中",
  collaborator_review: "审核中",
  returned: "退回",
  rejected: "拒绝",
  published: "发布",
  full: "人满",
  cancelled: "取消",
  not_formed_cancelled: "未成团",
  ended: "结束",
};

function showToast(text = "保存成功") {
  let toast = qs("[data-toast]");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("data-toast", "");
    document.body.append(toast);
  }
  toast.textContent = text;
  addTransientMotion(toast, "motion-confirm", 520);
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

window.addEventListener("youkong-toast", (event) => {
  showToast(event.detail || "操作完成");
});

function revealDynamicContent(root) {
  if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const elements = qsa(
    ".event-card, .event-row, .manage-row, .empty-state, .data-table, .activity-hero, .article-content, .success-card",
    root
  );
  elements.forEach((element, index) => {
    element.classList.add("dynamic-reveal");
    element.style.setProperty("--dynamic-delay", `${Math.min(index, 6) * 36}ms`);
    requestAnimationFrame(() => element.classList.add("is-visible"));
  });
}

function addTransientMotion(element, className = "motion-confirm", duration = 420) {
  if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  clearTimeout(element.motionTimer);
  element.motionTimer = setTimeout(() => element.classList.remove(className), duration);
}

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function setMessage(element, text, type = "muted") {
  if (!element) return;
  element.textContent = text;
  element.dataset.type = type;
  addTransientMotion(element, type === "error" ? "motion-error" : type === "success" ? "motion-confirm" : "motion-update", 520);
}

function userHome(user) {
  if (!user) return "me.html";
  return firstManagedPage(user) || "me.html";
}

function firstManagedPage(user) {
  if (!hasAnyManagedPermission(user)) return "";
  const routes = [
    ["dashboard", "view", "admin.html"],
    ["reviewTasks", "view", "review-tasks.html"],
    ["activities", "view", "admin-activities.html"],
    ["modules", "view", "admin-modules.html"],
    ["templates", "view", "admin-templates.html"],
    ["friends", "view", "admin-friends.html"],
    ["feedbacks", "view", "admin-feedbacks.html"],
    ["reports", "view", "admin-reports.html"],
    ["trust", "view", "admin-trust.html"],
    ["trustPolicy", "view", "admin-trust-policy.html"],
    ["badges", "view", "admin-badges.html"],
    ["badgePolicy", "view", "admin-badge-policy.html"],
    ["safety", "view", "admin-safety.html"],
    ["ai", "view", "admin-ai.html"],
    ["users", "view", "admin-members.html"],
    ["roles", "view", "admin-roles.html"],
    ["logs", "view", "admin-logs.html"],
  ];
  const match = routes.find(([moduleKey, action]) => hasPermission(user, moduleKey, action));
  return match ? match[2] : "";
}

function currentPageName() {
  const file = location.pathname.split("/").pop() || "index.html";
  return file === "" ? "index.html" : file;
}

function formatDate(value) {
  if (!value) return "时间待定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatActivityTime(activity = {}) {
  const start = formatDate(activity.startsAt);
  if (!activity.endsAt) return start;
  const end = formatDate(activity.endsAt);
  return `${start} - ${end}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hasRichMarkup(value = "") {
  return /<(p|h1|h2|h3|ul|ol|li|blockquote|strong|b|em|i|u|a|img|br|hr)(\s|>|\/)/i.test(String(value || ""));
}

function sanitizeRichHtml(value = "") {
  const template = document.createElement("template");
  template.innerHTML = String(value || "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const allowed = new Set(["P", "H1", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE", "STRONG", "B", "EM", "I", "U", "A", "IMG", "BR", "HR"]);
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }
    const href = node.getAttribute("href") || "";
    const source = node.getAttribute("src") || "";
    const alt = node.getAttribute("alt") || "";
    Array.from(node.attributes).forEach((attribute) => node.removeAttribute(attribute.name));
    if (node.tagName === "A") {
      if (/^(https?:|mailto:)/i.test(href) || (href.startsWith("/") && !href.startsWith("//"))) {
        node.setAttribute("href", href);
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    }
    if (node.tagName === "IMG") {
      if (/^(https?:\/\/|\/|data:image\/(png|jpeg|jpg|webp|gif);base64,)/i.test(source)) {
        node.setAttribute("src", source);
        node.setAttribute("alt", alt);
        node.setAttribute("loading", "lazy");
      } else {
        node.remove();
      }
    }
  });
  return template.innerHTML;
}

function descriptionToHtml(value = "") {
  if (hasRichMarkup(value)) return sanitizeRichHtml(value);
  return escapeHtml(value.replaceAll("\\n", "\n"))
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function renderInitiatorContact(activity) {
  if (!activity?.showInitiatorContact || !activity.initiatorContact) return "";
  const contact = escapeHtml(activity.initiatorContact);
  const cleaned = String(activity.initiatorContact || "").replace(/\D/g, "");
  const contactValue = cleaned.length >= 8 ? `<a href="tel:${cleaned}">${contact}</a>` : `<span>${contact}</span>`;
  return `<p class="initiator-contact"><strong>发起人联系方式</strong>${contactValue}</p>`;
}

function renderRiskNotice(activity = {}) {
  const notice = activity.riskNotice || {};
  const notices = [];
  if (notice.text && notice.level !== "none") notices.push({ level: notice.level || "medium", text: notice.text });
  if (activity.reportWarning) {
    notices.push({
      level: "medium",
      text: activity.reportWarningText || "这个活动被多人举报，参与前可以多看一眼活动说明和风险提示。",
    });
  }
  if (!notices.length) return "";
  return `
    ${notices.map((item) => `
      <div class="risk-notice ${escapeHtml(item.level || "medium")}" role="note">
        <strong>社区提示</strong>
        <p>${escapeHtml(item.text)}</p>
      </div>
    `).join("")}
  `;
}

function renderCommunityReportBox(activity = {}) {
  if (!["published", "full", "not_formed_cancelled", "ended"].includes(activity.status)) return "";
  return `
    <details class="report-box">
      <summary>向社区反馈这条活动</summary>
      <form data-report-form>
        <label>反馈原因
          <select name="reason" required>
            <option value="">请选择</option>
            <option value="广告营销">广告营销</option>
            <option value="虚假活动">虚假活动</option>
            <option value="违法违规">违法违规</option>
            <option value="人身攻击">人身攻击</option>
            <option value="其他">其他</option>
          </select>
        </label>
        <label>补充说明（可选）
          <textarea name="detail" maxlength="500" placeholder="可以简单说说你看到的问题"></textarea>
        </label>
        <button class="button outline" type="submit">提交反馈</button>
        <p class="form-message" data-report-message></p>
      </form>
    </details>
  `;
}

function renderActivityFormationPanel(activity = {}) {
  if (!activity.minRegistrationEnabled || !Number(activity.minRegistrationCount || 0)) return "";
  const deadline = activity.registrationDeadline ? formatDate(activity.registrationDeadline) : "活动开始前";
  return `
    <div class="formation-panel">
      <strong>最低 ${Number(activity.minRegistrationCount || 0)} 人成团</strong>
      <p>当前 ${Number(activity.registrationCount || 0)} 人报名 · 最后报名日期 ${escapeHtml(deadline)}</p>
    </div>
  `;
}

function renderPublicRegistrationNames(activity = {}) {
  const registrations = Array.isArray(activity.publicRegistrations) ? activity.publicRegistrations : [];
  if (!activity.showRegistrationNames || !registrations.length) return "";
  return `
    <section class="section tight public-registration-section">
      <div class="wrap">
        <p class="section-kicker">已报名的朋友</p>
        <div class="name-wall">
          ${registrations.map((item) => `<span>${escapeHtml(item.nickname)}</span>`).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderPublicFeedbacks(activity = {}) {
  const feedbacks = Array.isArray(activity.publicFeedbacks) ? activity.publicFeedbacks : [];
  if (activity.showFeedbacks === false || !feedbacks.length) return "";
  return `
    <section class="section tight public-feedback-section">
      <div class="wrap">
        <div class="section-head compact-head">
          <div>
            <p class="section-kicker">活动反馈</p>
            <h2>活动之后留下的话。</h2>
          </div>
          <a class="button ghost" href="feedback.html?id=${encodeURIComponent(activity.id)}">写匿名反馈</a>
        </div>
        <div class="feedback-highlight-grid">
          ${feedbacks.map((feedback) => `
            <article class="feedback-card">
              ${feedback.favorite ? `<p><strong>最喜欢：</strong>${escapeHtml(feedback.favorite)}</p>` : ""}
              ${feedback.improvement ? `<p><strong>可以改进：</strong>${escapeHtml(feedback.improvement)}</p>` : ""}
              ${feedback.other ? `<p><strong>还想说：</strong>${escapeHtml(feedback.other)}</p>` : ""}
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function registrationClosedText(activity = {}) {
  if (activity.status === "full") return "这个活动名额已经满了。";
  if (activity.status === "not_formed_cancelled") return "这个活动没有达到最低报名人数，已自动取消。";
  if (activity.status === "ended") return "这个活动已经结束。";
  if (activity.registrationDeadlinePassed) return "这个活动报名已经截止。";
  return `这个活动当前是「${escapeHtml(activity.statusLabel)}」状态，公开发布后才可以报名。`;
}

function hasMeaningfulRichText(value = "") {
  return String(value || "")
    .replace(/<img\b[^>]*>/gi, "x")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim().length > 0;
}

function hasRole(user, role) {
  return Array.isArray(user?.roles) ? user.roles.includes(role) : user?.role === role;
}

function hasPermission(user, moduleKey, action = "view") {
  if (hasRole(user, "admin")) return true;
  const permissions = user?.permissions || {};
  return Array.isArray(permissions[moduleKey]) && permissions[moduleKey].includes(action);
}

function hasAnyManagedPermission(user) {
  if (hasRole(user, "admin")) return true;
  return Object.values(user?.permissions || {}).some((actions) => Array.isArray(actions) && actions.includes("view"));
}

async function initSessionNav() {
  const navLinks = qs(".nav-links");
  const brandMarks = qsa(".brand-mark");
  const pageName = currentPageName();
  const baseLinks = [
    ["index.html", "首页"],
    ["whitepaper.html", "社区共识"],
    ["participate.html", "活动与参与"],
    ["donate.html", "捐赠支持"],
    ["about.html", "关于与联系"],
  ];

  const cachedUser = getCachedUser();
  renderMainNav(navLinks, baseLinks, pageName, cachedUser);
  let user = cachedUser;
  try {
    const session = await api.get("/api/session");
    user = session.user;
    cacheUser(user);
  } catch {
    cacheUser(null);
    renderMainNav(navLinks, baseLinks, pageName, null);
    brandMarks.forEach((mark) => {
      mark.addEventListener("click", (event) => {
        event.preventDefault();
        location.href = "me.html";
      });
    });
    return null;
  }

  brandMarks.forEach((mark) => {
    mark.setAttribute("title", user ? "进入我的有空" : "进入开放工作台");
    mark.addEventListener("click", (event) => {
      event.preventDefault();
      location.href = userHome(user);
    });
  });

  renderMainNav(navLinks, baseLinks, pageName, user);
  qs("[data-logout]", navLinks)?.addEventListener("click", async () => {
    await api.post("/api/logout", {}).catch(() => {});
    localStorage.removeItem("yk_session_token");
    localStorage.removeItem("yk_user");
    location.href = "index.html";
  });
  return user;
}

function getCachedUser() {
  try {
    return JSON.parse(localStorage.getItem("yk_user") || "null");
  } catch {
    return null;
  }
}

function cacheUser(user) {
  if (user) {
    localStorage.setItem("yk_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("yk_user");
  }
}

function renderMainNav(navLinks, baseLinks, pageName, user) {
  if (!navLinks) return;
  const activePageName = pageName === "activities.html" ? "participate.html" : pageName;
  const links = baseLinks
    .map(([href, label]) => `<a class="${activePageName === href ? "active" : ""}" href="${href}">${label}</a>`)
    .join("");
  const workspacePages = [
    "me.html",
    "my-activities.html",
    "activity-editor.html",
    "review-tasks.html",
    "registrations.html",
    "activity-feedback.html",
    "feedback.html",
    "admin.html",
    "admin-activities.html",
    "admin-friends.html",
    "admin-feedbacks.html",
    "admin-members.html",
    "admin-roles.html",
    "admin-role-editor.html",
    "admin-modules.html",
    "admin-templates.html",
    "admin-template-editor.html",
    "admin-logs.html",
    "admin-reports.html",
    "admin-safety.html",
    "admin-ai.html",
    "admin-trust.html",
    "admin-trust-detail.html",
    "admin-trust-policy.html",
    "admin-badges.html",
    "admin-badge-policy.html",
    "admin-activity-confidence.html",
  ];
  const myActive = workspacePages.includes(pageName);
  const userPart = user
    ? `<a class="${myActive ? "active" : ""}" href="me.html">我的</a><button class="nav-button" type="button" data-logout>${escapeHtml(user.nickname)} · 退出</button>`
    : `<a class="${myActive ? "active" : ""}" href="me.html">我的</a>`;
  navLinks.innerHTML = `${links}<span class="session-nav" data-session-nav>${userPart}</span>`;
}

async function initLoginPage() {
  const form = qs("[data-login-form]");
  if (!form) return;

  const message = qs("[data-login-message]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(message, "正在确认你的手机号...");
    try {
      const { user, token } = await api.post("/api/login", { phone: form.phone.value });
      if (token) localStorage.setItem("yk_session_token", token);
      cacheUser(user);
      setMessage(message, "登录成功，正在进入页面。", "success");
      window.location.assign(userHome(user));
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

async function fillModuleSelect(select) {
  if (!select) return [];
  const { modules } = await api.get("/api/modules");
  select.innerHTML = modules.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
  return modules;
}

async function fillCollaboratorSelect(select) {
  if (!select) return [];
  const { collaborators } = await api.get("/api/collaborators");
  select.innerHTML = collaborators.length
    ? `<option value="">可不选择，必要时由社区接住</option>${collaborators.map((item) => `<option value="${item.id}">${escapeHtml(item.nickname)}</option>`).join("")}`
    : `<option value="">暂无协作员，可先直接发起</option>`;
  return collaborators;
}

async function fillFriendSelect(select) {
  if (!select) return [];
  const { friends } = await api.get("/api/living-room-friends?enabled=true&page=1&pageSize=100");
  select.innerHTML = friends.length
    ? `<option value="">请选择客厅朋友</option>${friends.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`
    : `<option value="">暂无已启用的客厅朋友</option>`;
  return friends;
}

function bindSourceTypeToggle(form) {
  const select = qs("[data-source-type-toggle]", form);
  const field = qs("[data-friend-field]", form);
  if (!select || !field) return;
  const friendSelect = field.querySelector("select");
  const sync = () => {
    const shouldShow = select.value === "friend";
    field.hidden = !shouldShow;
    if (friendSelect) friendSelect.required = shouldShow;
    if (!shouldShow && friendSelect) friendSelect.value = "";
  };
  if (select.dataset.bound !== "true") {
    select.addEventListener("change", sync);
    select.dataset.bound = "true";
  }
  sync();
}

async function fillModuleFilterSelect(select) {
  if (!select) return [];
  const { modules } = await api.get("/api/modules");
  select.innerHTML = `<option value="">全部模块</option>${modules.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
  return modules;
}

async function fillTemplateSelect(select) {
  if (!select) return [];
  const { templates } = await api.get("/api/templates?page=1&pageSize=100");
  select.innerHTML = [
    `<option value="">无，自己写</option>`,
    ...templates.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`),
  ].join("");
  return templates;
}

function toDatetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function renderFormationMeta(activity = {}) {
  if (!activity.minRegistrationEnabled || !Number(activity.minRegistrationCount || 0)) return "";
  const deadline = activity.registrationDeadline ? ` · 截止 ${formatDate(activity.registrationDeadline)}` : "";
  return `<span>最低 ${Number(activity.minRegistrationCount || 0)} 人成团${deadline}</span>`;
}

function renderInterestButton(activity = {}) {
  const interested = hasActivityInterest(activity);
  const count = Number(activity.interestCount || 0);
  return `
    <button class="interest-button" type="button" data-interest-activity-id="${escapeHtml(activity.id)}" ${interested ? "disabled" : ""}>
      <span>${interested ? "已感兴趣" : "感兴趣"}</span>
      <strong data-interest-count="${escapeHtml(activity.id)}">${count}</strong>
    </button>
  `;
}

function renderActivityCard(activity) {
  const cover = activity.coverUrl
    ? `<img src="${escapeHtml(activity.coverUrl)}" alt="${escapeHtml(activity.title)}" />`
    : `<div class="activity-cover-placeholder">${escapeHtml(activity.moduleName)}</div>`;
  const capacity = activity.capacity ? `${activity.registrationCount}/${activity.capacity} 人` : `${activity.registrationCount} 人已报名`;
  return `
    <article class="event-card">
      <a class="event-cover" href="activity.html?id=${activity.id}">${cover}</a>
      <div class="event-body">
        <div class="tag-row"><span class="tag">${escapeHtml(activity.moduleName)}</span><span class="tag soft">${escapeHtml(activity.sourceName || activity.sourceLabel || "客厅")}</span></div>
        <h3><a href="activity.html?id=${activity.id}">${escapeHtml(activity.title)}</a></h3>
        <p>${escapeHtml(activity.location)} · ${formatActivityTime(activity)}</p>
        <div class="event-meta">
          <span>${escapeHtml(activity.statusLabel || "活动发布")}</span>
          <span>发起人：${escapeHtml(activity.initiator)}</span>
          <span>${capacity}</span>
          ${renderFormationMeta(activity)}
        </div>
        <div class="event-actions">${renderInterestButton(activity)}</div>
      </div>
    </article>
  `;
}

function bindActivityInterestActions(root = document) {
  qsa("[data-interest-activity-id]", root).forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const activityId = button.dataset.interestActivityId;
      if (!activityId || button.disabled) return;
      const previousText = button.querySelector("span")?.textContent || "感兴趣";
      button.disabled = true;
      button.querySelector("span") && (button.querySelector("span").textContent = "记录中");
      try {
        const result = await api.post(`/api/activities/${encodeURIComponent(activityId)}/interests`, {});
        rememberActivityInterest(activityId);
        button.querySelector("span") && (button.querySelector("span").textContent = "已感兴趣");
        addTransientMotion(button, "is-recorded", 620);
        qsa("[data-interest-count]").forEach((item) => {
          if (item.dataset.interestCount === activityId) {
            item.textContent = String(result.interestCount ?? item.textContent ?? 0);
          }
        });
        showToast(result.existing ? "已经记录过感兴趣" : "已记录感兴趣");
      } catch (error) {
        button.disabled = false;
        button.querySelector("span") && (button.querySelector("span").textContent = previousText);
        showToast(error.message || "暂时不能记录感兴趣");
      }
    });
  });
}

async function renderActivityLists() {
  const lists = qsa("[data-activity-list]");
  if (!lists.length) return;

  await Promise.all(lists.map(async (list) => {
    const limit = Number(list.dataset.limit || "0");
    const view = list.dataset.activityView || "upcoming";
    const pageSize = limit || Number(list.dataset.pageSize || "12");
    const params = new URLSearchParams({
      view,
      page: "1",
      pageSize: String(pageSize),
      sort: view === "history" ? "start-desc" : "start-asc",
    });
    const { activities } = await api.get(`/api/activities?${params.toString()}`);
    const visible = limit ? activities.slice(0, limit) : activities;
    if (!visible.length) {
      list.innerHTML = `
        <div class="empty-state">
          <strong>${escapeHtml(list.dataset.emptyTitle || "公告栏还空着")}</strong>
          <p>${escapeHtml(list.dataset.emptyText || "等第一位朋友发布活动，这里就会出现新的接龙。")}</p>
        </div>
      `;
      revealDynamicContent(list);
      return;
    }
    list.innerHTML = visible.map(renderActivityCard).join("");
    bindActivityInterestActions(list);
    revealDynamicContent(list);
  }));
}

async function requireCurrentUser() {
  const { user } = await api.get("/api/session");
  if (!user) {
    location.href = "login.html";
    return null;
  }
  return user;
}

async function getOptionalUser() {
  try {
    const { user } = await api.get("/api/session");
    cacheUser(user);
    return user || null;
  } catch {
    return getCachedUser();
  }
}

async function initMeDashboardPage() {
  const root = qs("[data-me-dashboard]");
  if (!root) return;
  const user = await getOptionalUser();
  mePageState.user = user;
  qs("[data-user-name]", root).textContent = user?.nickname || "朋友";

  const dashboard = await api.get("/api/dashboard/me");

  renderWorkspaceCards(root, user, dashboard.summary, dashboard.pending);
  renderDashboardSummary(qs("[data-workspace-summary]", root), dashboard.summary);
  await Promise.all([
    renderMyRegistrations(root),
    renderMyFeedbacks(root),
  ]);

  const pendingPreview = qs("[data-my-pending]", root);
  const pendingSection = qs("[data-my-pending-section]", root);
  const canSeePending = hasPermission(user, "reviewTasks", "view") || hasPermission(user, "activities", "review") || hasPermission(user, "feedbacks", "view");
  if (pendingSection && !canSeePending) {
    pendingSection.hidden = true;
  } else if (hasPermission(user, "activities", "review") || hasPermission(user, "feedbacks", "view")) {
    await renderMyPendingTasks();
  } else {
    renderPendingTasks(pendingPreview, (dashboard.pending?.activities || []).slice(0, 3), { compact: true });
  }
}

async function renderMyRegistrations(root = document) {
  const list = qs("[data-my-registrations]", root);
  if (!list) return;
  const { registrations } = await api.get("/api/my/registrations?page=1&pageSize=6");
  if (!registrations.length) {
    list.innerHTML = `<div class="empty-state slim"><strong>还没有报名记录</strong><p>报名参加过的活动会留在这里，取消报名后不再显示。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  list.innerHTML = registrations.map((registration) => {
    const activity = registration.activity || {};
    const token = registrationTokenFor(activity.id, registration.id);
    const detailUrl = token
      ? `success.html?activity=${encodeURIComponent(activity.id)}&registration=${encodeURIComponent(registration.id)}&token=${encodeURIComponent(token)}`
      : `activity.html?id=${encodeURIComponent(activity.id)}`;
    return `
      <article class="event-row compact-row">
        <div>
          <span class="tag">${escapeHtml(activity.statusLabel || "活动")}</span>
          <h3><a href="${detailUrl}">${escapeHtml(activity.title || "未命名活动")}</a></h3>
          <p>${escapeHtml(activity.location || "地点待定")} · ${formatActivityTime(activity)} · 报名昵称：${escapeHtml(registration.nickname)}</p>
        </div>
        <div class="row-actions">
          <a class="button outline" href="${detailUrl}">查看详情</a>
        </div>
      </article>
    `;
  }).join("");
  revealDynamicContent(list);
}

async function renderMyFeedbacks(root = document) {
  const list = qs("[data-my-feedbacks]", root);
  if (!list) return;
  const { feedbacks } = await api.get("/api/my/feedbacks?page=1&pageSize=6");
  if (!feedbacks.length) {
    list.innerHTML = `<div class="empty-state slim"><strong>还没有写过反馈</strong><p>活动开始后可以匿名留下真实感受。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  list.innerHTML = feedbacks.map((feedback) => `
    <article class="event-row compact-row">
      <div>
        <span class="tag">${escapeHtml(feedback.statusLabel || feedbackStatusLabel(feedback.status))}</span>
        <h3><a href="activity.html?id=${encodeURIComponent(feedback.activityId)}">${escapeHtml(feedback.activityTitle || "未命名活动")}</a></h3>
        <p>${escapeHtml(feedback.favorite || feedback.improvement || feedback.other || "已提交匿名反馈")}</p>
      </div>
      <div class="row-actions">
        <a class="button outline" href="activity.html?id=${encodeURIComponent(feedback.activityId)}">查看活动</a>
      </div>
    </article>
  `).join("");
  revealDynamicContent(list);
}

function countByStatus(activities) {
  return activities.reduce((acc, activity) => {
    acc[activity.status] = (acc[activity.status] || 0) + 1;
    return acc;
  }, {});
}

function renderDashboardSummary(container, summary) {
  if (!container) return;
  const counts = Array.isArray(summary) ? countByStatus(summary) : (summary?.byStatus || {});
  const total = Array.isArray(summary) ? summary.length : Number(summary?.total || 0);
  const reviewing = Number(summary?.reviewing ?? ((counts.analysis_pending || 0) + (counts.admin_review || 0) + (counts.collaborator_review || 0)));
  const published = Number(summary?.published ?? ((counts.published || 0) + (counts.full || 0)));
  container.innerHTML = `
    <a class="stat stat-link" href="my-activities.html"><strong>${total}</strong><span>我发起的活动</span></a>
    <a class="stat stat-link" href="my-activities.html?status=draft"><strong>${counts.draft || 0}</strong><span>草稿</span></a>
    <a class="stat stat-link" href="my-activities.html?status=reviewing"><strong>${reviewing}</strong><span>审核中</span></a>
    <a class="stat stat-link" href="my-activities.html?status=published_group"><strong>${published}</strong><span>已发布</span></a>
  `;
  revealDynamicContent(container);
}

function renderWorkspaceCards(root, user, summary, pendingSummary) {
  const container = qs("[data-workspace-cards]", root);
  if (!container) return;
  const counts = Array.isArray(summary) ? countByStatus(summary) : (summary?.byStatus || {});
  const total = Array.isArray(summary) ? summary.length : Number(summary?.total || 0);
  const reviewing = Number(summary?.reviewing ?? ((counts.analysis_pending || 0) + (counts.admin_review || 0) + (counts.collaborator_review || 0)));
  const pendingTotal = Array.isArray(pendingSummary) ? pendingSummary.length : Number(pendingSummary?.total || 0);
  const cards = [
    {
      href: "#my-registrations",
      label: "我的报名",
      title: "查看这个设备参加过的活动",
      body: "报名成功、活动详情和取消后的状态，都从这里回看。",
      meta: "活动参与者入口",
      count: "报名",
      icon: "registration",
      tone: "green",
    },
    {
      href: "#my-feedbacks",
      label: "我的反馈",
      title: "回看写过的匿名反馈",
      body: "活动结束后留下的真实感受，会按这个设备保存在这里。",
      meta: "匿名反馈入口",
      count: "反馈",
      icon: "feedback",
      tone: "teal",
    },
    {
      href: "activity-editor.html",
      label: "发起活动",
      title: "写下一个新的活动想法",
      body: "不需要注册登录。写清楚时间、地点和想做的事，系统会给出轻量风险判断。",
      meta: "草稿 / 直接发布 / 社区复核",
      count: "+",
      icon: "create",
      tone: "blue",
    },
    {
      href: "my-activities.html",
      label: "我发起的活动",
      title: "管理自己的活动和报名表",
      body: "同一浏览器里可以继续编辑、撤回活动和查看报名表。",
      meta: `${reviewing} 个审核中`,
      count: total,
      icon: "mine",
      tone: "purple",
    },
  ];
  if (hasPermission(user, "reviewTasks", "view") || hasPermission(user, "activities", "review")) {
    cards.push({
      href: "review-tasks.html",
      label: "审核待办",
      title: "处理需要你审核的活动",
      body: "查看活动详情、封面、描述和审核历史。",
      meta: "协作入口",
      count: pendingTotal,
      icon: "todo",
      tone: "urgent",
    });
  }
  const managedPage = firstManagedPage(user);
  if (managedPage) {
    cards.push({
      href: managedPage,
      label: "管理后台",
      title: "进入后台工作台",
      body: "按权限进入活动、用户、规则、AI 和社区治理模块。",
      meta: hasPermission(user, "dashboard", "view") ? "工作台入口" : "权限入口",
      count: "Admin",
      icon: "admin",
      tone: "indigo",
    });
  }
  container.innerHTML = cards.map(renderWorkspaceCard).join("");
  revealDynamicContent(container);
}

function renderWorkspaceCard(card) {
  const toneByIcon = {
    activity: "blue",
    admin: "indigo",
    ai: "violet",
    create: "blue",
    feedback: "green",
    friend: "amber",
    grid: "slate",
    governance: "teal",
    logs: "gray",
    mine: "purple",
    people: "indigo",
    trust: "teal",
    policy: "emerald",
    badge: "amber",
    eye: "slate",
    key: "indigo",
    registration: "green",
    report: "rose",
    rules: "emerald",
    template: "purple",
    todo: "urgent",
  };
  const tone = card.tone || toneByIcon[card.icon] || "neutral";
  const icon = card.icon ? `<span class="workspace-icon" aria-hidden="true">${workspaceIconSvg(card.icon)}</span>` : "";
  const label = `<span>${escapeHtml(card.label)}</span>`;
  return `
    <a class="workspace-card${card.className ? ` ${escapeHtml(card.className)}` : ""}" href="${card.href}" data-card-tone="${escapeHtml(tone)}"${card.icon ? ` data-workspace-icon="${escapeHtml(card.icon)}"` : ""}>
      <div class="workspace-card-top">${icon}${label}<span class="workspace-card-cue" aria-hidden="true">${workspaceCueSvg()}</span></div>
      <strong class="workspace-count">${escapeHtml(String(card.count))}</strong>
      <h3>${escapeHtml(card.title)}</h3>
      <p>${escapeHtml(card.body)}</p>
      <small>${escapeHtml(card.meta)}</small>
    </a>
  `;
}

function workspaceIconSvg(name = "circle") {
  // Admin dashboard icons use MIT-licensed GitHub Octicons paths as the base visual system.
  const icons = {
    activity: { viewBox: "0 0 24 24", body: `<path d="M6.75 0a.75.75 0 0 1 .75.75V3h9V.75a.75.75 0 0 1 1.5 0V3h2.75c.966 0 1.75.784 1.75 1.75v16a1.75 1.75 0 0 1-1.75 1.75H3.25a1.75 1.75 0 0 1-1.75-1.75v-16C1.5 3.784 2.284 3 3.25 3H6V.75A.75.75 0 0 1 6.75 0ZM21 9.5H3v11.25c0 .138.112.25.25.25h17.5a.25.25 0 0 0 .25-.25Zm-17.75-5a.25.25 0 0 0-.25.25V8h18V4.75a.25.25 0 0 0-.25-.25Z"></path>` },
    admin: { viewBox: "0 0 24 24", body: `<path d="M11.46 1.137a1.748 1.748 0 0 1 1.08 0l8.25 2.675A1.75 1.75 0 0 1 22 5.476V10.5c0 6.19-3.77 10.705-9.401 12.83a1.704 1.704 0 0 1-1.198 0C5.771 21.204 2 16.69 2 10.5V5.476c0-.76.49-1.43 1.21-1.664Zm.617 1.426a.253.253 0 0 0-.154 0L3.673 5.24a.25.25 0 0 0-.173.237V10.5c0 5.461 3.28 9.483 8.43 11.426a.199.199 0 0 0 .14 0c5.15-1.943 8.43-5.965 8.43-11.426V5.476a.25.25 0 0 0-.173-.237ZM13 12.232V15a1 1 0 0 1-2 0v-2.768a2 2 0 1 1 2 0Z"></path>` },
    ai: { viewBox: "0 0 24 24", body: `<path d="M19.375 8.5a3.25 3.25 0 1 1-3.163 4h-3a3.252 3.252 0 0 1-4.443 2.509L7.214 17.76a3.25 3.25 0 1 1-1.342-.674l1.672-2.957A3.238 3.238 0 0 1 6.75 12c0-.907.371-1.727.97-2.316L6.117 6.846A3.253 3.253 0 0 1 1.875 3.75a3.25 3.25 0 1 1 5.526 2.32l1.603 2.836A3.25 3.25 0 0 1 13.093 11h3.119a3.252 3.252 0 0 1 3.163-2.5ZM10 10.25a1.75 1.75 0 1 0-.001 3.499A1.75 1.75 0 0 0 10 10.25ZM5.125 2a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Zm12.5 9.75a1.75 1.75 0 1 0 3.5 0 1.75 1.75 0 0 0-3.5 0Zm-14.25 8.5a1.75 1.75 0 1 0 3.501-.001 1.75 1.75 0 0 0-3.501.001Z"></path>` },
    create: { viewBox: "0 0 24 24", body: `<path d="M1.513 1.96a1.374 1.374 0 0 1 1.499-.21l19.335 9.215a1.147 1.147 0 0 1 0 2.07L3.012 22.25a1.374 1.374 0 0 1-1.947-1.46L2.49 12 1.065 3.21a1.375 1.375 0 0 1 .448-1.25Zm2.375 10.79-1.304 8.042L21.031 12 2.584 3.208l1.304 8.042h7.362a.75.75 0 0 1 0 1.5Z"></path>` },
    feedback: { viewBox: "0 0 24 24", body: `<path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v9.5A1.75 1.75 0 0 1 14.25 14H8.061l-2.574 2.573A1.458 1.458 0 0 1 3 15.543V14H1.75A1.75 1.75 0 0 1 0 12.25v-9.5C0 1.784.784 1 1.75 1ZM1.5 2.75v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25Z"></path><path d="M22.5 8.75a.25.25 0 0 0-.25-.25h-3.5a.75.75 0 0 1 0-1.5h3.5c.966 0 1.75.784 1.75 1.75v9.5A1.75 1.75 0 0 1 22.25 20H21v1.543a1.457 1.457 0 0 1-2.487 1.03L15.939 20H10.75A1.75 1.75 0 0 1 9 18.25v-1.465a.75.75 0 0 1 1.5 0v1.465c0 .138.112.25.25.25h5.5a.75.75 0 0 1 .53.22l2.72 2.72v-2.19a.75.75 0 0 1 .75-.75h2a.25.25 0 0 0 .25-.25v-9.5Z"></path>` },
    badge: { viewBox: "0 0 24 24", body: `<path d="M12 1.5a5.25 5.25 0 0 0-3.408 9.244l-1.456 7.28a.75.75 0 0 0 1.04.83L12 17.066l3.824 1.788a.75.75 0 0 0 1.04-.83l-1.456-7.28A5.25 5.25 0 0 0 12 1.5Zm0 1.5a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Zm-2.17 8.63a5.236 5.236 0 0 0 4.34 0l1.034 5.17-2.886-1.35a.75.75 0 0 0-.636 0l-2.886 1.35 1.034-5.17Z"></path>` },
    eye: { viewBox: "0 0 24 24", body: `<path d="M12 4.25c-4.175 0-7.603 2.267-10.287 6.163a2.75 2.75 0 0 0 0 3.174C4.397 17.483 7.825 19.75 12 19.75s7.603-2.267 10.287-6.163a2.75 2.75 0 0 0 0-3.174C19.603 6.517 16.175 4.25 12 4.25Zm0 1.5c3.54 0 6.54 1.94 9.052 5.514.342.488.342 1.0 0 1.472C18.54 16.31 15.54 18.25 12 18.25s-6.54-1.94-9.052-5.514a1.25 1.25 0 0 1 0-1.472C5.46 7.69 8.46 5.75 12 5.75Zm0 3a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Zm0 1.5a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Z"></path>` },
    friend: { viewBox: "0 0 24 24", body: `<path d="M11.03 2.59a1.501 1.501 0 0 1 1.94 0l7.5 6.363a1.5 1.5 0 0 1 .53 1.144V19.5a1.5 1.5 0 0 1-1.5 1.5h-5.75a.75.75 0 0 1-.75-.75V14h-2v6.25a.75.75 0 0 1-.75.75H4.5A1.5 1.5 0 0 1 3 19.5v-9.403c0-.44.194-.859.53-1.144ZM12 3.734l-7.5 6.363V19.5h5v-6.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v6.25h5v-9.403Z"></path>` },
    grid: { viewBox: "0 0 24 24", body: `<path d="M5.5 2.75A2.75 2.75 0 0 0 2.75 5.5v3a2.75 2.75 0 0 0 2.75 2.75h3a2.75 2.75 0 0 0 2.75-2.75v-3A2.75 2.75 0 0 0 8.5 2.75h-3ZM4.25 5.5c0-.69.56-1.25 1.25-1.25h3c.69 0 1.25.56 1.25 1.25v3c0 .69-.56 1.25-1.25 1.25h-3c-.69 0-1.25-.56-1.25-1.25v-3Zm1.25 7.25a2.75 2.75 0 0 0-2.75 2.75v3a2.75 2.75 0 0 0 2.75 2.75h3a2.75 2.75 0 0 0 2.75-2.75v-3a2.75 2.75 0 0 0-2.75-2.75h-3ZM4.25 15.5c0-.69.56-1.25 1.25-1.25h3c.69 0 1.25.56 1.25 1.25v3c0 .69-.56 1.25-1.25 1.25h-3c-.69 0-1.25-.56-1.25-1.25v-3Zm8.5-10a2.75 2.75 0 0 1 2.75-2.75h3a2.75 2.75 0 0 1 2.75 2.75v3a2.75 2.75 0 0 1-2.75 2.75h-3a2.75 2.75 0 0 1-2.75-2.75v-3Zm2.75-1.25c-.69 0-1.25.56-1.25 1.25v3c0 .69.56 1.25 1.25 1.25h3c.69 0 1.25-.56 1.25-1.25v-3c0-.69-.56-1.25-1.25-1.25h-3Zm0 8.5a2.75 2.75 0 0 0-2.75 2.75v3a2.75 2.75 0 0 0 2.75 2.75h3a2.75 2.75 0 0 0 2.75-2.75v-3a2.75 2.75 0 0 0-2.75-2.75h-3Zm-1.25 2.75c0-.69.56-1.25 1.25-1.25h3c.69 0 1.25.56 1.25 1.25v3c0 .69-.56 1.25-1.25 1.25h-3c-.69 0-1.25-.56-1.25-1.25v-3Z"></path>` },
    governance: { viewBox: "0 0 24 24", body: `<path d="M8.75 7a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5ZM7 11.75a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75ZM9.75 15a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z"></path><path d="M2 3.75C2 2.784 2.784 2 3.75 2h16.5c.966 0 1.75.784 1.75 1.75v16.5A1.75 1.75 0 0 1 20.25 22H3.75A1.75 1.75 0 0 1 2 20.25Zm1.75-.25a.25.25 0 0 0-.25.25v16.5c0 .138.112.25.25.25h16.5a.25.25 0 0 0 .25-.25V3.75a.25.25 0 0 0-.25-.25Z"></path>` },
    key: { viewBox: "0 0 24 24", body: `<path d="M15.5 7.25a5.75 5.75 0 1 0-6.487 5.704l-6.293 6.293a.75.75 0 0 0-.22.53V22a.75.75 0 0 0 .75.75h2.25a.75.75 0 0 0 .75-.75v-1.25H7.5a.75.75 0 0 0 .75-.75v-1.25H9.5a.75.75 0 0 0 .53-.22l.97-.97v-1.31h1.31l1.737-1.737A5.75 5.75 0 0 0 15.5 7.25Zm-5.75 0a4.25 4.25 0 1 1 8.5 0 4.25 4.25 0 0 1-8.5 0Zm6-1.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"></path>` },
    logs: { viewBox: "0 0 24 24", body: `<path d="M11.998 2.5A9.503 9.503 0 0 0 3.378 8H5.75a.75.75 0 0 1 0 1.5H2a1 1 0 0 1-1-1V4.75a.75.75 0 0 1 1.5 0v1.697A10.997 10.997 0 0 1 11.998 1C18.074 1 23 5.925 23 12s-4.926 11-11.002 11C6.014 23 1.146 18.223 1 12.275a.75.75 0 0 1 1.5-.037 9.5 9.5 0 0 0 9.498 9.262c5.248 0 9.502-4.253 9.502-9.5s-4.254-9.5-9.502-9.5Z"></path><path d="M12.5 7.25a.75.75 0 0 0-1.5 0v5.5c0 .27.144.518.378.651l3.5 2a.75.75 0 0 0 .744-1.302L12.5 12.315V7.25Z"></path>` },
    mine: { viewBox: "0 0 24 24", body: `<path d="M7.25 6a.75.75 0 0 0-.75.75v7.5a.75.75 0 0 0 1.5 0v-7.5A.75.75 0 0 0 7.25 6ZM12 6a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 0 1.5 0v-4.5A.75.75 0 0 0 12 6Zm4 .75a.75.75 0 0 1 1.5 0v9.5a.75.75 0 0 1-1.5 0v-9.5Z"></path><path d="M3.75 2h16.5c.966 0 1.75.784 1.75 1.75v16.5A1.75 1.75 0 0 1 20.25 22H3.75A1.75 1.75 0 0 1 2 20.25V3.75C2 2.784 2.784 2 3.75 2ZM3.5 3.75v16.5c0 .138.112.25.25.25h16.5a.25.25 0 0 0 .25-.25V3.75a.25.25 0 0 0-.25-.25H3.75a.25.25 0 0 0-.25.25Z"></path>` },
    people: { viewBox: "0 0 24 24", body: `<path d="M3.5 8a5.5 5.5 0 1 1 8.596 4.547 9.005 9.005 0 0 1 5.9 8.18.751.751 0 0 1-1.5.045 7.5 7.5 0 0 0-14.993 0 .75.75 0 0 1-1.499-.044 9.005 9.005 0 0 1 5.9-8.181A5.496 5.496 0 0 1 3.5 8ZM9 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.29 4c-.148 0-.292.01-.434.03a.75.75 0 1 1-.212-1.484 4.53 4.53 0 0 1 3.38 8.097 6.69 6.69 0 0 1 3.956 6.107.75.75 0 0 1-1.5 0 5.193 5.193 0 0 0-3.696-4.972l-.534-.16v-1.676l.41-.209A3.03 3.03 0 0 0 17.29 8Z"></path>` },
    policy: { viewBox: "0 0 24 24", body: `<path d="M4.75 3.5a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5H4.75ZM3 8.75A.75.75 0 0 1 3.75 8h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 8.75Zm1.75 4.25a.75.75 0 0 0 0 1.5h9.5a.75.75 0 0 0 0-1.5h-9.5Zm0 5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z"></path><path d="M18.78 13.72a.75.75 0 0 0-1.06 0l-4.25 4.25a.75.75 0 0 0-.22.53v1.75c0 .414.336.75.75.75h1.75a.75.75 0 0 0 .53-.22l4.25-4.25a.75.75 0 0 0 0-1.06l-1.75-1.75Zm-4.03 4.97 3.5-3.5.69.69-3.5 3.5h-.69v-.69Z"></path>` },
    registration: { viewBox: "0 0 24 24", body: `<path d="M5 3.75C5 2.784 5.784 2 6.75 2h10.5c.966 0 1.75.784 1.75 1.75v17.5a.75.75 0 0 1-1.218.586L12 17.21l-5.781 4.625A.75.75 0 0 1 5 21.25Zm1.75-.25a.25.25 0 0 0-.25.25v15.94l5.031-4.026a.749.749 0 0 1 .938 0L17.5 19.69V3.75a.25.25 0 0 0-.25-.25Z"></path>` },
    report: { viewBox: "0 0 24 24", body: `<path d="M1.5 4.25c0-.966.784-1.75 1.75-1.75h17.5c.966 0 1.75.784 1.75 1.75v12.5a1.75 1.75 0 0 1-1.75 1.75h-9.586a.25.25 0 0 0-.177.073l-3.5 3.5A1.458 1.458 0 0 1 5 21.043V18.5H3.25a1.75 1.75 0 0 1-1.75-1.75ZM3.25 4a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h2.5a.75.75 0 0 1 .75.75v3.19l3.427-3.427A1.75 1.75 0 0 1 11.164 17h9.586a.25.25 0 0 0 .25-.25V4.25a.25.25 0 0 0-.25-.25ZM12 6a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-1.5 0v-4A.75.75 0 0 1 12 6Zm0 9a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>` },
    rules: { viewBox: "0 0 24 24", body: `<path d="M16.53 9.78a.75.75 0 0 0-1.06-1.06L11 13.19l-1.97-1.97a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l5-5Z"></path><path d="m12.54.637 8.25 2.675A1.75 1.75 0 0 1 22 4.976V10c0 6.19-3.771 10.704-9.401 12.83a1.704 1.704 0 0 1-1.198 0C5.77 20.705 2 16.19 2 10V4.976c0-.758.489-1.43 1.21-1.664L11.46.637a1.748 1.748 0 0 1 1.08 0Zm-.617 1.426-8.25 2.676a.249.249 0 0 0-.173.237V10c0 5.46 3.28 9.483 8.43 11.426a.199.199 0 0 0 .14 0C17.22 19.483 20.5 15.461 20.5 10V4.976a.25.25 0 0 0-.173-.237l-8.25-2.676a.253.253 0 0 0-.154 0Z"></path>` },
    template: { viewBox: "0 0 24 24", body: `<path d="M3.75 3.5a.25.25 0 0 0-.25.25v2.062a.75.75 0 1 1-1.5 0V3.75C2 2.783 2.783 2 3.75 2h2.062a.75.75 0 1 1 0 1.5Zm13.688-.75a.75.75 0 0 1 .75-.75h2.062c.966 0 1.75.783 1.75 1.75v2.062a.75.75 0 1 1-1.5 0V3.75a.25.25 0 0 0-.25-.25h-2.062a.75.75 0 0 1-.75-.75ZM2.75 17.438a.75.75 0 0 1 .75.75v2.062c0 .138.112.25.25.25h2.062a.75.75 0 1 1 0 1.5H3.75A1.75 1.75 0 0 1 2 20.25v-2.062a.75.75 0 0 1 .75-.75Zm18.5 0a.75.75 0 0 1 .75.75v2.062A1.75 1.75 0 0 1 20.25 22h-2.062a.75.75 0 1 1 0-1.5h2.062a.25.25 0 0 0 .25-.25v-2.062a.75.75 0 0 1 .75-.75Zm-18.5-8.25a.75.75 0 0 1 .75.75v4.124a.75.75 0 1 1-1.5 0V9.938a.75.75 0 0 1 .75-.75ZM9.188 2.75a.75.75 0 0 1 .75-.75h4.124a.75.75 0 1 1 0 1.5H9.938a.75.75 0 0 1-.75-.75Zm0 18.5a.75.75 0 0 1 .75-.75h4.124a.75.75 0 1 1 0 1.5H9.938a.75.75 0 0 1-.75-.75ZM21.25 9.188a.75.75 0 0 1 .75.75v4.124a.75.75 0 1 1-1.5 0V9.938a.75.75 0 0 1 .75-.75ZM3.75 8.25a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1-.75-.75Zm5.5 0A.75.75 0 0 1 10 7.5h2A.75.75 0 0 1 12 9h-2a.75.75 0 0 1-.75-.75Zm-1-4.5A.75.75 0 0 1 9 4.5v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .75-.75Zm0 5.5A.75.75 0 0 1 9 10v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .75-.75Zm0 4.75a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 .75-.75ZM14 8.25a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1-.75-.75Z"></path>` },
    trust: { viewBox: "0 0 24 24", body: `<path d="M12 2.25a.75.75 0 0 1 .53.22l2.72 2.72 3.806.552a.75.75 0 0 1 .416 1.279l-2.754 2.684.65 3.79a.75.75 0 0 1-1.088.79L12 12.036l-3.404 1.79a.75.75 0 0 1-1.088-.79l.65-3.79-2.754-2.684a.75.75 0 0 1 .416-1.279l3.806-.552 2.72-2.72a.75.75 0 0 1 .53-.22Zm0 1.812-1.812 1.812a.75.75 0 0 1-.422.212l-2.536.368 1.836 1.79a.75.75 0 0 1 .216.664l-.433 2.526 2.269-1.193a.75.75 0 0 1 .698 0l2.269 1.193-.433-2.526a.75.75 0 0 1 .216-.664l1.836-1.79-2.536-.368a.75.75 0 0 1-.422-.212L12 4.062Z"></path><path d="M4.75 17a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5H4.75Zm2.5 3.5a.75.75 0 0 0 0 1.5h9.5a.75.75 0 0 0 0-1.5h-9.5Z"></path>` },
    todo: { viewBox: "0 0 24 24", body: `<path d="M3.5 3.75a.25.25 0 0 1 .25-.25h13.5a.25.25 0 0 1 .25.25v10a.75.75 0 0 0 1.5 0v-10A1.75 1.75 0 0 0 17.25 2H3.75A1.75 1.75 0 0 0 2 3.75v16.5c0 .966.784 1.75 1.75 1.75h7a.75.75 0 0 0 0-1.5h-7a.25.25 0 0 1-.25-.25V3.75Z"></path><path d="M6.25 7a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Zm-.75 4.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Zm16.28 4.53a.75.75 0 1 0-1.06-1.06l-4.97 4.97-1.97-1.97a.75.75 0 1 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l5.5-5.5Z"></path>` },
  };
  const icon = icons[name] || { viewBox: "0 0 24 24", body: `<path d="M12.5 1.25a.75.75 0 0 0-1.5 0v8.69L6.447 5.385a.75.75 0 1 0-1.061 1.06L9.94 11H1.25a.75.75 0 0 0 0 1.5h8.69l-4.554 4.553a.75.75 0 0 0 1.06 1.061L11 13.561v8.689a.75.75 0 0 0 1.5 0v-8.69l4.553 4.554a.75.75 0 0 0 1.061-1.06L13.561 12.5h8.689a.75.75 0 0 0 0-1.5h-8.69l4.554-4.553a.75.75 0 1 0-1.06-1.061L12.5 9.939V1.25Z"></path>` };
  return `<svg viewBox="${icon.viewBox}" fill="currentColor" aria-hidden="true" data-octicon="true">${icon.body}</svg>`;
}

function workspaceCueSvg() {
  return `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8.22 2.97a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.19 8.5H3.75a.75.75 0 0 1 0-1.5h7.44L8.22 4.03a.75.75 0 0 1 0-1.06Z"></path></svg>`;
}

async function initActivityEditorPage() {
  const form = qs("[data-activity-form]");
  if (!form) return;
  const user = await getOptionalUser();
  mePageState.user = user;
  qs("[data-user-name]") && (qs("[data-user-name]").textContent = user?.nickname || "朋友");
  resetActivityForm(form);
  bindInitiatorContactToggle(form);
  bindMinRegistrationToggle(form);
  bindSourceTypeToggle(form);
  mePageState.richEditor = window.youkongRichEditor ? window.youkongRichEditor.mount(form) : null;
  mePageState.modules = await fillModuleSelect(form.moduleId);
  mePageState.collaborators = await fillCollaboratorSelect(form.collaboratorId);
  mePageState.friends = await fillFriendSelect(form.friendId);
  mePageState.templates = await fillTemplateSelect(qs("[data-template-select]", form));
  bindTemplateSelect(form);
  await initTurnstileForForm(form);

  const editingId = new URLSearchParams(location.search).get("id");
  if (editingId) {
    try {
      const { activity } = await api.get(`/api/activities/${editingId}`);
      fillActivityForm(form, activity);
    } catch (error) {
      setMessage(qs("[data-activity-message]"), error.message, "error");
    }
  }

  qsa("[data-submit-intent]", form).forEach((button) => {
    button.addEventListener("click", () => {
      mePageState.submitIntent = button.dataset.submitIntent || "submit";
    });
  });

  const message = qs("[data-activity-message]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    window.youkongRichEditor?.sync(form);
    const formData = new FormData(form);
    const editing = mePageState.editingActivity;
    const intent = mePageState.submitIntent || "submit";
    formData.set("intent", intent);
    setMessage(message, intent === "draft" ? "正在保存草稿..." : "正在发起活动...");
    try {
      const turnstileToken = await getTurnstileToken(form);
      if (turnstileToken) formData.set("turnstileToken", turnstileToken);
      const { activity } = editing
        ? await api.put(`/api/activities/${editing.id}`, formData)
        : await api.post("/api/activities", formData);
      const submitMessage = activity.status === "published"
        ? "活动已发布。"
        : activity.status === "analysis_pending"
          ? "活动已提交，正在进行安全分析。你可以先回到我的活动查看状态。"
        : activity.status === "admin_review" || activity.status === "collaborator_review"
          ? "活动已进入社区复核。"
          : activity.status === "rejected"
            ? "活动暂未发出，可以查看提示后重新调整。"
            : "草稿已保存。";
      setMessage(message, intent === "draft" ? "草稿已保存。" : submitMessage, "success");
      showToast("保存成功");
      resetActivityForm(form);
      setTimeout(() => {
        location.href = "my-activities.html";
      }, 520);
    } catch (error) {
      setMessage(message, error.message, "error");
    } finally {
      mePageState.submitIntent = "submit";
    }
  });

  qs("[data-cancel-edit]")?.addEventListener("click", () => {
    resetActivityForm(form);
    setMessage(message, "已取消编辑。");
  });
}

function bindInitiatorContactToggle(form) {
  const select = qs("[data-initiator-contact-toggle]", form);
  const field = qs("[data-initiator-contact-field]", form);
  if (!select || !field || select.dataset.bound === "true") return;
  const input = field.querySelector("input");
  const sync = () => {
    const shouldShow = select.value === "yes";
    field.hidden = !shouldShow;
    if (input) {
      input.required = shouldShow;
      if (shouldShow && !input.value.trim() && mePageState.user?.phone) {
        input.value = mePageState.user.phone;
      }
    }
  };
  select.addEventListener("change", sync);
  select.dataset.bound = "true";
  sync();
}

function bindMinRegistrationToggle(form) {
  const select = qs("[data-min-registration-toggle]", form);
  if (!select) return;
  const fields = qsa("[data-min-registration-field]", form);
  const countInput = form.minRegistrationCount;
  const deadlineInput = form.registrationDeadline;
  const sync = () => {
    const shouldShow = select.value === "yes";
    fields.forEach((field) => {
      field.hidden = !shouldShow;
      const input = field.querySelector("input, select, textarea");
      if (input) input.required = shouldShow;
    });
    if (shouldShow && deadlineInput && !deadlineInput.value && form.startsAt?.value) {
      deadlineInput.value = form.startsAt.value;
    }
    if (!shouldShow) {
      if (countInput) countInput.value = "";
      if (deadlineInput) deadlineInput.value = form.startsAt?.value || "";
    }
  };
  if (select.dataset.bound !== "true") {
    select.addEventListener("change", sync);
    form.startsAt?.addEventListener("change", () => {
      if (select.value === "yes" && deadlineInput && !deadlineInput.value) {
        deadlineInput.value = form.startsAt.value;
      }
    });
    select.dataset.bound = "true";
  }
  sync();
}

function bindTemplateSelect(form) {
  const select = qs("[data-template-select]", form);
  if (!select) return;
  select.addEventListener("change", () => {
    const templateId = select.value;
    if (!templateId) return;
    const template = (mePageState.templates || []).find((item) => item.id === templateId);
    if (!template) return;
    const current = window.youkongRichEditor?.sync(form) || form.description.value || "";
    if (hasMeaningfulRichText(current) && !confirm("是否覆盖当前活动描述？")) {
      select.value = "";
      return;
    }
    window.youkongRichEditor?.setHtml(form, template.content || "");
    form.description.value = template.content || "";
    showToast("模板已应用");
  });
}

async function loadTurnstileScript() {
  if (window.turnstile) return window.turnstile;
  if (loadTurnstileScript.promise) return loadTurnstileScript.promise;
  loadTurnstileScript.promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => reject(new Error("Turnstile 加载失败，请稍后再试"));
    document.head.append(script);
  });
  return loadTurnstileScript.promise;
}

async function initTurnstileForForm(form) {
  try {
    const { turnstile } = await api.get("/api/safety/client-config");
    if (!turnstile?.enabled || !turnstile.siteKey) return null;
    const box = document.createElement("div");
    box.className = "turnstile-box";
    box.setAttribute("aria-hidden", "true");
    form.append(box);
    await loadTurnstileScript();
    const state = { token: "", resolver: null, rejecter: null };
    state.widgetId = window.turnstile.render(box, {
      sitekey: turnstile.siteKey,
      size: "invisible",
      callback: (token) => {
        state.token = token;
        state.resolver?.(token);
      },
      "error-callback": () => {
        state.rejecter?.(new Error("人机验证暂时没有通过，请刷新页面后重试。"));
      },
    });
    form.youkongTurnstile = state;
    return state;
  } catch {
    return null;
  }
}

async function getTurnstileToken(form) {
  const state = form.youkongTurnstile;
  if (!state || !window.turnstile) return "";
  if (state.token) return state.token;
  return new Promise((resolve, reject) => {
    state.resolver = resolve;
    state.rejecter = reject;
    window.turnstile.execute(state.widgetId);
  });
}

function resetActivityForm(form) {
  mePageState.editingActivity = null;
  form.reset();
  form.initiator.value = mePageState.user ? mePageState.user.nickname : "";
  if (form.showInitiatorContact) form.showInitiatorContact.value = "no";
  if (form.initiatorContact) form.initiatorContact.value = mePageState.user?.phone || "";
  bindInitiatorContactToggle(form);
  if (form.showRegistrationNames) form.showRegistrationNames.value = "no";
  if (form.showFeedbacks) form.showFeedbacks.value = "yes";
  if (form.sourceType) form.sourceType.value = "living_room";
  if (form.friendId) form.friendId.value = "";
  bindSourceTypeToggle(form);
  if (form.minRegistrationEnabled) form.minRegistrationEnabled.value = "no";
  if (form.minRegistrationCount) form.minRegistrationCount.value = "";
  if (form.registrationDeadline) form.registrationDeadline.value = "";
  bindMinRegistrationToggle(form);
  qs("[data-initiator-contact-field]", form)?.setAttribute("hidden", "");
  qsa("[data-min-registration-field]", form).forEach((field) => field.setAttribute("hidden", ""));
  if (form.collaboratorId) form.collaboratorId.value = "";
  const templateSelect = qs("[data-template-select]", form);
  if (templateSelect) templateSelect.value = "";
  window.youkongRichEditor?.reset(form);
  qs("[data-activity-form-title]", form)?.replaceChildren(document.createTextNode("添加活动"));
  qs("[data-activity-submit]", form).textContent = "发布活动";
  qs("[data-cancel-edit]", form).hidden = true;
}

function fillActivityForm(form, activity) {
  mePageState.editingActivity = activity;
  form.moduleId.value = activity.moduleId;
  form.title.value = activity.title;
  form.initiator.value = activity.initiator;
  if (form.showInitiatorContact) form.showInitiatorContact.value = activity.showInitiatorContact ? "yes" : "no";
  if (form.initiatorContact) form.initiatorContact.value = activity.initiatorContact || mePageState.user?.phone || "";
  bindInitiatorContactToggle(form);
  form.startsAt.value = toDatetimeLocal(activity.startsAt);
  if (form.endsAt) form.endsAt.value = toDatetimeLocal(activity.endsAt);
  form.location.value = activity.location;
  form.capacity.value = activity.capacity || "";
  if (form.showRegistrationNames) form.showRegistrationNames.value = activity.showRegistrationNames ? "yes" : "no";
  if (form.showFeedbacks) form.showFeedbacks.value = activity.showFeedbacks === false ? "no" : "yes";
  if (form.sourceType) form.sourceType.value = activity.sourceType === "friend" ? "friend" : "living_room";
  if (form.friendId) form.friendId.value = activity.friendId || "";
  bindSourceTypeToggle(form);
  if (form.minRegistrationEnabled) form.minRegistrationEnabled.value = activity.minRegistrationEnabled ? "yes" : "no";
  if (form.minRegistrationCount) form.minRegistrationCount.value = activity.minRegistrationCount || "";
  if (form.registrationDeadline) form.registrationDeadline.value = toDatetimeLocal(activity.registrationDeadline || activity.startsAt);
  bindMinRegistrationToggle(form);
  form.collaboratorId.value = activity.collaboratorId || "";
  form.description.value = activity.description || "";
  window.youkongRichEditor?.setHtml(form, activity.description || "");
  form.cover.value = "";
  qs("[data-activity-form-title]", form)?.replaceChildren(document.createTextNode("编辑活动"));
  qs("[data-activity-submit]", form).textContent = "发布活动";
  qs("[data-cancel-edit]", form).hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function canEditMine(activity) {
  return ["draft", "returned"].includes(activity.status);
}

function canWithdraw(activity) {
  return ["analysis_pending", "admin_review", "collaborator_review", "published", "full"].includes(activity.status);
}

function resetPagedState(key) {
  const pageKeys = {
    myActivities: "myActivityPage",
    adminActivities: "adminActivityPage",
    users: "userPage",
    modulesPageItems: "modulePage",
    templates: "templatePage",
    logs: "logPage",
    reports: "reportPage",
    friends: "friendPage",
    feedbacks: "feedbackPage",
    activityFeedbacks: "activityFeedbackPage",
    myRegistrations: "myRegistrationPage",
    myFeedbacks: "myFeedbackPage",
    publicActivities: "publicActivityPage",
    trustProfiles: "userPage",
    aiPrompts: "templatePage",
    trustPolicies: "trustPolicyPage",
    badges: "badgePage",
    badgePolicies: "badgePolicyPage",
  };
  const pageKey = pageKeys[key];
  if (Object.prototype.hasOwnProperty.call(mePageState, pageKey)) {
    mePageState[pageKey] = 1;
  }
  if (Array.isArray(mePageState[key])) {
    mePageState[key] = [];
  }
}

async function initPublicActivitiesPage() {
  const root = qs("[data-public-activities-page]");
  if (!root) return;
  const params = new URLSearchParams(location.search);
  const view = params.get("view") === "history" ? "history" : "upcoming";
  root.dataset.activityView = view;
  qs("[data-public-activity-title]", root).textContent = view === "history" ? "历史活动" : "近期活动";
  qs("[data-public-activity-subtitle]", root).textContent = view === "history"
    ? "这些活动已经结束，可以回看客厅里发生过的事。"
    : "这里显示已经发布、还没有结束的活动。未登录也可以点进活动页报名。";
  qsa("[data-public-activity-tab]", root).forEach((link) => {
    link.classList.toggle("active", link.dataset.publicActivityTab === view);
  });
  qsa("[data-public-source-tab]", root).forEach((link) => {
    const sourceType = params.get("sourceType") || "";
    link.classList.toggle("active", (link.dataset.publicSourceTab || "") === sourceType);
  });
  const sourceTabs = qs(".history-source-tabs", root);
  if (sourceTabs) sourceTabs.hidden = view !== "history";
  qs("[data-load-more-public-activities]", root)?.addEventListener("click", () => {
    mePageState.publicActivityPage += 1;
    renderPublicActivities();
  });
  await renderPublicActivities();
}

async function renderPublicActivities() {
  const root = qs("[data-public-activities-page]");
  const list = qs("[data-public-activities]");
  if (!root || !list) return;
  const view = root.dataset.activityView === "history" ? "history" : "upcoming";
  const params = new URLSearchParams({
    view,
    page: String(mePageState.publicActivityPage),
    pageSize: String(mePageState.pageSize),
    sort: view === "history" ? "start-desc" : "start-asc",
  });
  const urlParams = new URLSearchParams(location.search);
  const sourceType = urlParams.get("sourceType") || "";
  if (view === "history" && sourceType) params.set("sourceType", sourceType);
  const { activities, pageInfo } = await api.get(`/api/activities?${params.toString()}`);
  const loaded = mergePageItems("publicActivities", mePageState.publicActivityPage, activities);
  updatePagedCount(qs("[data-public-activity-count]"), loaded.length, pageInfo);
  updateLoadMore(qs("[data-load-more-public-activities]"), loaded.length, pageInfo?.total || loaded.length);
  if (!loaded.length) {
    list.innerHTML = view === "history"
      ? `<div class="empty-state"><strong>还没有历史活动</strong><p>活动结束后会自动归档到这里。</p></div>`
      : `<div class="empty-state"><strong>近期公告栏暂时空着</strong><p>等活动发布后，这里会第一时间出现。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  list.innerHTML = loaded.map(renderActivityCard).join("");
  bindActivityInterestActions(list);
  revealDynamicContent(list);
}

function mergePageItems(key, page, items) {
  const existing = page <= 1 ? [] : (mePageState[key] || []);
  const seen = new Set(existing.map((item) => item.id));
  const merged = [
    ...existing,
    ...items.filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }),
  ];
  mePageState[key] = merged;
  return merged;
}

async function initMyActivitiesPage() {
  const root = qs("[data-my-activities-page]");
  if (!root) return;
  const user = await getOptionalUser();
  mePageState.user = user;
  const filters = qs("[data-my-activity-filters]", root);
  fillStatusSelect(filters?.status);
  applyQueryToForm(filters, ["q", "status", "from", "to", "sort"]);
  filters?.addEventListener("submit", (event) => {
    event.preventDefault();
    resetPagedState("myActivities");
    renderMineActivities();
  });
  qs("[data-load-more-my-activities]", root)?.addEventListener("click", () => {
    mePageState.myActivityPage += 1;
    renderMineActivities();
  });
  await renderMineActivities();
}

async function renderMineActivities() {
  const list = qs("[data-my-activities]");
  if (!list) return;
  const filters = qs("[data-my-activity-filters]");
  const query = queryFromForm(filters, {
    owner: "me",
    page: mePageState.myActivityPage,
    pageSize: mePageState.pageSize,
  });
  const { activities, pageInfo } = await api.get(`/api/activities${query}`);
  const loaded = mergePageItems("myActivities", mePageState.myActivityPage, activities);
  updatePagedCount(qs("[data-my-activity-count]"), loaded.length, pageInfo);
  updateLoadMore(qs("[data-load-more-my-activities]"), loaded.length, pageInfo?.total || loaded.length);

  if (!loaded.length) {
    list.innerHTML = `<div class="empty-state"><strong>还没有发起过活动</strong><p>写下一个小想法，客厅就多一张新纸条。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  list.innerHTML = loaded
    .map(
      (activity) => `
        <article class="event-row">
          <div>
            <div class="tag-row"><span class="tag">${escapeHtml(activity.moduleName)}</span><span class="tag soft">${escapeHtml(activity.sourceName || activity.sourceLabel || "客厅")}</span></div>
            <h3><a href="activity.html?id=${activity.id}">${escapeHtml(activity.title)}</a></h3>
            <p>${formatActivityTime(activity)} · ${escapeHtml(activity.location)} · ${escapeHtml(activity.statusLabel)} · ${escapeHtml(activity.reviewStepLabel)} · ${activity.registrationCount} 人报名 · ${Number(activity.feedbackCount || 0)} 条反馈</p>
            <p>协作员：${escapeHtml(activity.collaboratorName || "未选择")}</p>
          </div>
          <div class="row-actions">
            ${canEditMine(activity) ? `<a class="button outline" href="activity-editor.html?id=${encodeURIComponent(activity.id)}">编辑</a>` : ""}
            ${canWithdraw(activity) ? `<button class="button outline danger-soft" type="button" data-withdraw-activity-id="${activity.id}">撤回</button>` : ""}
            ${canViewRegistrations(activity) ? `<a class="button outline" href="registrations.html?id=${encodeURIComponent(activity.id)}">查看报名表</a>` : ""}
            <a class="button outline" href="activity-feedback.html?id=${encodeURIComponent(activity.id)}">活动反馈</a>
          </div>
        </article>
      `
    )
    .join("");
  revealDynamicContent(list);

  qsa("[data-withdraw-activity-id]", list).forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("确定撤回这个活动吗？撤回后会变成草稿。")) return;
      await api.post(`/api/activities/${button.dataset.withdrawActivityId}/withdraw`, {});
      showToast("保存成功");
      resetPagedState("myActivities");
      await renderMineActivities();
    });
  });
}

function canViewRegistrations(activity) {
  return Boolean(activity.publishedAt)
    || Number(activity.registrationCount || 0) > 0
    || ["published", "full", "cancelled", "not_formed_cancelled", "ended"].includes(activity.status);
}

function queryFromForm(form, extra = {}) {
  const params = new URLSearchParams();
  if (form) {
    new FormData(form).forEach((value, key) => {
      const text = String(value || "").trim();
      if (text) params.set(key, text);
    });
  }
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

function applyQueryToForm(form, fields = []) {
  if (!form) return;
  const params = new URLSearchParams(location.search);
  fields.forEach((field) => {
    if (!params.has(field) || !form.elements[field]) return;
    form.elements[field].value = params.get(field) || "";
  });
}

function updatePagedCount(element, visible, pageInfo) {
  if (!element) return;
  const total = pageInfo?.total ?? visible;
  element.textContent = `显示 ${visible} 条，共 ${total} 条`;
}

function updateLoadMore(button, visible, total) {
  if (!button) return;
  button.hidden = visible >= total;
  button.textContent = `再加载 ${Math.min(12, total - visible)} 条`;
}

async function renderMyPendingTasks() {
  const panel = qs("[data-my-pending]");
  if (!panel) return;
  const user = mePageState.user || await getOptionalUser();
  const [{ activities }, feedbackResult] = await Promise.all([
    api.get("/api/activities?pending=me"),
    hasPermission(user, "feedbacks", "view")
      ? api.get("/api/feedbacks?status=admin_review&page=1&pageSize=12")
      : Promise.resolve({ feedbacks: [] }),
  ]);
  renderPendingTasks(panel, activities, {
    feedbacks: feedbackResult.feedbacks || [],
    onRefresh: renderMyPendingTasks,
  });
}

async function initReviewTasksPage() {
  const root = qs("[data-review-tasks-root]");
  if (!root) return;
  const user = await requireCurrentUser();
  if (!user) return;
  mePageState.user = user;
  if (!hasPermission(user, "reviewTasks", "view") && !hasPermission(user, "activities", "review") && !hasPermission(user, "feedbacks", "view")) {
    root.innerHTML = `<section class="section"><div class="wrap"><div class="empty-state"><strong>暂无审核权限</strong><p>当前角色没有待办查看或复核权限。</p></div></div></section>`;
    return;
  }
  await renderMyPendingTasks();
}

function canRegisterActivity(activity) {
  return activity.status === "published" && !activity.registrationDeadlinePassed;
}

async function initRegistrationsPage() {
  const root = qs("[data-registrations-page]");
  if (!root) return;
  const user = await getOptionalUser();
  mePageState.user = user;
  const id = new URLSearchParams(location.search).get("id");
  const title = qs("[data-registration-title]", root);
  const summary = qs("[data-registration-summary]", root);
  const list = qs("[data-registration-list]", root);
  const exportButton = qs("[data-export-registrations]", root);
  if (!id) {
    list.innerHTML = `<div class="empty-state"><strong>缺少活动 ID</strong><p>请从「我的活动」或「全部活动」进入报名表。</p></div>`;
    return;
  }
  try {
    const [{ activity }, { registrations }] = await Promise.all([
      api.get(`/api/activities/${id}`),
      api.get(`/api/activities/${id}/registrations`),
    ]);
    title.textContent = activity.title;
    summary.textContent = `${activity.moduleName} · ${formatActivityTime(activity)} · ${activity.location} · ${registrations.length} 人报名`;
    renderRegistrationTable(list, id, registrations);
    exportButton.hidden = !registrations.length;
    exportButton.addEventListener("click", () => {
      downloadRegistrationsCsv(activity, registrations);
    });
  } catch (error) {
    list.innerHTML = `<p class="form-message" data-type="error">${escapeHtml(error.message)}</p>`;
  }
}

function renderRegistrationTable(container, activityId, registrations) {
  if (!container) return;
  if (!registrations.length) {
    container.innerHTML = `<div class="empty-state"><strong>暂时还没人报名</strong><p>可以把活动链接发到社群里。</p></div>`;
    revealDynamicContent(container);
    return;
  }
  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>昵称</th><th>报名时间</th><th>操作</th></tr></thead>
      <tbody>
        ${registrations
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.nickname)}</td>
                <td>${formatDate(item.createdAt)}</td>
                <td><button class="table-action" type="button" data-delete-registration="${item.id}">删除</button></td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
  revealDynamicContent(container);
  qsa("[data-delete-registration]", container).forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("确定删除这条报名记录吗？")) return;
      await api.delete(`/api/activities/${activityId}/registrations/${button.dataset.deleteRegistration}`);
      showToast("删除成功");
      location.reload();
    });
  });
}

function escapeCsv(value = "") {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadRegistrationsCsv(activity, registrations) {
  const rows = [
    ["活动标题", "昵称", "报名时间"],
    ...registrations.map((item) => [activity.title, item.nickname, item.createdAt]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${activity.title || "有空报名表"}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function initActivityPage() {
  const root = qs("[data-activity-detail]");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    root.innerHTML = `<div class="empty-state"><strong>缺少活动 ID</strong><p>请从活动列表进入。</p></div>`;
    return;
  }

  const { activity } = await api.get(`/api/activities/${id}`);
  root.innerHTML = `
    <section class="activity-hero">
      <div>
        <div class="tag-row"><span class="tag">${escapeHtml(activity.moduleName)}</span><span class="tag soft">${escapeHtml(activity.sourceName || activity.sourceLabel || "客厅")}</span></div>
        <h1>${escapeHtml(activity.title)}</h1>
        <p>${escapeHtml(activity.location)} · ${formatActivityTime(activity)}</p>
        <div class="event-meta">
          <span>${escapeHtml(activity.statusLabel || "活动发布")}</span>
          <span>发起人：${escapeHtml(activity.initiator)}</span>
          <span>${activity.capacity ? `限额 ${activity.capacity} 人` : "人数无上限"}</span>
          <span>已报名 ${activity.registrationCount} 人</span>
          ${renderFormationMeta(activity)}
        </div>
        ${renderRiskNotice(activity)}
        ${renderInitiatorContact(activity)}
        <div class="activity-share-actions" aria-label="活动分享操作">
          <button class="button ghost" type="button" data-download-poster>下载活动邀请函</button>
          <button class="button outline" type="button" data-copy-registration-link>复制报名链接</button>
          <button class="button outline" type="button" data-download-calendar>加到日历</button>
        </div>
      </div>
      ${
        activity.coverUrl
          ? `<img class="activity-hero-cover" src="${escapeHtml(activity.coverUrl)}" alt="${escapeHtml(activity.title)}" />`
          : `<div class="activity-hero-cover placeholder">${escapeHtml(activity.moduleName)}</div>`
      }
    </section>
    <section class="section tight">
      <div class="wrap activity-layout">
        <article class="article-content">${descriptionToHtml(activity.description)}</article>
        ${
          canRegisterActivity(activity)
            ? `<aside class="form-note">
                <h3>报名这个活动</h3>
                ${renderActivityFormationPanel(activity)}
                <form data-register-form>
                  <label for="nickname">昵称</label>
                  <input id="nickname" name="nickname" required />
                  <button class="button primary" type="submit">提交报名</button>
                  <p class="form-message" data-register-message></p>
                </form>
                ${renderCommunityReportBox(activity)}
              </aside>`
            : `<aside class="form-note">
                <h3>暂不开放报名</h3>
                ${renderActivityFormationPanel(activity)}
                <p class="muted-text">${registrationClosedText(activity)}</p>
                ${renderCommunityReportBox(activity)}
              </aside>`
        }
      </div>
    </section>
    ${renderPublicRegistrationNames(activity)}
    ${renderPublicFeedbacks(activity)}
  `;
  revealDynamicContent(root);
  window.youkongActivityShare?.mount(root, activity, {
    showToast,
    formatActivityTime,
    getInvitee: () => {
      const form = qs("[data-register-form]", root);
      return {
        nickname: form?.nickname?.value || "",
      };
    },
  });

  const reportForm = qs("[data-report-form]", root);
  reportForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const reportMessage = qs("[data-report-message]", reportForm);
    setMessage(reportMessage, "正在提交社区反馈...");
    try {
      await api.post(`/api/activities/${id}/reports`, {
        reason: reportForm.reason.value,
        detail: reportForm.detail.value,
      });
      reportForm.reset();
      setMessage(reportMessage, "已经收到。社区会把这些反馈纳入风险提示，不会因为一次反馈就直接删除内容。", "success");
      showToast("反馈已提交");
    } catch (error) {
      setMessage(reportMessage, error.message, "error");
    }
  });

  const form = qs("[data-register-form]");
  if (!form) return;
  const message = qs("[data-register-message]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(message, "正在报名...");
    try {
      const { registration, accessToken } = await api.post(`/api/activities/${id}/register`, {
        nickname: form.nickname.value,
      });
      const token = accessToken || registration.accessToken || "";
      saveRegistrationToken(id, registration.id, token);
      const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : "";
      location.href = `success.html?activity=${encodeURIComponent(id)}&registration=${encodeURIComponent(registration.id)}${tokenQuery}`;
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

async function initSuccessPage() {
  const root = qs("[data-success-detail]");
  if (!root) return;
  const params = new URLSearchParams(location.search);
  const activityId = params.get("activity");
  const registrationId = params.get("registration");
  const registrationToken = params.get("token") || "";
  if (!activityId || !registrationId || !registrationToken) {
    root.innerHTML = `<div class="empty-state"><strong>缺少报名信息</strong><p>请从活动详情页重新报名。</p></div>`;
    return;
  }

  try {
    const { activity, registration } = await api.get(`/api/activities/${activityId}/registrations/${registrationId}?token=${encodeURIComponent(registrationToken)}`);
    root.innerHTML = `
      <section class="success-hero">
        <div class="wrap success-card">
          <p class="eyebrow">报名成功</p>
          <h1>来客厅见。</h1>
          <p>你的报名已经记录下来，可以把这个页面留作确认信息。</p>
          <div class="success-grid">
            <div>
              <span>活动</span>
              <strong>${escapeHtml(activity.title)}</strong>
              <p>${escapeHtml(activity.location)} · ${formatActivityTime(activity)}</p>
            </div>
            <div>
              <span>报名人</span>
              <strong>${escapeHtml(registration.nickname)}</strong>
              <p>已记录昵称</p>
            </div>
          </div>
          <div class="button-row">
            <a class="button primary" href="activity.html?id=${encodeURIComponent(activity.id)}">查看活动</a>
            <button class="button ghost" type="button" data-download-poster>下载活动邀请函</button>
            <button class="button outline danger-soft" type="button" data-cancel-registration>取消报名</button>
            <a class="button ghost" href="participate.html">看看其他活动</a>
          </div>
        </div>
      </section>
    `;
    revealDynamicContent(root);
    window.youkongActivityShare?.mount(root, activity, {
      showToast,
      formatActivityTime,
      registration,
    });
    qs("[data-cancel-registration]", root)?.addEventListener("click", async () => {
      if (!confirm("确定取消这次报名吗？取消后如需参加，需要重新报名。")) return;
      await api.post(`/api/activities/${activityId}/registrations/${registrationId}/cancel`, { token: registrationToken });
      showToast("取消成功");
      root.innerHTML = `
        <section class="success-hero">
          <div class="wrap success-card">
            <p class="eyebrow">已取消报名</p>
            <h1>这次先留白。</h1>
            <p>你的报名记录已经取消，之后想来还可以重新报名。</p>
            <div class="button-row">
              <a class="button primary" href="activity.html?id=${encodeURIComponent(activity.id)}">回到活动</a>
              <a class="button ghost" href="participate.html">看看其他活动</a>
            </div>
          </div>
        </section>
      `;
      revealDynamicContent(root);
    });
  } catch (error) {
    root.innerHTML = `
      <section class="success-hero">
        <div class="wrap success-card">
          <p class="eyebrow">报名确认</p>
          <h1>暂时没读到报名信息。</h1>
          <p>${escapeHtml(error.message)}</p>
          <div class="button-row">
            <a class="button primary" href="participate.html">回到活动列表</a>
            <a class="button ghost" href="about.html">联系有空客厅</a>
          </div>
        </div>
      </section>
    `;
    revealDynamicContent(root);
  }
}

async function initAdminPage() {
  const adminRoot = qs("[data-admin-dashboard]");
  if (!adminRoot) return;
  const user = await requireAdminUser(adminRoot, "dashboard", "view");
  if (!user) return;

  const dashboard = await api.get("/api/dashboard/admin");
  renderAdminDashboardCards(adminRoot, dashboard.activities, dashboard.users, dashboard.modules, dashboard.templates, dashboard.pending, dashboard.friends, dashboard.feedbacks, dashboard.roles);
  const canSeePending = hasPermission(user, "reviewTasks", "view") || hasPermission(user, "activities", "review") || hasPermission(user, "feedbacks", "view");
  const pendingPanel = qs("[data-admin-pending]", adminRoot);
  const pendingSection = pendingPanel?.closest(".section");
  if (pendingSection) pendingSection.hidden = !canSeePending;
  if (canSeePending) {
    renderPendingTasks(pendingPanel, (dashboard.pending?.activities || []).slice(0, 4), {
      compact: true,
      feedbacks: (dashboard.pending?.feedbacks || []).slice(0, 4),
      onRefresh: initAdminPage,
    });
  }
}

async function requireAdminUser(root, moduleKey = "dashboard", action = "view") {
  const user = await requireCurrentUser();
  if (!user) return null;
  if (!hasPermission(user, moduleKey, action)) {
    if (root) {
      root.innerHTML = `<section class="section"><div class="wrap"><div class="empty-state"><strong>当前角色暂无权限</strong><p>请联系有空管理员调整角色权限后再进入这个模块。</p></div></div></section>`;
    }
    return null;
  }
  mePageState.user = user;
  return user;
}

function renderAdminDashboardCards(root, activitiesSummary, usersSummary, modulesSummary, templatesSummary, pendingSummary, friendsSummary, feedbackSummary, rolesSummary) {
  const container = qs("[data-admin-dashboard-cards]", root);
  if (!container) return;
  container.classList.add("admin-module-groups");
  const user = mePageState.user || getCachedUser();
  const counts = activitiesSummary?.byStatus || {};
  const reviewing = Number(activitiesSummary?.reviewing ?? ((counts.admin_review || 0) + (counts.collaborator_review || 0)));
  const activityTotal = Number(activitiesSummary?.total || 0);
  const userTotal = Number(usersSummary?.total || 0);
  const roleTotal = Number(rolesSummary?.total || 0);
  const moduleTotal = Number(modulesSummary?.total || 0);
  const templateTotal = Number(templatesSummary?.total || 0);
  const friendTotal = Number(friendsSummary?.total || 0);
  const feedbackPending = Number(feedbackSummary?.pendingReview || 0);
  const pendingTotal = Number(pendingSummary?.total || 0);
  const groups = [
    {
      title: "待办",
      body: "先处理会影响公开展示和社区安全的事项。",
      cards: [
        {
          href: "review-tasks.html",
          label: "审核待办",
          title: "活动与反馈复核",
          body: "管理员处理活动复核和匿名反馈复核，协作员仍只处理活动审核。",
          meta: `活动 ${pendingSummary?.activityTotal ?? pendingTotal - feedbackPending} / 反馈 ${feedbackPending}`,
          count: pendingTotal,
          icon: "todo",
          permissionAny: [["reviewTasks", "view"], ["activities", "review"], ["feedbacks", "view"]],
        },
      ],
    },
    {
      title: "活动运营",
      body: "活动内容、来源、模块和反馈沉淀放在这里。",
      cards: [
        {
          href: "admin-activities.html",
          label: "全部活动",
          title: "筛选和查看所有状态活动",
          body: "按标题、模块、状态、时间和报名数管理。",
          meta: `${reviewing} 个审核中`,
          count: activityTotal,
          icon: "activity",
          permission: ["activities", "view"],
        },
        {
          href: "admin-modules.html",
          label: "模块管理",
          title: "维护活动分类模块",
          body: "管理有空放映、有空食堂等分类。",
          meta: "活动分类",
          count: moduleTotal,
          icon: "grid",
          permission: ["modules", "view"],
        },
        {
          href: "admin-templates.html",
          label: "活动模板",
          title: "维护活动描述模板",
          body: "给放映、食堂、夜校等活动准备可复用正文。",
          meta: "描述模板",
          count: templateTotal,
          icon: "template",
          permission: ["templates", "view"],
        },
        {
          href: "admin-friends.html",
          label: "客厅的朋友们",
          title: "维护朋友主体",
          body: "名称、简介、Logo、地址、联系人和启用状态。",
          meta: "活动来源",
          count: friendTotal,
          icon: "friend",
          permission: ["friends", "view"],
        },
        {
          href: "admin-feedbacks.html",
          label: "活动反馈",
          title: "查看和审核匿名反馈",
          body: "AI 会先判断是否适合展示，管理员可兜底决定。",
          meta: "待审核反馈",
          count: feedbackPending,
          icon: "feedback",
          permission: ["feedbacks", "view"],
        },
      ],
    },
    {
      title: "社区治理",
      body: "举报、信用、徽章这些长期自治能力集中查看。",
      cards: [
        {
          href: "admin-reports.html",
          label: "社区举报",
          title: "查看活动举报和分析结论",
          body: "每条举报都会记录原因、AI/规则复核结果和活动后续流转。",
          meta: "社区举报",
          count: "举报",
          icon: "report",
          permission: ["reports", "view"],
        },
        {
          href: "admin-trust.html",
          label: "社区信用",
          title: "查看匿名身份信用时间线",
          body: "观察社区信用、社区等级、身份状态和事件来源。",
          meta: "社区信用",
          count: "信用",
          icon: "trust",
          permission: ["trust", "view"],
        },
        {
          href: "admin-trust-policy.html",
          label: "信用策略",
          title: "配置社区信用变动规则",
          body: "用策略定义活动置信度、报名、反馈和举报如何影响信用。",
          meta: "信用策略",
          count: "策略",
          icon: "policy",
          permission: ["trustPolicy", "view"],
        },
        {
          href: "admin-badges.html",
          label: "社区徽章",
          title: "维护社区贡献的可视表达",
          body: "管理身份徽章、成就徽章和事件徽章。",
          meta: "社区徽章",
          count: "徽章",
          icon: "badge",
          permission: ["badges", "view"],
        },
        {
          href: "admin-badge-policy.html",
          label: "徽章展示",
          title: "配置徽章展示策略",
          body: "决定徽章是否公开，以及展示在哪些页面和位置。",
          meta: "展示策略",
          count: "展示",
          icon: "eye",
          permission: ["badgePolicy", "view"],
        },
      ],
    },
    {
      title: "安全与智能",
      body: "开放发布背后的规则、AI 和风险解释。",
      cards: [
        {
          href: "admin-safety.html",
          label: "规则引擎",
          title: "配置开放发布的风险规则",
          body: "调整敏感词、URL、格式异常等规则分值和策略阈值。",
          meta: "规则引擎",
          count: "规则",
          icon: "rules",
          permission: ["safety", "view"],
        },
        {
          href: "admin-ai.html",
          label: "AI 分析",
          title: "管理可插拔 AI 分析引擎",
          body: "开启或关闭 AI，配置 Provider、Prompt、能力和调用策略。",
          meta: "观察员",
          count: "AI",
          icon: "ai",
          permission: ["ai", "view"],
        },
      ],
    },
    {
      title: "用户与权限",
      body: "谁能进入后台，以及每个角色能访问哪些模块。",
      cards: [
        {
          href: "admin-members.html",
          label: "用户管理",
          title: "管理用户和登录手机号",
          body: "添加、搜索、修改、删除可登录后台的人，并给每个人选择一个角色。",
          meta: "用户角色",
          count: userTotal,
          icon: "people",
          permission: ["users", "view"],
        },
        {
          href: "admin-roles.html",
          label: "角色权限",
          title: "配置角色能做什么",
          body: "新增角色，并按模块和动作配置查看、新增、编辑、删除、审核、导出等权限。",
          meta: "角色权限",
          count: roleTotal,
          icon: "key",
          permission: ["roles", "view"],
        },
      ],
    },
    {
      title: "系统维护",
      body: "操作记录和系统留痕集中查看。",
      cards: [
        {
          href: "admin-logs.html",
          label: "操作日志",
          title: "查看系统里的关键动作",
          body: "新增、保存、删除、提交、审核、撤回都会留下记录。",
          meta: "审计记录",
          count: "Log",
          icon: "logs",
          permission: ["logs", "view"],
        },
      ],
    },
  ];
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      cards: group.cards.filter((card) => {
        if (Array.isArray(card.permissionAny)) {
          return card.permissionAny.some(([moduleKey, action = "view"]) => hasPermission(user, moduleKey, action));
        }
        const [moduleKey, action = "view"] = card.permission || [];
        return !moduleKey || hasPermission(user, moduleKey, action);
      }),
    }))
    .filter((group) => group.cards.length);
  container.innerHTML = visibleGroups.map((group) => `
    <section class="admin-module-group">
      <div class="admin-module-group-head">
        <div>
          <h3>${escapeHtml(group.title)}</h3>
          <p>${escapeHtml(group.body)}</p>
        </div>
        <span>${group.cards.length} 个入口</span>
      </div>
      <div class="workspace-grid admin-module-grid">
        ${group.cards.map(renderWorkspaceCard).join("")}
      </div>
    </section>
  `).join("");
  revealDynamicContent(container);
}

function jsonText(value, fallback = {}) {
  try {
    return JSON.stringify(value ?? fallback, null, 2);
  } catch {
    return JSON.stringify(fallback, null, 2);
  }
}

function parseAdminJsonField(value, fallback) {
  try {
    return JSON.parse(value || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

async function initAdminGovernancePage() {
  const root = qs("[data-admin-governance-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "trust", "view");
  if (!user) return;
  const { overview } = await api.get("/api/governance/overview");
  const cards = [
    {
      href: "admin-trust.html",
      label: "社区信用",
      title: "查看社区身份和信用时间线",
      body: "每个匿名身份的信用变化都来自可追溯事件。",
      meta: "社区身份",
      count: overview.identities?.total || 0,
    },
    {
      href: "admin-trust-policy.html",
      label: "信用策略",
      title: "配置信用变化策略",
      body: "用事件类型、条件和 trustDelta 映射长期信任。",
      meta: "策略规则",
      count: overview.trustPolicies?.total || 0,
    },
    {
      href: "admin-badges.html",
      label: "社区徽章",
      title: "配置社区徽章",
      body: "徽章依据社区信用、活动次数等条件自动授予。",
      meta: "可配置徽章",
      count: overview.badges?.total || 0,
    },
    {
      href: "admin-badge-policy.html",
      label: "徽章展示策略",
      title: "配置徽章展示位置",
      body: "决定徽章公开展示还是仅后台可见。",
      meta: "展示策略",
      count: "展示",
    },
    {
      href: "admin-ai.html",
      label: "AI 分析",
      title: "AI 作为社区观察员",
      body: "AI 输出分析报告，不直接处罚或删除内容。",
      meta: "观察员",
      count: "AI",
    },
    {
      href: "admin-safety.html",
      label: "规则引擎",
      title: "开放发布前的风险规则",
      body: "规则引擎给活动置信度提供基准分。",
      meta: "风险规则",
      count: "规则",
    },
  ];
  qs("[data-governance-cards]", root).innerHTML = cards.map(renderWorkspaceCard).join("");
  revealDynamicContent(qs("[data-governance-cards]", root));
}

function trustPolicyPayload(form) {
  return {
    name: form.name.value,
    eventType: form.eventType.value,
    enabled: form.enabled.value,
    order: form.order.value,
    conditionMode: form.conditionMode.value,
    description: form.description.value,
    conditions: parseAdminJsonField(form.conditions.value, []),
    effect: parseAdminJsonField(form.effect.value, { trustDelta: 0 }),
  };
}

function resetTrustPolicyForm(form) {
  mePageState.editingTrustPolicy = null;
  form.reset();
  form.order.value = "100";
  form.conditions.value = "[]";
  form.effect.value = "{\"trustDelta\":0}";
  qs("[data-trust-policy-submit]", form).textContent = "保存策略";
}

function fillTrustPolicyForm(form, policy) {
  mePageState.editingTrustPolicy = policy;
  form.name.value = policy.name || "";
  form.eventType.value = policy.eventType || "";
  form.enabled.value = policy.enabled === false ? "false" : "true";
  form.order.value = policy.order || 100;
  form.conditionMode.value = policy.conditionMode || "all";
  form.description.value = policy.description || "";
  form.conditions.value = jsonText(policy.conditions || [], []);
  form.effect.value = jsonText(policy.effect || { trustDelta: 0 }, { trustDelta: 0 });
  qs("[data-trust-policy-submit]", form).textContent = "保存修改";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function initAdminTrustPolicyPage() {
  const root = qs("[data-admin-trust-policy-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "trustPolicy", "view");
  if (!user) return;
  const form = qs("[data-trust-policy-form]", root);
  const message = qs("[data-trust-policy-message]", root);
  if (form?.closest(".form-note")) form.closest(".form-note").hidden = !hasPermission(user, "trustPolicy", "create") && !hasPermission(user, "trustPolicy", "edit");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const editing = mePageState.editingTrustPolicy;
      const payload = trustPolicyPayload(form);
      editing
        ? await api.put(`/api/governance/trust-policies/${editing.id}`, payload)
        : await api.post("/api/governance/trust-policies", payload);
      resetTrustPolicyForm(form);
      setMessage(message, "信用策略已保存。", "success");
      showToast("保存成功");
      await renderTrustPolicies();
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
  qs("[data-trust-policy-reset]", form)?.addEventListener("click", () => resetTrustPolicyForm(form));
  await renderTrustPolicies();
}

async function renderTrustPolicies() {
  const list = qs("[data-trust-policy-list]");
  if (!list) return;
  const { policies, pageInfo } = await api.get("/api/governance/trust-policies?page=1&pageSize=100");
  mePageState.trustPolicies = policies;
  updatePagedCount(qs("[data-trust-policy-count]"), policies.length, pageInfo);
  if (!policies.length) {
    list.innerHTML = `<div class="empty-state"><strong>还没有信用策略</strong><p>可以先新增一条 activity.confidence.evaluated 策略。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  const user = mePageState.user || getCachedUser();
  list.innerHTML = policies.map((policy) => `
    <article class="event-row" data-trust-policy-id="${policy.id}">
      <div>
        <span class="tag">${policy.enabled === false ? "停用" : "启用"} · ${escapeHtml(policy.eventType)}</span>
        <h3>${escapeHtml(policy.name)}</h3>
        <p>${escapeHtml(policy.description || "暂无说明")}</p>
        <p>排序 ${Number(policy.order || 0)} · trustDelta ${Number(policy.effect?.trustDelta || 0) > 0 ? "+" : ""}${Number(policy.effect?.trustDelta || 0)}</p>
        <details class="review-detail"><summary>查看条件</summary><pre>${escapeHtml(jsonText(policy.conditions || [], []))}</pre></details>
      </div>
      <div class="row-actions">
        <button class="button outline" type="button" data-edit-trust-policy ${hasPermission(user, "trustPolicy", "edit") ? "" : "disabled"}>编辑</button>
        <button class="button outline danger-soft" type="button" data-delete-trust-policy ${hasPermission(user, "trustPolicy", "delete") ? "" : "disabled"}>删除</button>
      </div>
    </article>
  `).join("");
  revealDynamicContent(list);
  qsa("[data-trust-policy-id]", list).forEach((row) => {
    const policy = policies.find((item) => item.id === row.dataset.trustPolicyId);
    qs("[data-edit-trust-policy]", row).addEventListener("click", () => fillTrustPolicyForm(qs("[data-trust-policy-form]"), policy));
    qs("[data-delete-trust-policy]", row).addEventListener("click", async () => {
      if (!confirm("确定删除这条社区信用策略吗？")) return;
      await api.delete(`/api/governance/trust-policies/${policy.id}`);
      showToast("删除成功");
      await renderTrustPolicies();
    });
  });
}

function badgePayload(form) {
  return {
    name: form.name.value,
    type: form.type.value,
    icon: form.icon.value,
    color: form.color.value,
    enabled: form.enabled.value,
    order: form.order.value,
    description: form.description.value,
    rule: parseAdminJsonField(form.rule.value, { mode: "all", conditions: [] }),
  };
}

function resetBadgeForm(form) {
  mePageState.editingBadge = null;
  form.reset();
  form.order.value = "100";
  form.rule.value = "{\"mode\":\"all\",\"conditions\":[]}";
  qs("[data-badge-submit]", form).textContent = "保存徽章";
}

function fillBadgeForm(form, badge) {
  mePageState.editingBadge = badge;
  form.name.value = badge.name || "";
  form.type.value = badge.type || "achievement";
  form.icon.value = badge.icon || "";
  form.color.value = badge.color || "";
  form.enabled.value = badge.enabled === false ? "false" : "true";
  form.order.value = badge.order || 100;
  form.description.value = badge.description || "";
  form.rule.value = jsonText(badge.rule || { mode: "all", conditions: [] }, { mode: "all", conditions: [] });
  qs("[data-badge-submit]", form).textContent = "保存修改";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function initAdminBadgesPage() {
  const root = qs("[data-admin-badges-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "badges", "view");
  if (!user) return;
  const form = qs("[data-badge-form]", root);
  const message = qs("[data-badge-message]", root);
  if (form?.closest(".form-note")) form.closest(".form-note").hidden = !hasPermission(user, "badges", "create") && !hasPermission(user, "badges", "edit");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const editing = mePageState.editingBadge;
      const payload = badgePayload(form);
      editing
        ? await api.put(`/api/governance/badges/${editing.id}`, payload)
        : await api.post("/api/governance/badges", payload);
      resetBadgeForm(form);
      setMessage(message, "社区徽章已保存。", "success");
      showToast("保存成功");
      await renderBadges();
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
  qs("[data-badge-reset]", form)?.addEventListener("click", () => resetBadgeForm(form));
  await renderBadges();
}

async function renderBadges() {
  const list = qs("[data-badge-list]");
  if (!list) return;
  const { badges, pageInfo } = await api.get("/api/governance/badges?page=1&pageSize=100");
  mePageState.badges = badges;
  updatePagedCount(qs("[data-badge-count]"), badges.length, pageInfo);
  if (!badges.length) {
    list.innerHTML = `<div class="empty-state"><strong>还没有社区徽章</strong><p>可以先新增一个身份徽章或成就徽章。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  const user = mePageState.user || getCachedUser();
  list.innerHTML = badges.map((badge) => `
    <article class="event-row" data-badge-id="${badge.id}">
      <div>
        <span class="tag">${badge.enabled === false ? "停用" : "启用"} · ${escapeHtml(badge.type)}</span>
        <h3>${escapeHtml(badge.name)}</h3>
        <p>${escapeHtml(badge.description || "暂无说明")}</p>
        <p>图标 ${escapeHtml(badge.icon || "-")} · 颜色 ${escapeHtml(badge.color || "-")} · 排序 ${Number(badge.order || 0)}</p>
        <details class="review-detail"><summary>查看获得规则</summary><pre>${escapeHtml(jsonText(badge.rule || {}, {}))}</pre></details>
      </div>
      <div class="row-actions">
        <button class="button outline" type="button" data-edit-badge ${hasPermission(user, "badges", "edit") ? "" : "disabled"}>编辑</button>
        <button class="button outline danger-soft" type="button" data-delete-badge ${hasPermission(user, "badges", "delete") ? "" : "disabled"}>删除</button>
      </div>
    </article>
  `).join("");
  revealDynamicContent(list);
  qsa("[data-badge-id]", list).forEach((row) => {
    const badge = badges.find((item) => item.id === row.dataset.badgeId);
    qs("[data-edit-badge]", row).addEventListener("click", () => fillBadgeForm(qs("[data-badge-form]"), badge));
    qs("[data-delete-badge]", row).addEventListener("click", async () => {
      if (!confirm("确定删除这个社区徽章吗？已授予记录也会移除。")) return;
      await api.delete(`/api/governance/badges/${badge.id}`);
      showToast("删除成功");
      await renderBadges();
    });
  });
}

async function initAdminBadgePolicyPage() {
  const root = qs("[data-admin-badge-policy-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "badgePolicy", "view");
  if (!user) return;
  await renderBadgePolicies();
}

const badgeDisplayLocationLabels = {
  activityCard: "活动卡片",
  activityDetail: "活动详情",
  initiatorProfile: "发起人主页",
  registrationList: "报名列表",
  adminOnly: "仅后台",
};

function badgeDisplayLocationItems(locations = {}) {
  const keys = Object.keys(badgeDisplayLocationLabels);
  Object.keys(locations || {}).forEach((key) => {
    if (!keys.includes(key)) keys.push(key);
  });
  return keys.map((key) => ({
    key,
    label: badgeDisplayLocationLabels[key] || key,
    checked: Boolean(locations?.[key]),
  }));
}

async function renderBadgePolicies() {
  const list = qs("[data-badge-policy-list]");
  if (!list) return;
  const { policies, pageInfo } = await api.get("/api/governance/badge-policies?page=1&pageSize=100");
  mePageState.badgePolicies = policies;
  updatePagedCount(qs("[data-badge-policy-count]"), policies.length, pageInfo);
  if (!policies.length) {
    list.innerHTML = `<div class="empty-state"><strong>还没有徽章展示策略</strong><p>新增徽章后会自动生成一条仅后台可见的展示策略。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  const user = mePageState.user || getCachedUser();
  list.innerHTML = policies.map((policy) => {
    const locationItems = badgeDisplayLocationItems(policy.displayLocations || {});
    return `
    <article class="event-row badge-policy-row" data-badge-policy-id="${policy.id}">
      <div class="badge-policy-summary">
        <div class="tag-row">
          <span class="tag">${policy.enabled === false ? "停用" : "启用"}</span>
          <span class="tag soft">${policy.publicVisible ? "公开展示" : "仅后台"}</span>
        </div>
        <h3>${escapeHtml(policy.badge?.name || policy.badgeId)}</h3>
        <p>${escapeHtml(policy.tooltip || policy.badge?.description || "暂无说明")}</p>
        <small>展示策略只决定徽章在哪里出现，不改变徽章获得规则。</small>
      </div>
      <div class="badge-policy-controls" aria-label="徽章展示配置">
        <label class="badge-control-field">启用状态
          <select name="enabled">
            <option value="true" ${policy.enabled === false ? "" : "selected"}>启用</option>
            <option value="false" ${policy.enabled === false ? "selected" : ""}>停用</option>
          </select>
        </label>
        <label class="badge-control-field">公开范围
          <select name="publicVisible">
            <option value="true" ${policy.publicVisible ? "selected" : ""}>公开展示</option>
            <option value="false" ${policy.publicVisible ? "" : "selected"}>仅后台</option>
          </select>
        </label>
        <label class="badge-control-field">图标
          <select name="showIcon">
            <option value="true" ${policy.showIcon === false ? "" : "selected"}>显示图标</option>
            <option value="false" ${policy.showIcon === false ? "selected" : ""}>隐藏图标</option>
          </select>
        </label>
        <label class="badge-control-field">名称
          <select name="showName">
            <option value="true" ${policy.showName === false ? "" : "selected"}>显示名称</option>
            <option value="false" ${policy.showName === false ? "selected" : ""}>隐藏名称</option>
          </select>
        </label>
        <label class="badge-control-field badge-control-field-wide">悬停说明
          <input name="tooltip" value="${escapeHtml(policy.tooltip || "")}" placeholder="给前台或后台看的简短说明" />
        </label>
        <label class="badge-control-field">排序
          <input name="order" type="number" value="${Number(policy.order || 100)}" />
        </label>
        <fieldset class="badge-location-fieldset">
          <legend>展示位置</legend>
          <div class="badge-location-grid">
            ${locationItems.map((item) => `
              <label class="badge-location-chip">
                <input type="checkbox" data-badge-location value="${escapeHtml(item.key)}" ${item.checked ? "checked" : ""} />
                <span>${escapeHtml(item.label)}</span>
              </label>
            `).join("")}
          </div>
        </fieldset>
        <div class="badge-policy-actions">
          <button class="button outline" type="button" data-save-badge-policy ${hasPermission(user, "badgePolicy", "edit") ? "" : "disabled"}>保存展示策略</button>
        </div>
      </div>
    </article>
  `;
  }).join("");
  revealDynamicContent(list);
  qsa("[data-badge-policy-id]", list).forEach((row) => {
    qs("[data-save-badge-policy]", row).addEventListener("click", async () => {
      const displayLocations = {};
      qsa("[data-badge-location]", row).forEach((input) => {
        displayLocations[input.value] = input.checked;
      });
      await api.put(`/api/governance/badge-policies/${row.dataset.badgePolicyId}`, {
        enabled: qs('[name="enabled"]', row).value,
        publicVisible: qs('[name="publicVisible"]', row).value,
        showIcon: qs('[name="showIcon"]', row).value,
        showName: qs('[name="showName"]', row).value,
        tooltip: qs('[name="tooltip"]', row).value,
        order: qs('[name="order"]', row).value,
        displayLocations,
      });
      showToast("保存成功");
      await renderBadgePolicies();
    });
  });
}

async function initAdminActivitiesPage() {
  const root = qs("[data-admin-activities-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "activities", "view");
  if (!user) return;
  const filters = qs("[data-admin-activity-filters]", root);
  await fillModuleFilterSelect(filters?.moduleId);
  fillStatusSelect(filters?.status);
  filters?.addEventListener("submit", (event) => {
    event.preventDefault();
    resetPagedState("adminActivities");
    renderAllActivities();
  });
  qs("[data-load-more-admin-activities]", root)?.addEventListener("click", () => {
    mePageState.adminActivityPage += 1;
    renderAllActivities();
  });
  await renderAllActivities();
}

async function initAdminMembersPage() {
  const root = qs("[data-admin-members-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "users", "view");
  if (!user) return;
  await loadRoleOptions(root);
  const filters = qs("[data-member-filters]", root);
  filters?.addEventListener("submit", (event) => {
    event.preventDefault();
    resetPagedState("users");
    renderUsers();
  });
  qs("[data-load-more-users]", root)?.addEventListener("click", () => {
    mePageState.userPage += 1;
    renderUsers();
  });
  bindAdminForms();
  const userPanel = qs("[data-user-create-panel]", root);
  if (userPanel) userPanel.hidden = !hasPermission(user, "users", "create");
  await initAdminMembersPageRoleLinks(root, user);
  await renderUsers();
}

async function initAdminRolesPage() {
  const root = qs("[data-admin-roles-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "roles", "view");
  if (!user) return;
  const filters = qs("[data-role-filters]", root);
  filters?.addEventListener("submit", (event) => {
    event.preventDefault();
    renderRoles();
  });
  qsa("[data-role-create-link]", root).forEach((link) => {
    link.hidden = !hasPermission(user, "roles", "create");
  });
  await renderRoles();
}

async function initAdminRoleEditorPage() {
  const root = qs("[data-admin-role-editor-page]");
  if (!root) return;
  const editingId = new URLSearchParams(location.search).get("id");
  const user = await requireAdminUser(root, "roles", editingId ? "edit" : "create");
  if (!user) return;
  const form = qs("[data-role-form]", root);
  await loadRoleOptions(root);
  resetRoleForm(form);
  if (editingId) {
    const role = (mePageState.roles || []).find((item) => item.id === editingId || item.key === editingId);
    if (!role) {
      setMessage(qs("[data-role-message]", root), "没有找到这个角色，请回到角色列表重试。", "error");
      qsa("input, textarea, button", form).forEach((control) => {
        if (control.tagName !== "BUTTON") control.disabled = true;
      });
      qs("[data-role-submit]", form).disabled = true;
      return;
    }
    fillRoleForm(form, role, { scroll: false });
  }
  form?.addEventListener("change", (event) => {
    if (event.target?.matches("[data-permission-module][data-permission-action]")) {
      updatePermissionSummary(form);
    }
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveRole(form, { redirect: true });
  });
}

async function initAdminMembersPageRoleLinks(root, user) {
  qsa("[data-role-create-link]", root).forEach((link) => {
    link.hidden = !hasPermission(user, "roles", "create");
  });
}

async function initAdminModulesPage() {
  const root = qs("[data-admin-modules-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "modules", "view");
  if (!user) return;
  const filters = qs("[data-module-filters]", root);
  filters?.addEventListener("submit", (event) => {
    event.preventDefault();
    resetPagedState("modulesPageItems");
    renderModules();
  });
  qs("[data-load-more-modules]", root)?.addEventListener("click", () => {
    mePageState.modulePage += 1;
    renderModules();
  });
  bindAdminForms();
  const moduleForm = qs("[data-module-form]", root);
  if (moduleForm?.closest(".form-note")) moduleForm.closest(".form-note").hidden = !hasPermission(user, "modules", "create");
  await renderModules();
}

async function initAdminTemplatesPage() {
  const root = qs("[data-admin-templates-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "templates", "view");
  if (!user) return;
  const filters = qs("[data-template-filters]", root);
  filters?.addEventListener("submit", (event) => {
    event.preventDefault();
    resetPagedState("templates");
    renderTemplates();
  });
  qs("[data-load-more-templates]", root)?.addEventListener("click", () => {
    mePageState.templatePage += 1;
    renderTemplates();
  });
  qsa('a[href="admin-template-editor.html"]', root).forEach((link) => {
    link.hidden = !hasPermission(user, "templates", "create");
  });
  await renderTemplates();
}

async function initAdminTemplateEditorPage() {
  const root = qs("[data-admin-template-editor-page]");
  if (!root) return;
  const editingId = new URLSearchParams(location.search).get("id");
  const user = await requireAdminUser(root, "templates", editingId ? "edit" : "create");
  if (!user) return;
  const form = qs("[data-template-form]", root);
  bindTemplateForm(form);
  if (!editingId) return;
  try {
    const { template } = await api.get(`/api/templates/${encodeURIComponent(editingId)}`);
    fillTemplateForm(form, template);
  } catch (error) {
    setMessage(qs("[data-template-message]", root), error.message, "error");
  }
}

async function initAdminLogsPage() {
  const root = qs("[data-admin-logs-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "logs", "view");
  if (!user) return;
  const filters = qs("[data-log-filters]", root);
  await fillLogFilters(filters);
  filters?.addEventListener("submit", (event) => {
    event.preventDefault();
    resetPagedState("logs");
    renderLogs();
  });
  qs("[data-load-more-logs]", root)?.addEventListener("click", () => {
    mePageState.logPage += 1;
    renderLogs();
  });
  await renderLogs();
}

async function initAdminReportsPage() {
  const root = qs("[data-admin-reports-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "reports", "view");
  if (!user) return;
  const filters = qs("[data-report-filters]", root);
  filters?.addEventListener("submit", (event) => {
    event.preventDefault();
    resetPagedState("reports");
    renderReports();
  });
  qs("[data-load-more-reports]", root)?.addEventListener("click", () => {
    mePageState.reportPage += 1;
    renderReports();
  });
  await renderReports();
}

async function initAdminSafetyPage() {
  const root = qs("[data-admin-safety-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "safety", "view");
  if (!user) return;
  const configForm = qs("[data-safety-config-form]", root);
  const ruleForm = qs("[data-safety-rule-form]", root);
  const message = qs("[data-safety-message]", root);
  qsa("button", configForm).forEach((button) => {
    button.disabled = !hasPermission(user, "safety", "configure");
  });
  if (ruleForm?.closest(".form-note")) ruleForm.closest(".form-note").hidden = !hasPermission(user, "safety", "create");
  try {
    const [{ config }, { rules }] = await Promise.all([
      api.get("/api/safety/config"),
      api.get("/api/safety/rules"),
    ]);
    qs('[name="config"]', configForm).value = JSON.stringify(config, null, 2);
    renderSafetyRules(qs("[data-safety-rules]", root), rules);
  } catch (error) {
    setMessage(message, error.message, "error");
  }
  configForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const config = JSON.parse(configForm.config.value || "{}");
      await api.put("/api/safety/config", { config });
      setMessage(message, "规则与策略配置已保存。", "success");
      showToast("保存成功");
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
  ruleForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api.post("/api/safety/rules", {
        name: ruleForm.name.value,
        type: ruleForm.type.value,
        weight: ruleForm.weight.value,
        enabled: ruleForm.enabled.value,
        description: ruleForm.description.value,
        params: ruleForm.params.value,
      });
      ruleForm.reset();
      await refreshSafetyRules(root);
      showToast("保存成功");
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

async function refreshSafetyRules(root = document) {
  const { rules } = await api.get("/api/safety/rules");
  renderSafetyRules(qs("[data-safety-rules]", root), rules);
}

function renderSafetyRules(container, rules = []) {
  if (!container) return;
  if (!rules.length) {
    container.innerHTML = `<div class="empty-state"><strong>还没有规则</strong><p>默认规则会在系统初始化时自动补齐。</p></div>`;
    return;
  }
  const user = mePageState.user || getCachedUser();
  container.innerHTML = rules.map((rule) => `
    <article class="manage-row safety-rule-row" data-rule-id="${rule.id}">
      <input name="name" value="${escapeHtml(rule.name)}" aria-label="规则名称" />
      <input name="type" value="${escapeHtml(rule.type)}" aria-label="规则类型" />
      <input name="weight" type="number" min="-100" max="100" value="${Number(rule.weight || 0)}" aria-label="风险分值" />
      <select name="enabled" aria-label="是否启用">
        <option value="true" ${rule.enabled !== false ? "selected" : ""}>启用</option>
        <option value="false" ${rule.enabled === false ? "selected" : ""}>关闭</option>
      </select>
      <textarea name="description" aria-label="规则说明">${escapeHtml(rule.description || "")}</textarea>
      <textarea name="params" aria-label="规则参数 JSON">${escapeHtml(JSON.stringify(rule.params || {}, null, 2))}</textarea>
      <button class="button outline" type="button" data-save-rule ${hasPermission(user, "safety", "edit") ? "" : "disabled"}>保存</button>
      <button class="button outline danger-soft" type="button" data-delete-rule ${hasPermission(user, "safety", "delete") ? "" : "disabled"}>删除</button>
    </article>
  `).join("");
  revealDynamicContent(container);
  qsa("[data-rule-id]", container).forEach((row) => {
    qs("[data-save-rule]", row).addEventListener("click", async () => {
      try {
        await api.put(`/api/safety/rules/${row.dataset.ruleId}`, {
          name: qs('[name="name"]', row).value,
          type: qs('[name="type"]', row).value,
          weight: qs('[name="weight"]', row).value,
          enabled: qs('[name="enabled"]', row).value,
          description: qs('[name="description"]', row).value,
          params: qs('[name="params"]', row).value,
        });
        showToast("保存成功");
        await refreshSafetyRules();
      } catch (error) {
        alert(error.message);
      }
    });
    qs("[data-delete-rule]", row).addEventListener("click", async () => {
      if (!confirm("确定删除这条规则吗？")) return;
      await api.delete(`/api/safety/rules/${row.dataset.ruleId}`);
      showToast("删除成功");
      await refreshSafetyRules();
    });
  });
}

const aiSceneLabels = {
  activity: "活动分析",
  feedback: "活动反馈",
  report: "举报复核",
  manual: "手动重分析",
};

const aiProviderLabels = {
  "openai-compatible": "OpenAI Compatible",
  openai: "OpenAI",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  openrouter: "OpenRouter",
  ollama: "Ollama / Local",
  claude: "Claude Adapter",
  gemini: "Gemini Adapter",
};

function aiSceneLabel(scene = "") {
  return aiSceneLabels[scene] || scene || "未分配";
}

function aiProviderLabel(provider = "") {
  return aiProviderLabels[provider] || provider || "未配置";
}

function aiHealthLabel(status = "") {
  return { ok: "连接正常", error: "连接异常", unknown: "未测试" }[status] || "未测试";
}

function aiHealthTone(status = "") {
  return status === "ok" ? "success" : status === "error" ? "danger-soft" : "soft";
}

function formatPercent(value = 0) {
  const number = Number(value || 0);
  return `${number.toFixed(number % 1 ? 1 : 0)}%`;
}

function formatCompactNumber(value = 0) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function parseJsonText(value, fallback = {}) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return fallback;
  }
}

function activePromptFor(prompts = [], settings = {}, type = "activity") {
  const version = settings.promptVersions?.[type] || (type === "activity" ? settings.promptVersion : "");
  return prompts.find((prompt) => prompt.type === type && prompt.version === version)
    || prompts.find((prompt) => prompt.type === type && prompt.active)
    || null;
}

function modelById(models = [], id = "") {
  return models.find((model) => model.id === id) || null;
}

function firstRouteModel(settings = {}, models = [], scene = "activity") {
  const route = settings.sceneRouting?.[scene] || {};
  return modelById(models, route.primaryProfileId || settings.activeProfileId)
    || models.find((model) => model.enabled !== false)
    || null;
}

async function initAdminAiPage() {
  const root = qs("[data-admin-ai-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "ai", "view");
  if (!user) return;
  const settingsForm = qs("[data-ai-settings-form]", root);
  const message = qs("[data-ai-message]", root);
  qsa("button", settingsForm).forEach((button) => {
    button.disabled = !hasPermission(user, "ai", "configure");
  });
  try {
    const [{ settings }, { models }, { usage }, { prompts }] = await Promise.all([
      api.get("/api/ai/settings"),
      api.get("/api/ai/models"),
      api.get("/api/ai/usage?days=7"),
      api.get("/api/ai/prompts?page=1&pageSize=100"),
    ]);
    mePageState.aiModels = models || [];
    mePageState.aiUsage = usage || null;
    fillAiSettingsForm(settingsForm, settings);
    renderAiConsoleSummary(qs("[data-ai-console-summary]", root), settings, models || [], usage || {}, prompts || []);
    renderAiSceneRoutes(qs("[data-ai-scene-routes]", root), settings, models || []);
  } catch (error) {
    setMessage(message, error.message, "error");
  }
  settingsForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = aiSettingsPayload(settingsForm);
      const { settings } = await api.put("/api/ai/settings", payload);
      fillAiSettingsForm(settingsForm, settings);
      renderAiSceneRoutes(qs("[data-ai-scene-routes]", root), settings, mePageState.aiModels || []);
      setMessage(message, "AI 设置已保存。", "success");
      showToast("保存成功");
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

function renderAiConsoleSummary(container, settings = {}, models = [], usage = {}, prompts = []) {
  if (!container) return;
  const activityModel = firstRouteModel(settings, models, "activity");
  const feedbackPrompt = activePromptFor(prompts, settings, "feedback");
  const activityPrompt = activePromptFor(prompts, settings, "activity");
  const reportPrompt = activePromptFor(prompts, settings, "report");
  const healthy = models.filter((model) => model.healthStatus === "ok").length;
  const backupCount = Math.max(models.filter((model) => model.enabled !== false).length - 1, 0);
  container.innerHTML = `
    <article class="ai-console-card primary-console-card">
      <span class="tag ${settings.enabled ? "" : "danger-soft"}">${settings.enabled ? "AI 已开启" : "AI 已关闭"}</span>
      <h3>${escapeHtml(activityModel?.name || "未选择主模型")}</h3>
      <p>${escapeHtml(aiProviderLabel(activityModel?.provider))} · ${escapeHtml(activityModel?.model || "未配置 Model Name")}</p>
      <div class="button-row">
        <a class="button primary" href="admin-ai-models.html">切换模型</a>
        <a class="button outline" href="admin-ai-usage.html">查看用量</a>
      </div>
    </article>
    <article class="ai-console-card"><span class="tag">模型健康</span><strong>${healthy}/${models.length || 0}</strong><p>${backupCount} 个备用模型 · 故障转移${settings.fallbackEnabled === false ? "关闭" : "开启"}</p></article>
    <article class="ai-console-card"><span class="tag">近 7 天调用</span><strong>${formatCompactNumber(usage.totalCalls || 0)}</strong><p>成功率 ${formatPercent(usage.successRate || 0)} · 平均 ${Math.round(usage.averageDurationMs || 0)}ms</p></article>
    <article class="ai-console-card"><span class="tag">Token</span><strong>${formatCompactNumber(usage.totalTokens || 0)}</strong><p>缓存命中 ${formatCompactNumber(usage.cacheHits || 0)} 次</p></article>
    <article class="ai-console-card prompt-console-card"><span class="tag">活动分析 Prompt</span><h3>${escapeHtml(activityPrompt?.name || "默认活动分析")}</h3><p>${escapeHtml(activityPrompt?.version || settings.promptVersion || "activity-default-v1")}</p><a class="button ghost" href="admin-ai-prompts.html?type=activity">查看</a></article>
    <article class="ai-console-card prompt-console-card"><span class="tag">活动反馈 Prompt</span><h3>${escapeHtml(feedbackPrompt?.name || "默认活动反馈")}</h3><p>${escapeHtml(feedbackPrompt?.version || settings.promptVersions?.feedback || "feedback-default-v1")}</p><a class="button ghost" href="admin-ai-prompts.html?type=feedback">查看</a></article>
    <article class="ai-console-card prompt-console-card"><span class="tag">举报复核 Prompt</span><h3>${escapeHtml(reportPrompt?.name || "暂未单独配置")}</h3><p>${escapeHtml(reportPrompt?.version || settings.promptVersions?.report || "复用活动分析")}</p><a class="button ghost" href="admin-ai-prompts.html?type=report">查看</a></article>
  `;
  revealDynamicContent(container);
}

function fillAiSettingsForm(form, settings = {}) {
  if (!form) return;
  const strategy = settings.callStrategy || {};
  form.enabled.value = settings.enabled ? "true" : "false";
  if (form.fallbackEnabled) form.fallbackEnabled.value = settings.fallbackEnabled === false ? "false" : "true";
  if (form.cacheTtlSeconds) form.cacheTtlSeconds.value = settings.cacheTtlSeconds || 86400;
  if (form.activeProfileId) form.activeProfileId.value = settings.activeProfileId || "";
  if (form.fallbackProfileIds) form.fallbackProfileIds.value = JSON.stringify(settings.fallbackProfileIds || []);
  if (form.sceneRouting) form.sceneRouting.value = JSON.stringify(settings.sceneRouting || {});
  if (form.ruleConfidenceMax) form.ruleConfidenceMax.value = strategy.ruleConfidenceMax ?? 70;
  if (form.firstActivityCount) form.firstActivityCount.value = strategy.firstActivityCount ?? 3;
  if (form.dailyCallLimit) form.dailyCallLimit.value = strategy.dailyCallLimit ?? 200;
  form.callStrategy.value = JSON.stringify(strategy, null, 2);
  form.capabilities.value = JSON.stringify(settings.capabilities || {}, null, 2);
}

function aiSettingsPayload(form) {
  const callStrategy = parseJsonText(form.callStrategy.value, {});
  const sceneRouting = {};
  qsa("[data-ai-scene-route]", form).forEach((route) => {
    const scene = route.dataset.aiSceneRoute;
    const primaryProfileId = qs("[data-ai-scene-primary]", route)?.value || "";
    const fallbackProfileIds = qsa("[data-ai-scene-fallback]:checked", route)
      .map((input) => input.value)
      .filter((id) => id && id !== primaryProfileId);
    sceneRouting[scene] = { primaryProfileId, fallbackProfileIds };
  });
  const fallbackProfileIds = Array.from(new Set(Object.values(sceneRouting).flatMap((route) => route.fallbackProfileIds || [])));
  if (form.ruleConfidenceMax) {
    callStrategy.lowConfidenceOnly = true;
    callStrategy.ruleConfidenceMax = Math.max(0, Math.min(100, Number(form.ruleConfidenceMax.value === "" ? 70 : form.ruleConfidenceMax.value)));
  }
  if (form.firstActivityCount) {
    const firstActivityCount = Math.max(0, Math.min(50, Number(form.firstActivityCount.value || 0)));
    callStrategy.firstActivitiesAlways = firstActivityCount > 0;
    callStrategy.firstActivityCount = firstActivityCount;
  }
  if (form.dailyCallLimit) {
    callStrategy.dailyCallLimit = Math.max(0, Math.min(100000, Number(form.dailyCallLimit.value || 0)));
  }
  return {
    enabled: form.enabled.value,
    fallbackEnabled: form.fallbackEnabled?.value ?? "true",
    activeProfileId: sceneRouting.activity?.primaryProfileId || form.activeProfileId?.value || "",
    fallbackProfileIds,
    sceneRouting,
    cacheTtlSeconds: form.cacheTtlSeconds.value,
    callStrategy,
    capabilities: form.capabilities.value,
  };
}

function renderAiSceneRoutes(container, settings = {}, models = []) {
  if (!container) return;
  const enabledModels = models.filter((model) => model.enabled !== false);
  if (!enabledModels.length) {
    container.innerHTML = `<div class="empty-state"><strong>还没有可用模型</strong><p>先新增一个模型档案，再回来配置场景路由。</p><a class="button primary" href="admin-ai-model-editor.html">新增模型</a></div>`;
    return;
  }
  const sceneRouting = settings.sceneRouting || {};
  container.innerHTML = Object.entries(aiSceneLabels).map(([scene, label]) => {
    const route = sceneRouting[scene] || {};
    const primary = route.primaryProfileId || settings.activeProfileId || enabledModels[0]?.id || "";
    const fallbacks = new Set(route.fallbackProfileIds || []);
    return `
      <article class="ai-scene-route" data-ai-scene-route="${scene}">
        <div>
          <span class="tag">${escapeHtml(label)}</span>
          <h3>${escapeHtml(modelById(models, primary)?.name || "未选择模型")}</h3>
          <p>${scene === "feedback" ? "活动匿名反馈分析、公开展示判断和精选排序。" : scene === "report" ? "举报后重新理解举报内容和活动内容。" : scene === "manual" ? "管理员手动重新分析时使用。" : "活动发布安全分析、结构化提取和风险解释。"}</p>
        </div>
        <div class="ai-route-controls">
          <label>主模型<select data-ai-scene-primary>${enabledModels.map((model) => `<option value="${escapeHtml(model.id)}" ${model.id === primary ? "selected" : ""}>${escapeHtml(model.name)} · ${escapeHtml(model.model || "未填模型")}</option>`).join("")}</select></label>
          <fieldset class="form-fieldset compact-fieldset">
            <legend>备用模型</legend>
            ${enabledModels.map((model) => `<label><input type="checkbox" data-ai-scene-fallback value="${escapeHtml(model.id)}" ${fallbacks.has(model.id) ? "checked" : ""} /> ${escapeHtml(model.name)}</label>`).join("")}
          </fieldset>
        </div>
      </article>
    `;
  }).join("");
}

async function refreshAiPrompts(root = document) {
  const filters = qs("[data-ai-prompt-filters]", root);
  const params = new URLSearchParams({ page: "1", pageSize: "100" });
  if (filters) {
    if (filters.type.value) params.set("type", filters.type.value);
    if (filters.q.value.trim()) params.set("q", filters.q.value.trim());
  }
  const { prompts } = await api.get(`/api/ai/prompts?${params.toString()}`);
  mePageState.aiPrompts = prompts || [];
  renderAiPrompts(qs("[data-ai-prompts]", root), prompts || []);
  if (qs("[data-ai-prompt-count]", root)) qs("[data-ai-prompt-count]", root).textContent = `共 ${prompts.length} 个 Prompt 版本`;
}

function renderAiPrompts(container, prompts = []) {
  if (!container) return;
  if (!prompts.length) {
    container.innerHTML = `<div class="empty-state"><strong>还没有 Prompt</strong><p>可以从活动分析、活动反馈或举报复核场景新建一个版本。</p><a class="button primary" href="admin-ai-prompt-editor.html">新增 Prompt</a></div>`;
    return;
  }
  const user = mePageState.user || getCachedUser();
  container.innerHTML = prompts.map((prompt) => `
    <article class="event-row" data-prompt-id="${prompt.id}">
      <div>
        <span class="tag">${prompt.active ? "启用中" : "历史版本"}</span>
        <h3>${escapeHtml(prompt.name)}</h3>
        <p>${escapeHtml(aiSceneLabel(prompt.type))} · ${escapeHtml(prompt.version)} · ${formatDate(prompt.updatedAt || prompt.createdAt)}</p>
        <details class="review-detail">
          <summary>查看 Prompt</summary>
          <pre>${escapeHtml(prompt.systemPrompt || "")}</pre>
          <pre>${escapeHtml(prompt.userPrompt || "")}</pre>
        </details>
      </div>
      <div class="row-actions">
        <a class="button outline" href="admin-ai-prompt-editor.html?id=${encodeURIComponent(prompt.id)}">编辑</a>
        <button class="button outline" type="button" data-activate-prompt ${prompt.active || !hasPermission(user, "ai", "configure") ? "disabled" : ""}>启用</button>
        <button class="button outline danger-soft" type="button" data-delete-prompt ${hasPermission(user, "ai", "delete") ? "" : "disabled"}>删除</button>
      </div>
    </article>
  `).join("");
  revealDynamicContent(container);
  qsa("[data-prompt-id]", container).forEach((row) => {
    qs("[data-activate-prompt]", row).addEventListener("click", async () => {
      await api.post(`/api/ai/prompts/${row.dataset.promptId}/activate`, {});
      showToast("保存成功");
      await refreshAiPrompts();
    });
    qs("[data-delete-prompt]", row).addEventListener("click", async () => {
      if (!confirm("确定删除这个 Prompt 版本吗？")) return;
      await api.delete(`/api/ai/prompts/${row.dataset.promptId}`);
      showToast("删除成功");
      await refreshAiPrompts();
    });
  });
}

async function initAdminAiModelsPage() {
  const root = qs("[data-admin-ai-models-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "ai", "view");
  if (!user) return;
  await refreshAiModelsPage(root);
}

async function refreshAiModelsPage(root = document) {
  const [{ models }, { settings }] = await Promise.all([
    api.get("/api/ai/models"),
    api.get("/api/ai/settings"),
  ]);
  mePageState.aiModels = models || [];
  renderAiModelList(qs("[data-ai-model-list]", root), models || [], settings || {});
  if (qs("[data-ai-model-count]", root)) qs("[data-ai-model-count]", root).textContent = `共 ${models.length} 个模型档案`;
}

function routeUsesModel(settings = {}, modelId = "") {
  return Object.values(settings.sceneRouting || {}).some((route) => route.primaryProfileId === modelId);
}

function renderAiModelList(container, models = [], settings = {}) {
  if (!container) return;
  if (!models.length) {
    container.innerHTML = `<div class="empty-state"><strong>还没有模型档案</strong><p>新增一个模型后，就可以在场景路由里设为主模型或备用模型。</p><a class="button primary" href="admin-ai-model-editor.html">新增模型</a></div>`;
    return;
  }
  const user = mePageState.user || getCachedUser();
  container.innerHTML = models.map((model) => `
    <article class="event-row ai-model-row" data-ai-model-id="${escapeHtml(model.id)}">
      <div>
        <div class="tag-row">
          <span class="tag ${model.enabled === false ? "danger-soft" : ""}">${model.enabled === false ? "已关闭" : "启用"}</span>
          <span class="tag ${aiHealthTone(model.healthStatus)}">${aiHealthLabel(model.healthStatus)}</span>
          ${routeUsesModel(settings, model.id) ? `<span class="tag">主模型</span>` : ""}
        </div>
        <h3>${escapeHtml(model.name)}</h3>
        <p>${escapeHtml(aiProviderLabel(model.provider))} · ${escapeHtml(model.model || "未配置 Model Name")} · 优先级 ${Number(model.priority || 1)}</p>
        <p>场景：${(model.sceneScopes || []).map(aiSceneLabel).join("、") || "全部"} · Key：${escapeHtml(model.apiKeyStatus || "未配置")} · ${model.lastError ? `最近错误：${escapeHtml(model.lastError)}` : `最近测试：${model.lastTestAt ? formatDate(model.lastTestAt) : "未测试"}`}</p>
      </div>
      <div class="row-actions">
        <a class="button outline" href="admin-ai-model-editor.html?id=${encodeURIComponent(model.id)}">编辑</a>
        <button class="button outline" type="button" data-test-ai-model ${hasPermission(user, "ai", "configure") ? "" : "disabled"}>测试</button>
        <button class="button outline" type="button" data-set-ai-model-main ${hasPermission(user, "ai", "configure") ? "" : "disabled"}>设为全部主模型</button>
        <button class="button outline danger-soft" type="button" data-delete-ai-model ${hasPermission(user, "ai", "delete") ? "" : "disabled"}>删除</button>
      </div>
    </article>
  `).join("");
  revealDynamicContent(container);
  qsa("[data-ai-model-id]", container).forEach((row) => {
    const id = row.dataset.aiModelId;
    qs("[data-test-ai-model]", row)?.addEventListener("click", async () => {
      showToast("正在测试连接...");
      const result = await api.post(`/api/ai/models/${encodeURIComponent(id)}/test`, {});
      showToast(result.ok ? `连接成功，响应 ${result.durationMs}ms` : `连接失败：${result.error}`);
      await refreshAiModelsPage();
    });
    qs("[data-set-ai-model-main]", row)?.addEventListener("click", async () => {
      const { settings } = await api.get("/api/ai/settings");
      const sceneRouting = Object.fromEntries(Object.keys(aiSceneLabels).map((scene) => [
        scene,
        { primaryProfileId: id, fallbackProfileIds: (settings.sceneRouting?.[scene]?.fallbackProfileIds || []).filter((item) => item !== id) },
      ]));
      await api.put("/api/ai/settings", { activeProfileId: id, sceneRouting });
      showToast("保存成功");
      await refreshAiModelsPage();
    });
    qs("[data-delete-ai-model]", row)?.addEventListener("click", async () => {
      if (!confirm("确定删除这个 AI 模型档案吗？")) return;
      await api.delete(`/api/ai/models/${encodeURIComponent(id)}`);
      showToast("删除成功");
      await refreshAiModelsPage();
    });
  });
}

function collectCheckedValues(form, name) {
  return qsa(`input[name="${name}"]:checked`, form).map((input) => input.value);
}

function aiModelPayload(form) {
  return {
    name: form.name.value,
    provider: form.provider.value,
    baseUrl: form.baseUrl.value,
    model: form.model.value,
    apiKey: form.apiKey.value,
    enabled: form.enabled.value,
    priority: form.priority.value,
    sceneScopes: collectCheckedValues(form, "sceneScopes"),
    requestTimeoutMs: form.requestTimeoutMs.value,
    temperature: form.temperature.value,
    maxTokens: form.maxTokens.value,
    retryCount: form.retryCount.value,
    dailyLimit: form.dailyLimit.value,
  };
}

function fillAiModelForm(form, model = {}) {
  if (!form) return;
  form.name.value = model.name || "";
  form.provider.value = model.provider || "openai-compatible";
  form.baseUrl.value = model.baseUrl || "";
  form.model.value = model.model || "";
  form.apiKey.value = "";
  form.apiKey.placeholder = model.apiKeyStatus || "已保存则留空即可";
  form.enabled.value = model.enabled === false ? "false" : "true";
  form.priority.value = model.priority || 1;
  form.requestTimeoutMs.value = model.requestTimeoutMs || 15000;
  form.temperature.value = model.temperature ?? 0.2;
  form.maxTokens.value = model.maxTokens || 1200;
  form.retryCount.value = model.retryCount ?? 1;
  form.dailyLimit.value = model.dailyLimit || 0;
  const scopes = new Set(model.sceneScopes?.length ? model.sceneScopes : Object.keys(aiSceneLabels));
  qsa('input[name="sceneScopes"]', form).forEach((input) => {
    input.checked = scopes.has(input.value);
  });
}

async function initAdminAiModelEditorPage() {
  const root = qs("[data-admin-ai-model-editor-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "ai", "view");
  if (!user) return;
  const form = qs("[data-ai-model-form]", root);
  const message = qs("[data-ai-model-message]", root);
  const id = new URLSearchParams(location.search).get("id");
  let editing = null;
  if (id) {
    const { model } = await api.get(`/api/ai/models/${encodeURIComponent(id)}`);
    editing = model;
    qs("[data-ai-model-editor-heading]", root).textContent = `编辑 ${model.name}。`;
    qs("[data-ai-model-form-title]", root).textContent = "编辑模型";
    fillAiModelForm(form, model);
  } else {
    fillAiModelForm(form, {});
  }
  const canSave = id ? hasPermission(user, "ai", "edit") : hasPermission(user, "ai", "create");
  qsa("input, select, textarea", form).forEach((element) => {
    element.disabled = !canSave;
  });
  qs('button[type="submit"]', form).disabled = !canSave;
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = aiModelPayload(form);
      const response = editing
        ? await api.put(`/api/ai/models/${encodeURIComponent(editing.id)}`, payload)
        : await api.post("/api/ai/models", payload);
      editing = response.model;
      showToast("保存成功");
      location.href = "admin-ai-models.html";
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
  qs("[data-ai-model-test]", form)?.addEventListener("click", async () => {
    try {
      setMessage(message, "正在测试连接...");
      const payload = aiModelPayload(form);
      const result = editing
        ? await api.post(`/api/ai/models/${encodeURIComponent(editing.id)}/test`, payload)
        : await api.post("/api/ai/test-connection", payload);
      setMessage(message, result.ok ? `连接成功，响应 ${result.durationMs}ms。` : `连接失败：${result.error}`, result.ok ? "success" : "error");
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

async function initAdminAiPromptsPage() {
  const root = qs("[data-admin-ai-prompts-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "ai", "view");
  if (!user) return;
  const filters = qs("[data-ai-prompt-filters]", root);
  const type = new URLSearchParams(location.search).get("type") || "";
  if (type && filters?.type) filters.type.value = type;
  filters?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await refreshAiPrompts(root);
  });
  await refreshAiPrompts(root);
}

function aiPromptPayload(form) {
  return {
    type: form.type.value,
    version: form.version.value,
    name: form.name.value,
    active: form.active.value,
    systemPrompt: form.systemPrompt.value,
    userPrompt: form.userPrompt.value,
  };
}

function fillAiPromptForm(form, prompt = {}) {
  if (!form) return;
  form.type.value = prompt.type || new URLSearchParams(location.search).get("type") || "activity";
  form.version.value = prompt.version || "";
  form.name.value = prompt.name || "";
  form.active.value = prompt.active ? "true" : "false";
  form.systemPrompt.value = prompt.systemPrompt || "";
  form.userPrompt.value = prompt.userPrompt || "";
}

async function initAdminAiPromptEditorPage() {
  const root = qs("[data-admin-ai-prompt-editor-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "ai", "view");
  if (!user) return;
  const form = qs("[data-ai-prompt-form]", root);
  const message = qs("[data-ai-prompt-message]", root);
  const id = new URLSearchParams(location.search).get("id");
  let editing = null;
  if (id) {
    const { prompt } = await api.get(`/api/ai/prompts/${encodeURIComponent(id)}`);
    editing = prompt;
    qs("[data-ai-prompt-editor-heading]", root).textContent = `编辑 ${prompt.name}。`;
    qs("[data-ai-prompt-form-title]", root).textContent = "编辑 Prompt";
    fillAiPromptForm(form, prompt);
  } else {
    fillAiPromptForm(form, {});
  }
  const canSave = id ? hasPermission(user, "ai", "edit") : hasPermission(user, "ai", "create");
  qsa("input, select, textarea, button", form).forEach((element) => {
    element.disabled = !canSave;
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = aiPromptPayload(form);
      const response = editing
        ? await api.put(`/api/ai/prompts/${encodeURIComponent(editing.id)}`, payload)
        : await api.post("/api/ai/prompts", payload);
      if (payload.active === "true" && response.prompt?.id) {
        await api.post(`/api/ai/prompts/${encodeURIComponent(response.prompt.id)}/activate`, {});
      }
      showToast("保存成功");
      location.href = `admin-ai-prompts.html?type=${encodeURIComponent(payload.type)}`;
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

async function initAdminAiUsagePage() {
  const root = qs("[data-admin-ai-usage-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "ai", "view");
  if (!user) return;
  const filters = qs("[data-ai-usage-filters]", root);
  filters?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await refreshAiUsagePage(root);
  });
  await refreshAiUsagePage(root);
}

async function refreshAiUsagePage(root = document) {
  const filters = qs("[data-ai-usage-filters]", root);
  const days = filters?.days?.value || "7";
  const { usage } = await api.get(`/api/ai/usage?days=${encodeURIComponent(days)}`);
  mePageState.aiUsage = usage;
  renderAiUsageSummary(qs("[data-ai-usage-summary]", root), usage);
  renderAiUsageModels(qs("[data-ai-usage-models]", root), usage.models || []);
  renderAiUsageErrors(qs("[data-ai-usage-errors]", root), usage.recentErrors || []);
}

function renderAiUsageSummary(container, usage = {}) {
  if (!container) return;
  container.innerHTML = `
    <div class="stats ai-usage-stats">
      <div class="stat"><strong>${formatCompactNumber(usage.totalCalls || 0)}</strong><span>调用次数</span></div>
      <div class="stat"><strong>${formatPercent(usage.successRate || 0)}</strong><span>成功率</span></div>
      <div class="stat"><strong>${Math.round(usage.averageDurationMs || 0)}ms</strong><span>平均耗时</span></div>
      <div class="stat"><strong>${formatCompactNumber(usage.totalTokens || 0)}</strong><span>Token</span></div>
      <div class="stat"><strong>${formatCompactNumber(usage.cacheHits || 0)}</strong><span>缓存命中</span></div>
    </div>
  `;
}

function renderAiUsageModels(container, models = []) {
  if (!container) return;
  if (!models.length) {
    container.innerHTML = `<div class="empty-state"><strong>暂无 AI 调用记录</strong><p>模型测试、活动分析或反馈分析完成后，这里会出现统计。</p></div>`;
    return;
  }
  container.innerHTML = models.map((model) => `
    <article class="event-row ai-usage-row">
      <div>
        <span class="tag">${escapeHtml(model.provider || "Provider")}</span>
        <h3>${escapeHtml(model.profileName || model.model || "未命名模型")}</h3>
        <p>${escapeHtml(model.model || "")} · 调用 ${formatCompactNumber(model.totalCalls)} 次 · 成功率 ${formatPercent(model.successRate)} · 平均 ${Math.round(model.averageDurationMs || 0)}ms</p>
        <p>Token ${formatCompactNumber(model.totalTokens)} · 缓存命中 ${formatCompactNumber(model.cacheHits)} · 失败 ${formatCompactNumber(model.failedCalls)}</p>
      </div>
      <div class="row-actions">
        ${model.profileId ? `<a class="button outline" href="admin-ai-model-editor.html?id=${encodeURIComponent(model.profileId)}">查看模型</a>` : ""}
      </div>
    </article>
  `).join("");
}

function renderAiUsageErrors(container, errors = []) {
  if (!container) return;
  if (!errors.length) {
    container.innerHTML = `<div class="empty-state"><strong>最近没有错误</strong><p>如果某个模型超时或 Key 失效，会在这里留下线索。</p></div>`;
    return;
  }
  container.innerHTML = errors.map((error) => `
    <article class="event-row">
      <div>
        <span class="tag danger-soft">${escapeHtml(aiSceneLabel(error.scene))}</span>
        <h3>${escapeHtml(error.profileName || error.model || "未命名模型")}</h3>
        <p>${escapeHtml(error.provider || "")} · ${escapeHtml(error.model || "")} · ${formatDate(error.createdAt)}</p>
        <p>${escapeHtml(error.error || "调用失败")}</p>
      </div>
    </article>
  `).join("");
}

async function initAdminActivityConfidencePage() {
  const root = qs("[data-admin-activity-confidence-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "activities", "view");
  if (!user) return;
  const id = new URLSearchParams(location.search).get("id");
  const container = qs("[data-confidence-detail]", root);
  if (!id) {
    container.innerHTML = `<div class="empty-state"><strong>缺少活动 ID</strong><p>请从全部活动进入置信度详情。</p></div>`;
    return;
  }
  await renderActivityConfidence(root, id);
  const reanalyzeButton = qs("[data-reanalyze-activity]", root);
  if (reanalyzeButton) reanalyzeButton.hidden = !hasPermission(user, "activities", "reanalyze");
  reanalyzeButton?.addEventListener("click", async () => {
    await api.post(`/api/activities/${id}/reanalyze`, {});
    showToast("已重新分析");
    await renderActivityConfidence(root, id);
  });
}

async function renderActivityConfidence(root, id) {
  const container = qs("[data-confidence-detail]", root);
  const { activity, trustProfile, reports, analyses, latestAnalysis } = await api.get(`/api/activities/${id}/confidence`);
  const policy = latestAnalysis?.policy || {};
  const aiMeta = latestAnalysis?.aiMeta || {};
  const sourceRiskScore = policy.sourceRiskScore ?? activity.sourceRiskScore ?? activity.riskScore ?? 0;
  const aiAdjustment = policy.aiAdjustment ?? activity.aiAdjustment ?? 0;
  const aiTriggerReason = aiMeta.triggerReason || aiMeta.reason || "rule-only";
  container.innerHTML = `
    <article class="confidence-panel">
      <div class="confidence-score">
        <span>活动置信度</span>
        <strong>${Number(activity.confidenceScore ?? 100)}</strong>
        <p>风险分 ${Number(activity.riskScore || 0)} · ${escapeHtml(activity.riskLevel || "low")} · ${escapeHtml(activity.policyAction || "publish")}</p>
      </div>
      ${renderRiskNotice(activity)}
      <div class="detail-grid">
        <div><span>活动</span><strong>${escapeHtml(activity.title)}</strong><p>${escapeHtml(activity.moduleName)} · ${formatActivityTime(activity)}</p></div>
        <div><span>发起人</span><strong>${escapeHtml(activity.initiator)}</strong><p>社区信用度：${trustProfile ? Number(trustProfile.communityTrust || 0) : "无记录"}</p></div>
        <div><span>社区反馈</span><strong>${reports.length}</strong><p>达到阈值会触发再次分析。</p></div>
        <div><span>规则基准分</span><strong>${Number(sourceRiskScore || 0)}</strong><p>AI 调整：${Number(aiAdjustment || 0) > 0 ? "+" : ""}${Number(aiAdjustment || 0)}</p></div>
        <div><span>AI 触发原因</span><strong>${escapeHtml(aiTriggerReason)}</strong><p>${aiMeta.forced ? "管理员强制调用" : "策略自动判断"} · Prompt：${escapeHtml(aiMeta.promptVersion || "-")}</p></div>
        <div><span>兜底策略</span><strong>${escapeHtml(activity.safetyFallbackReason || policy.safetyFallbackReason || "无")}</strong><p>${activity.safetyFallbackReason === "ai-unavailable" ? "AI 不可用时进入管理员审核" : "按当前策略分流"}</p></div>
      </div>
    </article>
    <section class="panel-block">
      <h3>规则引擎明细</h3>
      ${renderRuleFindings(latestAnalysis?.ruleReport?.findings || activity.ruleFindings || [])}
    </section>
	    <section class="panel-block">
	      <h3>AI Analysis Report</h3>
	      ${latestAnalysis?.aiReport ? renderAiReport(latestAnalysis.aiReport) : renderAiSkippedState(latestAnalysis?.aiMeta || {})}
	    </section>
	    <section class="panel-block">
	      <h3>举报历史</h3>
	      ${renderConfidenceReports(reports, analyses)}
	    </section>
	    <section class="panel-block">
	      <h3>分析历史</h3>
		      ${analyses.length ? analyses.map((item) => `<p>${formatDate(item.createdAt)} · 风险分 ${item.policy?.riskScore ?? item.ruleReport?.riskScore ?? 0} · ${escapeHtml(item.aiMeta?.triggerReason || item.aiMeta?.reason || "rule")} · Prompt ${escapeHtml(item.aiMeta?.promptVersion || "-")}</p>`).join("") : `<p class="muted-text">暂无分析历史。</p>`}
	    </section>
  `;
  revealDynamicContent(container);
}

function renderConfidenceReports(reports = [], analyses = []) {
  if (!reports.length) return `<p class="muted-text">暂无举报记录。</p>`;
  const analysisMap = new Map((analyses || []).map((item) => [item.id, item]));
  return `
    <div class="finding-list">
      ${reports.map((report) => {
        const analysisReport = report.analysisReport || analysisMap.get(report.analysisReportId);
        return `
          <div class="finding-item">
            <strong>${escapeHtml(report.reason || "社区举报")}</strong>
            <span>${escapeHtml(reportStatusLabel(report.status))}</span>
            <p>${escapeHtml(report.detail || "没有补充说明")} · ${formatDate(report.createdAt)}</p>
            ${report.reportReview ? `<p>复核：风险分 ${Number(report.reportReview.riskScore || 0)} · ${report.reportReview.matched ? "举报理由与分析相符" : "暂未支持下架"} · ${escapeHtml(report.reportReview.reason || "")}</p>` : ""}
            ${renderReportAnalysisResult(analysisReport)}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderReportAnalysisResult(analysisReport = null) {
  if (!analysisReport) return `<p class="muted-text">暂无 AI 分析报告。</p>`;
  const aiMeta = analysisReport.aiMeta || {};
  const title = aiMeta.profileName
    ? `AI 分析：${escapeHtml(aiMeta.profileName)}`
    : "AI 分析";
  const meta = [
    aiMeta.promptVersion ? `Prompt ${aiMeta.promptVersion}` : "",
    aiMeta.cacheHit ? "缓存命中" : "",
    analysisReport.createdAt ? formatDate(analysisReport.createdAt) : "",
  ].filter(Boolean).join(" · ");
  return `
    <div class="report-analysis-result">
      <div class="report-analysis-head">
        <strong>${title}</strong>
        ${meta ? `<span>${escapeHtml(meta)}</span>` : ""}
      </div>
      ${analysisReport.aiReport ? renderAiReport(analysisReport.aiReport) : renderAiSkippedState(aiMeta)}
    </div>
  `;
}

function renderAiSkippedState(aiMeta = {}) {
  const reason = aiMeta.reason || aiMeta.triggerReason || "strategy-skip";
  const label = {
    disabled: "AI 当前关闭，系统已按规则引擎和兜底策略处理。",
    "missing-api-key": "AI 已启用但缺少可用 API Key，系统已按规则引擎和兜底策略处理。",
    "ai-unavailable": `AI 调用失败：${aiMeta.error || "模型暂时不可用"}。系统已按规则引擎和兜底策略处理。`,
    draft: "草稿不会调用 AI。",
    "strategy-skip": "当前调用策略未要求 AI 介入。",
    "low-rule-confidence": "系统判定需要 AI 介入，但本次未拿到分析报告。",
    "new-identity-first-activities": "新匿名身份活动需要 AI 介入，但本次未拿到分析报告。",
    "manual-forced": "管理员已强制调用 AI，但本次未拿到分析报告。",
  }[reason] || `AI 未返回分析报告：${reason}`;
  return `<p class="muted-text">${escapeHtml(label)}</p>`;
}

function renderRuleFindings(findings = []) {
  if (!findings.length) return `<p class="muted-text">没有触发明显风险规则。</p>`;
  return `
    <div class="finding-list">
      ${findings.map((item) => `
        <div class="finding-item">
          <strong>${escapeHtml(item.ruleName || item.ruleId)}</strong>
          <span>${Number(item.scoreDelta || 0) > 0 ? "+" : ""}${Number(item.scoreDelta || 0)} 分</span>
          <p>${escapeHtml(item.reason || "")}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function renderAiReport(report = {}) {
  const flags = [
    ["真实活动", report.isRealActivity],
    ["广告倾向", report.isAdvertisement],
    ["营销等级", report.advertisementLevel || "none"],
    ["垃圾内容", report.isSpam],
    ["垃圾等级", report.spamLevel || "none"],
    ["诈骗风险", report.isScam],
    ["政治敏感", report.containsPolitical],
    ["政治等级", report.politicalSensitivity || "none"],
    ["违法风险", report.containsIllegal],
  ];
  return `
    <div class="ai-report">
      <p><strong>摘要：</strong>${escapeHtml(report.summary || "暂无摘要")}</p>
      <p><strong>分类：</strong>${escapeHtml(report.category || "未分类")} · ${escapeHtml((report.tags || []).join(" / "))}</p>
      <p><strong>风险原因：</strong>${escapeHtml((report.riskReason || []).join("；") || "无")}</p>
      <p><strong>可信特征：</strong>${escapeHtml((report.positiveSignals || []).join("；") || "无")}</p>
      <p><strong>风险特征：</strong>${escapeHtml((report.negativeSignals || []).join("；") || "无")}</p>
	      <div class="chip-row">${flags.map(([label, value]) => `<span class="tag">${escapeHtml(label)}：${typeof value === "boolean" ? (value ? "是" : "否") : escapeHtml(String(value))}</span>`).join("")}</div>
    </div>
  `;
}

async function initAdminTrustPage() {
  const root = qs("[data-admin-trust-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "trust", "view");
  if (!user) return;
  const filters = qs("[data-trust-filters]", root);
  filters?.addEventListener("submit", (event) => {
    event.preventDefault();
    resetPagedState("trustProfiles");
    renderTrustProfiles();
  });
  qs("[data-load-more-trust]", root)?.addEventListener("click", () => {
    mePageState.userPage += 1;
    renderTrustProfiles();
  });
  await renderTrustProfiles();
}

async function renderTrustProfiles() {
  const list = qs("[data-trust-list]");
  if (!list) return;
  const query = queryFromForm(qs("[data-trust-filters]"), {
    page: mePageState.userPage,
    pageSize: mePageState.pageSize,
  });
  const { profiles, pageInfo } = await api.get(`/api/governance/identities${query}`);
  const loaded = mergePageItems("trustProfiles", mePageState.userPage, profiles);
  updatePagedCount(qs("[data-trust-count]"), loaded.length, pageInfo);
  updateLoadMore(qs("[data-load-more-trust]"), loaded.length, pageInfo?.total || loaded.length);
  if (!loaded.length) {
    list.innerHTML = `<div class="empty-state"><strong>还没有匿名身份记录</strong><p>有人开放发起活动后，这里会出现社区信用度。</p></div>`;
    return;
  }
  list.innerHTML = loaded.map((profile) => `
    <article class="event-row">
      <div>
        <span class="tag">信用度 ${Number(profile.communityTrust || 0)} · ${escapeHtml(profile.status || "normal")}</span>
        <h3>${escapeHtml(profile.latestInitiator || profile.communityId || profile.id)}</h3>
        <p>${escapeHtml(profile.communityId || profile.id)} · ${escapeHtml(profile.communityLevel || "normal")} · ${escapeHtml(profile.latestActivityTitle || "暂无活动")}</p>
        <p>${renderBadgeNames(profile.badges || []) || escapeHtml(profile.ipMasked || "IP 已脱敏")}</p>
        <p>${escapeHtml(profile.userAgentSample || "")}</p>
      </div>
      <div class="row-actions">
        <a class="button outline" href="admin-trust-detail.html?id=${encodeURIComponent(profile.id)}">查看</a>
      </div>
    </article>
  `).join("");
  revealDynamicContent(list);
}

function renderBadgeNames(badges = []) {
  return badges.length ? badges.map((badge) => `#${escapeHtml(badge.name)}`).join(" ") : "";
}

async function initAdminTrustDetailPage() {
  const root = qs("[data-admin-trust-detail-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "trust", "view");
  if (!user) return;
  const id = new URLSearchParams(location.search).get("id");
  const container = qs("[data-trust-detail]", root);
  if (!id) {
    container.innerHTML = `<div class="empty-state"><strong>缺少身份 ID</strong><p>请从社区信用度列表进入。</p></div>`;
    return;
  }
  const { profile, communityEvents = [], events = [], badges = [], activities } = await api.get(`/api/trust-profiles/${encodeURIComponent(id)}`);
  container.innerHTML = `
    <article class="confidence-panel">
      <div class="confidence-score">
        <span>社区信用度</span>
        <strong>${Number(profile.communityTrust || 0)}</strong>
        <p>${escapeHtml(profile.communityId || profile.id)} · ${escapeHtml(profile.communityLevel || "normal")} · ${escapeHtml(profile.status || "normal")}</p>
      </div>
      <div class="detail-grid">
        <div><span>累计活动</span><strong>${Number(profile.activityCount || 0)}</strong><p>开放发起记录</p></div>
        <div><span>累计报名回应</span><strong>${Number(profile.registrationCount || 0)}</strong><p>报名事件计数</p></div>
        <div><span>社区反馈</span><strong>${Number(profile.reportCount || 0)}</strong><p>成立 ${Number(profile.reportConfirmedCount || 0)} 次</p></div>
        <div><span>脱敏 IP</span><strong>${escapeHtml(profile.ipMasked || "-")}</strong><p>${escapeHtml(profile.userAgentSample || "")}</p></div>
      </div>
    </article>
    <section class="panel-block">
      <h3>Community Timeline</h3>
      ${communityEvents.length ? communityEvents.map(renderCommunityEventLine).join("") : events.length ? events.map((event) => `<p><strong>${Number(event.delta || 0) > 0 ? "+" : ""}${Number(event.delta || 0)}</strong> · ${escapeHtml(event.reason || event.type)} · ${formatDate(event.createdAt)}</p>`).join("") : `<p class="muted-text">暂无信用变化事件。</p>`}
    </section>
    <section class="panel-block">
      <h3>社区徽章</h3>
      ${badges.length ? badges.map((item) => `<p><strong>${escapeHtml(item.badge?.name || item.badgeId)}</strong> · ${escapeHtml(item.status)} · ${formatDate(item.grantedAt || item.updatedAt)}</p>`).join("") : `<p class="muted-text">暂无徽章授予记录。</p>`}
    </section>
    <section class="panel-block">
      <h3>关联活动</h3>
      ${activities.length ? activities.map((activity) => `<p><a href="admin-activity-confidence.html?id=${encodeURIComponent(activity.id)}">${escapeHtml(activity.title)}</a> · 风险分 ${Number(activity.riskScore || 0)} · ${formatDate(activity.createdAt)}</p>`).join("") : `<p class="muted-text">暂无关联活动。</p>`}
    </section>
  `;
  revealDynamicContent(container);
}

function renderCommunityEventLine(event = {}) {
  const delta = Number(event.effects?.trustDelta || 0);
  const policies = event.policyResults || [];
  return `
    <details class="review-detail community-event-line">
      <summary><strong>${delta > 0 ? "+" : ""}${delta}</strong> · ${escapeHtml(event.reason || event.type)} · ${formatDate(event.createdAt)}</summary>
      <p>事件类型：${escapeHtml(event.type)} · 来源：${escapeHtml(event.source || "system")}</p>
      <p>命中策略：${policies.length ? policies.map((policy) => `${escapeHtml(policy.policyName)} (${Number(policy.delta || 0) > 0 ? "+" : ""}${Number(policy.delta || 0)})`).join("；") : "无"}</p>
      <pre>${escapeHtml(jsonText(event.payload || {}, {}))}</pre>
    </details>
  `;
}

function fillStatusSelect(select) {
  if (!select) return;
  select.innerHTML = statusOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
}

async function fillLogFilters(form) {
  if (!form) return;
  const actionSelect = qs("[data-log-action-filter]", form);
  if (actionSelect) {
    actionSelect.innerHTML = logActionOptions
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join("");
  }

  const actorSelect = qs("[data-log-actor-filter]", form);
  if (!actorSelect) return;
  actorSelect.innerHTML = `<option value="">全部操作人</option><option value="system">系统</option>`;
  try {
    const { users } = await api.get("/api/users?page=1&pageSize=100");
    actorSelect.innerHTML = [
      `<option value="">全部操作人</option>`,
      `<option value="system">系统</option>`,
      ...users.map((item) => `<option value="${item.id}">${escapeHtml(item.nickname)}</option>`),
    ].join("");
  } catch {
    actorSelect.innerHTML = `<option value="">全部操作人</option><option value="system">系统</option>`;
  }
}

function bindAdminForms() {
  const userForm = qs("[data-user-form]");
  const moduleForm = qs("[data-module-form]");
  const userMessage = qs("[data-user-message]");
  const moduleMessage = qs("[data-module-message]");

  userForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api.post("/api/users", {
        nickname: userForm.nickname.value,
        phone: userForm.phone.value,
        role: selectedRole(userForm),
      });
      userForm.reset();
      setMessage(userMessage, "用户已添加。", "success");
      showToast("保存成功");
      resetPagedState("users");
      await renderUsers();
    } catch (error) {
      setMessage(userMessage, error.message, "error");
    }
  });

  moduleForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api.post("/api/modules", {
        name: moduleForm.name.value,
        description: moduleForm.description.value,
      });
      moduleForm.reset();
      setMessage(moduleMessage, "模块已添加。", "success");
      showToast("保存成功");
      resetPagedState("modulesPageItems");
      await renderModules();
    } catch (error) {
      setMessage(moduleMessage, error.message, "error");
    }
  });
}

function selectedRole(root) {
  return qs('[name="role"]', root)?.value || "collaborator";
}

function selectedPermissions(root) {
  const permissions = {};
  qsa("[data-permission-module][data-permission-action]", root).forEach((input) => {
    if (!input.checked) return;
    const moduleKey = input.dataset.permissionModule;
    const action = input.dataset.permissionAction;
    permissions[moduleKey] = permissions[moduleKey] || [];
    permissions[moduleKey].push(action);
  });
  return permissions;
}

function assignableRolesFrom(roles = []) {
  const source = roles.length ? roles : [{ key: "collaborator", name: "协作员" }];
  return source.filter((role) => role.key !== "admin");
}

function assignableRoles() {
  return assignableRolesFrom(mePageState.roles || []);
}

function roleDisplayName(roleKey = "") {
  const key = roleKey || "collaborator";
  return (mePageState.roles || []).find((role) => role.key === key)?.name || (key === "admin" ? "有空管理员" : key);
}

function fillRoleFilterSelect(select, roles = []) {
  if (!select) return;
  select.innerHTML = [
    `<option value="">全部角色</option>`,
    ...roles.map((role) => `<option value="${escapeHtml(role.key)}">${escapeHtml(role.name)}</option>`),
  ].join("");
}

function fillAssignableRoleSelect(select, roles = []) {
  if (!select) return;
  select.innerHTML = assignableRolesFrom(roles)
    .map((role) => `<option value="${escapeHtml(role.key)}">${escapeHtml(role.name)}</option>`)
    .join("");
}

async function loadRoleOptions(root = document) {
  const { roles, modules, actions } = await api.get("/api/roles?page=1&pageSize=100");
  mePageState.roles = roles || [];
  mePageState.permissionModules = modules || [];
  mePageState.permissionActions = actions || [];
  fillRoleFilterSelect(qs("[data-role-filter]", root), mePageState.roles);
  fillAssignableRoleSelect(qs("[data-user-role-select]", root), mePageState.roles);
  renderPermissionMatrix(qs("[data-permission-matrix]", root), {});
  return mePageState.roles;
}

function renderPermissionMatrix(container, permissions = {}, role = {}) {
  if (!container) return;
  const modules = mePageState.permissionModules || [];
  if (!modules.length) {
    container.innerHTML = `<p class="muted-text">正在读取权限模块...</p>`;
    return;
  }
  const locked = role.locked === true || role.key === "admin";
  container.innerHTML = modules.map((module) => `
    <section class="permission-row">
      <div>
        <strong>${escapeHtml(module.label)}</strong>
        <p>${escapeHtml(module.description || "")}</p>
      </div>
      <div class="permission-actions">
        ${(module.actions || []).map((action) => {
          const checked = Array.isArray(permissions[module.key]) && permissions[module.key].includes(action);
          const actionLabel = (mePageState.permissionActions || []).find((item) => item.key === action)?.label || action;
          return `
            <label class="permission-chip">
              <input class="permission-chip-input" type="checkbox" data-permission-module="${escapeHtml(module.key)}" data-permission-action="${escapeHtml(action)}" ${checked ? "checked" : ""} ${locked ? "disabled" : ""} />
              <span class="permission-chip-check" aria-hidden="true"></span>
              <span>${escapeHtml(actionLabel)}</span>
            </label>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");
  updatePermissionSummary(container.closest("form") || container);
}

function resetRoleForm(form = qs("[data-role-form]")) {
  if (!form) return;
  mePageState.editingRole = null;
  form.reset();
  if (form.key) {
    form.key.disabled = false;
    form.key.value = "";
  }
  renderPermissionMatrix(qs("[data-permission-matrix]", form), {});
  qs("[data-role-form-title]", form)?.replaceChildren(document.createTextNode("新增角色"));
  qs("[data-role-editor-heading]")?.replaceChildren(document.createTextNode("新增一个后台角色。"));
  qs("[data-role-submit]", form) && (qs("[data-role-submit]", form).textContent = "保存角色");
  qs("[data-role-reset]", form) && (qs("[data-role-reset]", form).hidden = true);
  updatePermissionSummary(form);
}

function fillRoleForm(form, role = {}, options = {}) {
  if (!form) return;
  mePageState.editingRole = role;
  form.key.value = role.key || "";
  form.key.disabled = true;
  form.name.value = role.name || "";
  form.description.value = role.description || "";
  renderPermissionMatrix(qs("[data-permission-matrix]", form), role.permissions || {}, role);
  qs("[data-role-form-title]", form)?.replaceChildren(document.createTextNode(`编辑 ${role.name || role.key}`));
  qs("[data-role-editor-heading]")?.replaceChildren(document.createTextNode(`编辑 ${role.name || role.key}。`));
  qs("[data-role-submit]", form) && (qs("[data-role-submit]", form).textContent = "保存修改");
  qs("[data-role-reset]", form) && (qs("[data-role-reset]", form).hidden = false);
  updatePermissionSummary(form);
  if (options.scroll !== false) form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updatePermissionSummary(root = document) {
  const target = root.closest?.("form") || root;
  const summary = qs("[data-permission-summary]", target);
  if (!summary) return;
  const count = qsa("[data-permission-module][data-permission-action]", target).filter((input) => input.checked).length;
  summary.textContent = `${count} 个动作权限`;
}

async function saveRole(form, options = {}) {
  const message = qs("[data-role-message]", form) || qs("[data-role-message]");
  const editing = mePageState.editingRole;
  const payload = {
    key: form.key.value,
    name: form.name.value,
    description: form.description.value,
    permissions: selectedPermissions(form),
  };
  try {
    editing
      ? await api.put(`/api/roles/${encodeURIComponent(editing.id)}`, payload)
      : await api.post("/api/roles", payload);
    showToast("保存成功");
    setMessage(message, "角色权限已保存。", "success");
    if (options.redirect) {
      setTimeout(() => {
        location.href = "admin-roles.html";
      }, 520);
      return;
    }
    resetRoleForm(form);
    await loadRoleOptions(document);
    await renderRoles();
  } catch (error) {
    setMessage(message, error.message, "error");
  }
}

function bindTemplateForm(form = qs("[data-template-form]")) {
  if (!form) return;
  const message = qs("[data-template-message]");
  window.youkongRichEditor?.mount(form);
  resetTemplateForm(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    window.youkongRichEditor?.sync(form);
    const editing = mePageState.editingTemplate;
    const payload = {
      name: form.name.value,
      description: form.description.value,
      content: form.content.value,
    };
    setMessage(message, editing ? "正在保存模板..." : "正在新增模板...");
    try {
      editing
        ? await api.put(`/api/templates/${editing.id}`, payload)
        : await api.post("/api/templates", payload);
      setMessage(message, "模板已保存。", "success");
      showToast("保存成功");
      setTimeout(() => {
        location.href = "admin-templates.html";
      }, 520);
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

function resetTemplateForm(form) {
  mePageState.editingTemplate = null;
  form.reset();
  window.youkongRichEditor?.reset(form);
  qs("[data-template-form-title]", form)?.replaceChildren(document.createTextNode("新增活动模板"));
  qs("[data-template-submit]", form) && (qs("[data-template-submit]", form).textContent = "保存模板");
}

function fillTemplateForm(form, template) {
  mePageState.editingTemplate = template;
  form.name.value = template.name || "";
  form.description.value = template.description || "";
  form.content.value = template.content || "";
  window.youkongRichEditor?.setHtml(form, template.content || "");
  qs("[data-template-form-title]", form)?.replaceChildren(document.createTextNode("编辑活动模板"));
  qs("[data-template-editor-heading]")?.replaceChildren(document.createTextNode("编辑活动模板。"));
  qs("[data-template-submit]", form).textContent = "保存修改";
}

function renderRoleControls(user = {}) {
  const role = user.role || (user.roles || [])[0] || "collaborator";
  if (role === "admin") {
    return `<span class="tag">有空管理员</span>`;
  }
  const roles = assignableRoles();
  return `
    <select name="role" aria-label="角色">
      ${roles.map((item) => `<option value="${escapeHtml(item.key)}" ${item.key === role ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
    </select>
  `;
}

async function renderRoles() {
  const list = qs("[data-role-list]");
  if (!list) return;
  const query = queryFromForm(qs("[data-role-filters]"), {
    page: 1,
    pageSize: 100,
  });
  const { roles, pageInfo, modules, actions } = await api.get(`/api/roles${query}`);
  mePageState.roles = roles || [];
  mePageState.permissionModules = modules || mePageState.permissionModules || [];
  mePageState.permissionActions = actions || mePageState.permissionActions || [];
  updatePagedCount(qs("[data-role-count]"), roles.length, pageInfo);
  if (!roles.length) {
    list.innerHTML = `<div class="empty-state"><strong>没有找到角色</strong><p>换一个关键词试试。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  const user = mePageState.user || getCachedUser();
  list.innerHTML = roles.map((role) => {
    const permissionCount = Object.values(role.permissions || {}).reduce((total, actions) => total + (Array.isArray(actions) ? actions.length : 0), 0);
    const canEdit = !role.locked && hasPermission(user, "roles", "edit");
    const canDelete = !role.builtIn && !role.locked && role.key !== "admin" && role.key !== "collaborator" && hasPermission(user, "roles", "delete");
    return `
      <article class="event-row role-row" data-role-id="${escapeHtml(role.id)}">
        <div>
          <div class="tag-row">
            <span class="tag">${role.locked ? "系统锁定" : role.builtIn ? "内置角色" : "自定义角色"}</span>
            <span class="tag soft">${escapeHtml(role.key)}</span>
          </div>
          <h3>${escapeHtml(role.name)}</h3>
          <p>${escapeHtml(role.description || "暂无说明")}</p>
          <p>${permissionCount} 个动作权限 · ${formatDate(role.updatedAt || role.createdAt)}</p>
        </div>
        <div class="row-actions">
          ${canEdit ? `<a class="button outline" href="admin-role-editor.html?id=${encodeURIComponent(role.id)}">编辑</a>` : `<button class="button outline" type="button" disabled>编辑</button>`}
          <button class="button outline danger-soft" type="button" data-delete-role ${canDelete ? "" : "disabled"}>删除</button>
        </div>
      </article>
    `;
  }).join("");
  revealDynamicContent(list);
  qsa("[data-role-id]", list).forEach((row) => {
    const role = roles.find((item) => item.id === row.dataset.roleId);
    qs("[data-delete-role]", row)?.addEventListener("click", async () => {
      if (!confirm("确定删除这个角色吗？仍有用户使用时无法删除。")) return;
      await api.delete(`/api/roles/${encodeURIComponent(role.id)}`);
      showToast("删除成功");
      await loadRoleOptions(document);
      await renderRoles();
    });
  });
}

async function renderUsers() {
  const list = qs("[data-user-list]");
  if (!list) return;
  const filters = qs("[data-member-filters]");
  const query = queryFromForm(filters, {
    page: mePageState.userPage,
    pageSize: mePageState.pageSize,
  });
  const { users, pageInfo } = await api.get(`/api/users${query}`);
  const loaded = mergePageItems("users", mePageState.userPage, users);
  updatePagedCount(qs("[data-member-count]"), loaded.length, pageInfo);
  updateLoadMore(qs("[data-load-more-users]"), loaded.length, pageInfo?.total || loaded.length);
  if (!loaded.length) {
    list.innerHTML = `<div class="empty-state"><strong>没有找到用户</strong><p>换一个关键词或角色筛选试试。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  list.innerHTML = loaded
    .map(
      (user) => `
        <article class="manage-row user-manage-row" data-user-id="${user.id}">
          <input name="nickname" value="${escapeHtml(user.nickname)}" />
          <input name="phone" value="${escapeHtml(user.phone)}" inputmode="tel" />
          <div class="role-control">${renderRoleControls(user)}</div>
          <button class="button outline" type="button" data-save-user ${hasPermission(mePageState.user, "users", "edit") ? "" : "disabled"}>保存</button>
          <button class="button outline danger-soft" type="button" data-delete-user ${user.id === "admin" || !hasPermission(mePageState.user, "users", "delete") ? "disabled" : ""}>删除</button>
        </article>
      `
    )
    .join("");
  revealDynamicContent(list);

  qsa("[data-user-id]", list).forEach((row) => {
    qs("[data-save-user]", row).addEventListener("click", async () => {
      await api.put(`/api/users/${row.dataset.userId}`, {
        nickname: qs('[name="nickname"]', row).value,
        phone: qs('[name="phone"]', row).value,
        role: selectedRole(row),
      });
      showToast("保存成功");
      resetPagedState("users");
      await renderUsers();
    });
    qs("[data-delete-user]", row).addEventListener("click", async () => {
      if (!confirm("确定删除这个用户吗？")) return;
      await api.delete(`/api/users/${row.dataset.userId}`);
      showToast("删除成功");
      resetPagedState("users");
      await renderUsers();
    });
  });
}

function renderPendingTasks(container, activities = [], options = {}) {
  if (!container) return;
  const feedbacks = options.feedbacks || [];
  if (!activities.length && !feedbacks.length) {
    container.innerHTML = `<div class="empty-state"><strong>暂无待办</strong><p>需要处理的活动或反馈会出现在这里。</p></div>`;
    revealDynamicContent(container);
    return;
  }
  container.innerHTML = [
    activities.length ? `
      <section class="pending-task-group">
        <div class="pending-task-head">
          <div>
            <span class="tag soft">活动审核</span>
            <h3>需要判断是否继续流转的活动</h3>
          </div>
          <small>${activities.length} 条</small>
        </div>
        <div class="event-list rows">${activities.map(renderReviewTask).join("")}</div>
      </section>
    ` : "",
    feedbacks.length ? `
      <section class="pending-task-group">
        <div class="pending-task-head">
          <div>
            <span class="tag soft">反馈审核</span>
            <h3>AI 拦截后需要管理员决定是否展示的匿名反馈</h3>
          </div>
          <small>${feedbacks.length} 条</small>
        </div>
        <div class="event-list rows">${feedbacks.map((feedback) => renderFeedbackRow(feedback, { reviewActions: true, taskMode: true })).join("")}</div>
      </section>
    ` : "",
  ].join("");
  revealDynamicContent(container);
  bindReviewButtons(container);
  bindFeedbackReviewActions(container, options.onRefresh || (async () => {}));
}

function renderReviewTask(activity) {
  return `
    <article class="event-row review-row" data-review-activity-id="${activity.id}">
      <div>
        <span class="tag">${escapeHtml(activity.reviewStepLabel)}</span>
        <h3>${escapeHtml(activity.title)}</h3>
        <p>${escapeHtml(activity.moduleName)} · ${formatActivityTime(activity)} · ${escapeHtml(activity.location || "地点待定")}</p>
        <p>发起人：${escapeHtml(activity.initiator)} · 协作员：${escapeHtml(activity.collaboratorName || "未选择")}</p>
        <details class="review-detail">
          <summary>查看活动详情</summary>
          ${activity.coverUrl ? `<img class="review-cover" src="${escapeHtml(activity.coverUrl)}" alt="${escapeHtml(activity.title)}" />` : ""}
          <div class="article-content compact">${descriptionToHtml(activity.description || "暂无活动描述")}</div>
          ${renderReviewHistory(activity)}
        </details>
        <div class="review-actions">
          <label>审核意见
            <select data-review-action>
              <option value="" selected disabled>请选择</option>
              <option value="approve">通过</option>
              <option value="return">退回</option>
              <option value="reject">拒绝</option>
            </select>
          </label>
          <label>备注
            <textarea data-review-comment placeholder="填写审核说明，可留空"></textarea>
          </label>
          <button class="button primary" type="button" data-review-submit>提交审核</button>
        </div>
      </div>
    </article>
  `;
}

function renderReviewHistory(activity) {
  const logs = activity.reviewLogs || [];
  if (!logs.length) return `<p class="muted-text">暂无审核记录。</p>`;
  return `
    <div class="review-history">
      ${logs
        .map((log) => `<p><strong>${escapeHtml(log.actorName || "系统")}</strong> ${escapeHtml(actionLabels[log.action] || log.action)} · ${formatDate(log.createdAt)}${log.comment ? `：${escapeHtml(log.comment)}` : ""}</p>`)
        .join("")}
    </div>
  `;
}

function bindReviewButtons(container) {
  qsa("[data-review-submit]", container).forEach((button) => {
    button.addEventListener("click", async () => {
      const row = button.closest("[data-review-activity-id]");
      const action = qs("[data-review-action]", row).value;
      if (!action) {
        alert("请先选择审核意见");
        return;
      }
      await api.post(`/api/activities/${row.dataset.reviewActivityId}/review`, {
        action,
        comment: qs("[data-review-comment]", row).value,
      });
      showToast("保存成功");
      resetPagedState("myActivities");
      resetPagedState("adminActivities");
      await Promise.all([
        renderMyPendingTasks(),
        renderAdminPendingTasks(),
        renderAllActivities(),
        renderMineActivities(),
        renderActivityLists(),
      ]);
    });
  });
}

async function renderAdminPendingTasks() {
  const panel = qs("[data-admin-pending]");
  if (!panel) return;
  const { activities } = await api.get("/api/activities?pending=me");
  renderPendingTasks(panel, activities);
}

async function renderAllActivities() {
  const list = qs("[data-all-activities]");
  if (!list) return;
  const currentUser = mePageState.user || getCachedUser();
  const filters = qs("[data-admin-activity-filters]");
  const query = queryFromForm(filters, {
    all: "true",
    page: mePageState.adminActivityPage,
    pageSize: mePageState.pageSize,
  });
  const { activities, pageInfo } = await api.get(`/api/activities${query}`);
  const loaded = mergePageItems("adminActivities", mePageState.adminActivityPage, activities);
  updatePagedCount(qs("[data-admin-activity-count]"), loaded.length, pageInfo);
  updateLoadMore(qs("[data-load-more-admin-activities]"), loaded.length, pageInfo?.total || loaded.length);
  if (!loaded.length) {
    list.innerHTML = `<div class="empty-state"><strong>暂无活动</strong><p>所有状态的活动会显示在这里。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  list.innerHTML = loaded
    .map(
      (activity) => `
        <article class="event-row">
          <div>
            <div class="tag-row"><span class="tag">${escapeHtml(statusTone[activity.status] || activity.statusLabel)}</span><span class="tag soft">${escapeHtml(activity.sourceName || activity.sourceLabel || "客厅")}</span></div>
            <h3><a href="activity.html?id=${activity.id}">${escapeHtml(activity.title)}</a></h3>
            <p>${escapeHtml(activity.reviewStepLabel)} · ${formatActivityTime(activity)} · ${escapeHtml(activity.location || "地点待定")} · ${activity.registrationCount} 人报名 · ${Number(activity.feedbackCount || 0)} 条反馈</p>
            <p>发起人：${escapeHtml(activity.initiator)} · 协作员：${escapeHtml(activity.collaboratorName || "未选择")}</p>
          </div>
          <div class="row-actions">
            <a class="button outline" href="activity.html?id=${encodeURIComponent(activity.id)}">查看</a>
            <a class="button outline" href="admin-activity-confidence.html?id=${encodeURIComponent(activity.id)}">置信度</a>
            ${canViewRegistrations(activity) ? `<a class="button outline" href="registrations.html?id=${encodeURIComponent(activity.id)}">报名表</a>` : ""}
            <a class="button outline" href="activity-feedback.html?id=${encodeURIComponent(activity.id)}">反馈</a>
            ${canAdminCancel(activity) && hasPermission(currentUser, "activities", "cancel") ? `<button class="button outline danger-soft" type="button" data-admin-cancel-activity-id="${activity.id}">取消</button>` : ""}
            ${canAdminEnd(activity) && hasPermission(currentUser, "activities", "end") ? `<button class="button outline" type="button" data-admin-end-activity-id="${activity.id}">结束</button>` : ""}
          </div>
        </article>
      `
    )
    .join("");
  revealDynamicContent(list);

  qsa("[data-admin-cancel-activity-id]", list).forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("确定取消这个活动吗？")) return;
      await api.post(`/api/activities/${button.dataset.adminCancelActivityId}/cancel`, {});
      showToast("保存成功");
      resetPagedState("adminActivities");
      await renderAllActivities();
    });
  });
  qsa("[data-admin-end-activity-id]", list).forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("确定结束这个活动吗？")) return;
      await api.post(`/api/activities/${button.dataset.adminEndActivityId}/end`, {});
      showToast("保存成功");
      resetPagedState("adminActivities");
      await renderAllActivities();
    });
  });
}

function canAdminCancel(activity) {
  return !["cancelled", "not_formed_cancelled", "ended", "rejected"].includes(activity.status);
}

function canAdminEnd(activity) {
  return ["published", "full"].includes(activity.status);
}

async function renderModules() {
  const list = qs("[data-module-list]");
  if (!list) return;
  const filters = qs("[data-module-filters]");
  const query = queryFromForm(filters, {
    paged: "true",
    page: mePageState.modulePage,
    pageSize: mePageState.pageSize,
  });
  const { modules, pageInfo } = await api.get(`/api/modules${query}`);
  const loaded = mergePageItems("modulesPageItems", mePageState.modulePage, modules);
  updatePagedCount(qs("[data-module-count]"), loaded.length, pageInfo);
  updateLoadMore(qs("[data-load-more-modules]"), loaded.length, pageInfo?.total || loaded.length);
  if (!loaded.length) {
    list.innerHTML = `<div class="empty-state"><strong>没有找到模块</strong><p>换一个关键词试试。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  const user = mePageState.user || getCachedUser();
  list.innerHTML = loaded
    .map(
      (module) => `
        <article class="manage-row" data-module-id="${module.id}">
          <input name="name" value="${escapeHtml(module.name)}" />
          <input name="description" value="${escapeHtml(module.description || "")}" />
          <button class="button outline" type="button" data-save-module ${hasPermission(user, "modules", "edit") ? "" : "disabled"}>保存</button>
          <button class="button outline danger-soft" type="button" data-delete-module ${hasPermission(user, "modules", "delete") ? "" : "disabled"}>删除</button>
        </article>
      `
    )
    .join("");
  revealDynamicContent(list);

  qsa("[data-module-id]", list).forEach((row) => {
    qs("[data-save-module]", row).addEventListener("click", async () => {
      await api.put(`/api/modules/${row.dataset.moduleId}`, {
        name: qs('[name="name"]', row).value,
        description: qs('[name="description"]', row).value,
      });
      showToast("保存成功");
      resetPagedState("modulesPageItems");
      await renderModules();
    });
    qs("[data-delete-module]", row).addEventListener("click", async () => {
      try {
        if (!confirm("确定删除这个活动模块吗？")) return;
        await api.delete(`/api/modules/${row.dataset.moduleId}`);
        showToast("删除成功");
        resetPagedState("modulesPageItems");
        await renderModules();
      } catch (error) {
        alert(error.message);
      }
    });
  });
}

async function renderTemplates() {
  const list = qs("[data-template-list]");
  if (!list) return;
  const filters = qs("[data-template-filters]");
  const query = queryFromForm(filters, {
    page: mePageState.templatePage,
    pageSize: mePageState.pageSize,
  });
  const { templates, pageInfo } = await api.get(`/api/templates${query}`);
  const loaded = mergePageItems("templates", mePageState.templatePage, templates);
  updatePagedCount(qs("[data-template-count]"), loaded.length, pageInfo);
  updateLoadMore(qs("[data-load-more-templates]"), loaded.length, pageInfo?.total || loaded.length);
  if (!loaded.length) {
    list.innerHTML = `<div class="empty-state"><strong>还没有活动模板</strong><p>可以先新增一个放映、食堂或夜校的常用描述。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  const user = mePageState.user || getCachedUser();
  list.innerHTML = loaded
    .map(
      (template) => `
        <article class="event-row template-row" data-template-id="${template.id}">
          <div>
            <span class="tag">活动模板</span>
            <h3>${escapeHtml(template.name)}</h3>
            <p>${escapeHtml(template.description || "暂无说明")}</p>
            <p>${formatDate(template.updatedAt || template.createdAt)}</p>
          </div>
          <div class="row-actions">
            <a class="button outline${hasPermission(user, "templates", "edit") ? "" : " is-disabled"}" ${hasPermission(user, "templates", "edit") ? `href="admin-template-editor.html?id=${encodeURIComponent(template.id)}"` : `aria-disabled="true"`}>编辑</a>
            <button class="button outline danger-soft" type="button" data-delete-template ${hasPermission(user, "templates", "delete") ? "" : "disabled"}>删除</button>
          </div>
        </article>
      `
    )
    .join("");
  revealDynamicContent(list);

  qsa("[data-template-id]", list).forEach((row) => {
    qs("[data-delete-template]", row).addEventListener("click", async () => {
      if (!confirm("确定删除这个活动模板吗？")) return;
      await api.delete(`/api/templates/${row.dataset.templateId}`);
      showToast("删除成功");
      resetPagedState("templates");
      await renderTemplates();
    });
  });
}

async function renderLogs() {
  const list = qs("[data-log-list]");
  if (!list) return;
  const filters = qs("[data-log-filters]");
  const query = queryFromForm(filters, {
    page: mePageState.logPage,
    pageSize: mePageState.pageSize,
  });
  const { logs, pageInfo } = await api.get(`/api/logs${query}`);
  const loaded = mergePageItems("logs", mePageState.logPage, logs);
  updatePagedCount(qs("[data-log-count]"), loaded.length, pageInfo);
  updateLoadMore(qs("[data-load-more-logs]"), loaded.length, pageInfo?.total || loaded.length);
  if (!loaded.length) {
    list.innerHTML = `<div class="empty-state"><strong>暂无日志</strong><p>系统里的关键操作会显示在这里。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  list.innerHTML = loaded
    .map(
      (log) => `
        <article class="event-row log-row">
          <div>
            <span class="tag">${escapeHtml(log.actionLabel || log.action)}</span>
            <h3>${escapeHtml(log.targetName || log.targetId || "系统操作")}</h3>
            <p>${escapeHtml(log.detail || "")}</p>
            <p>${escapeHtml(log.actorName || "访客")} · ${escapeHtml(log.actorRole || "")} · ${formatDate(log.createdAt)}</p>
          </div>
          <div class="row-actions">
            <span class="muted-text">${escapeHtml(log.targetType || "system")}</span>
          </div>
        </article>
      `
    )
    .join("");
  revealDynamicContent(list);
}

function reportStatusLabel(status = "") {
  return {
    submitted: "已提交",
    substantiated: "举报成立",
    unsubstantiated: "已记录",
    existing: "重复举报",
  }[status] || status || "已提交";
}

async function renderReports() {
  const list = qs("[data-report-list]");
  if (!list) return;
  const filters = qs("[data-report-filters]");
  const query = queryFromForm(filters, {
    page: mePageState.reportPage,
    pageSize: mePageState.pageSize,
  });
  const { reports, pageInfo } = await api.get(`/api/reports${query}`);
  const loaded = mergePageItems("reports", mePageState.reportPage, reports);
  updatePagedCount(qs("[data-report-count]"), loaded.length, pageInfo);
  updateLoadMore(qs("[data-load-more-reports]"), loaded.length, pageInfo?.total || loaded.length);
  if (!loaded.length) {
    list.innerHTML = `<div class="empty-state"><strong>暂无社区举报</strong><p>访客提交举报后，会在这里看到记录和复核结论。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  list.innerHTML = loaded.map((report) => `
    <article class="event-row report-row">
      <div>
        <span class="tag">${escapeHtml(reportStatusLabel(report.status))}</span>
        <h3>${escapeHtml(report.activityTitle || report.activityId || "未命名活动")}</h3>
        <p>${escapeHtml(report.reason)} · ${formatDate(report.createdAt)} · 活动状态：${escapeHtml(report.activityStatusLabel || report.activityStatus || "-")}</p>
        <p>${escapeHtml(report.detail || "没有补充说明")}</p>
        ${report.reportReview ? `<p>复核：风险分 ${Number(report.reportReview.riskScore || 0)} · ${report.reportReview.matched ? "举报理由与分析相符" : "暂未支持下架"}</p>` : ""}
      </div>
      <div class="row-actions">
        <a class="button outline" href="activity.html?id=${encodeURIComponent(report.activityId)}">查看活动</a>
        <a class="button outline" href="admin-activity-confidence.html?id=${encodeURIComponent(report.activityId)}">置信度</a>
      </div>
    </article>
  `).join("");
  revealDynamicContent(list);
}

async function initAdminFriendsPage() {
  const root = qs("[data-admin-friends-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "friends", "view");
  if (!user) return;
  const form = qs("[data-friend-form]", root);
  const filters = qs("[data-friend-filters]", root);
  const message = qs("[data-friend-message]", root);
  if (form?.closest(".form-note")) form.closest(".form-note").hidden = !hasPermission(user, "friends", "create") && !hasPermission(user, "friends", "edit");
  filters?.addEventListener("submit", (event) => {
    event.preventDefault();
    resetPagedState("friends");
    renderFriends();
  });
  qs("[data-load-more-friends]", root)?.addEventListener("click", () => {
    mePageState.friendPage += 1;
    renderFriends();
  });
  qs("[data-cancel-friend-edit]", form)?.addEventListener("click", () => {
    mePageState.editingFriend = null;
    form.reset();
    form.enabled.value = "true";
    qs("[data-friend-form-title]", form).textContent = "新增客厅朋友";
    qs("[data-cancel-friend-edit]", form).hidden = true;
    setMessage(message, "已取消编辑。");
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const editing = mePageState.editingFriend;
    try {
      editing
        ? await api.put(`/api/living-room-friends/${encodeURIComponent(editing.id)}`, formData)
        : await api.post("/api/living-room-friends", formData);
      showToast("保存成功");
      setMessage(message, "保存成功", "success");
      mePageState.editingFriend = null;
      form.reset();
      form.enabled.value = "true";
      qs("[data-friend-form-title]", form).textContent = "新增客厅朋友";
      qs("[data-cancel-friend-edit]", form).hidden = true;
      resetPagedState("friends");
      await renderFriends();
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
  await renderFriends();
}

async function renderFriends() {
  const list = qs("[data-friend-list]");
  if (!list) return;
  const filters = qs("[data-friend-filters]");
  const query = queryFromForm(filters, {
    page: mePageState.friendPage,
    pageSize: mePageState.pageSize,
  });
  const { friends, pageInfo } = await api.get(`/api/living-room-friends${query}`);
  const loaded = mergePageItems("friends", mePageState.friendPage, friends);
  updatePagedCount(qs("[data-friend-count]"), loaded.length, pageInfo);
  updateLoadMore(qs("[data-load-more-friends]"), loaded.length, pageInfo?.total || loaded.length);
  if (!loaded.length) {
    list.innerHTML = `<div class="empty-state"><strong>还没有客厅朋友</strong><p>新增后，发起活动时就可以选择它。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  const user = mePageState.user || getCachedUser();
  list.innerHTML = loaded.map((friend) => `
    <article class="event-row" data-friend-id="${escapeHtml(friend.id)}">
      <div>
        <div class="tag-row"><span class="tag">${friend.enabled ? "启用" : "停用"}</span><span class="tag soft">${escapeHtml(friend.address || "地址待补")}</span></div>
        <h3>${escapeHtml(friend.name)}</h3>
        <p>${escapeHtml(friend.description || "暂无简介")}</p>
        <p>${escapeHtml(friend.contactName || "联系人待补")} · ${escapeHtml(friend.contactInfo || "联系方式待补")}</p>
      </div>
      <div class="row-actions">
        <button class="button outline" type="button" data-edit-friend ${hasPermission(user, "friends", "edit") ? "" : "disabled"}>编辑</button>
        <button class="button outline danger-soft" type="button" data-delete-friend ${hasPermission(user, "friends", "delete") ? "" : "disabled"}>删除</button>
      </div>
    </article>
  `).join("");
  revealDynamicContent(list);
  qsa("[data-friend-id]", list).forEach((row) => {
    const friend = loaded.find((item) => item.id === row.dataset.friendId);
    qs("[data-edit-friend]", row)?.addEventListener("click", () => fillFriendForm(friend));
    qs("[data-delete-friend]", row)?.addEventListener("click", async () => {
      if (!confirm("确定删除这个客厅朋友吗？已有活动使用时不能删除。")) return;
      await api.delete(`/api/living-room-friends/${encodeURIComponent(row.dataset.friendId)}`);
      showToast("删除成功");
      resetPagedState("friends");
      await renderFriends();
    });
  });
}

function fillFriendForm(friend = {}) {
  const form = qs("[data-friend-form]");
  if (!form) return;
  mePageState.editingFriend = friend;
  form.name.value = friend.name || "";
  form.address.value = friend.address || "";
  form.contactName.value = friend.contactName || "";
  form.contactInfo.value = friend.contactInfo || "";
  form.enabled.value = friend.enabled === false ? "false" : "true";
  form.logoUrl.value = friend.logoUrl || "";
  form.description.value = friend.description || "";
  form.logo.value = "";
  qs("[data-friend-form-title]", form).textContent = "编辑客厅朋友";
  qs("[data-cancel-friend-edit]", form).hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function initAdminFeedbacksPage() {
  const root = qs("[data-admin-feedbacks-page]");
  if (!root) return;
  const user = await requireAdminUser(root, "feedbacks", "view");
  if (!user) return;
  const filters = qs("[data-feedback-filters]", root);
  filters?.addEventListener("submit", (event) => {
    event.preventDefault();
    resetPagedState("feedbacks");
    renderFeedbacks();
  });
  qs("[data-load-more-feedbacks]", root)?.addEventListener("click", () => {
    mePageState.feedbackPage += 1;
    renderFeedbacks();
  });
  const exportButton = qs("[data-export-feedbacks]", root);
  if (exportButton) exportButton.hidden = !hasPermission(user, "feedbacks", "export");
  exportButton?.addEventListener("click", downloadFeedbacksCsv);
  await renderFeedbacks();
}

async function renderFeedbacks() {
  const list = qs("[data-feedback-list]");
  if (!list) return;
  const filters = qs("[data-feedback-filters]");
  const query = queryFromForm(filters, {
    page: mePageState.feedbackPage,
    pageSize: mePageState.pageSize,
  });
  const { feedbacks, pageInfo } = await api.get(`/api/feedbacks${query}`);
  const loaded = mergePageItems("feedbacks", mePageState.feedbackPage, feedbacks);
  updatePagedCount(qs("[data-feedback-count]"), loaded.length, pageInfo);
  updateLoadMore(qs("[data-load-more-feedbacks]"), loaded.length, pageInfo?.total || loaded.length);
  if (!loaded.length) {
    list.innerHTML = `<div class="empty-state"><strong>暂无活动反馈</strong><p>活动开始后，参与者扫码提交的匿名反馈会显示在这里。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  list.innerHTML = loaded.map((feedback) => renderFeedbackRow(feedback, { reviewActions: true })).join("");
  bindFeedbackReviewActions(list, renderFeedbacks);
  revealDynamicContent(list);
}

function renderFeedbackText(feedback = {}) {
  return [
    feedback.favorite ? `最喜欢：${feedback.favorite}` : "",
    feedback.improvement ? `可以改进：${feedback.improvement}` : "",
    feedback.other ? `其他：${feedback.other}` : "",
  ].filter(Boolean).join(" / ") || "没有文字内容";
}

function renderFeedbackReviewButtons(feedback = {}, options = {}) {
  if (!options.reviewActions) return "";
  if (!hasPermission(mePageState.user || getCachedUser(), "feedbacks", "review")) return "";
  if (feedback.status === "approved") {
    return `<button class="button outline danger-soft" type="button" data-reject-feedback data-feedback-action-label="隐藏">隐藏</button>`;
  }
  if (feedback.status === "rejected") {
    return `<button class="button outline" type="button" data-approve-feedback data-feedback-action-label="恢复展示">恢复展示</button>`;
  }
  return `<button class="button outline" type="button" data-approve-feedback data-feedback-action-label="展示">展示</button><button class="button outline danger-soft" type="button" data-reject-feedback data-feedback-action-label="不展示">不展示</button>`;
}

function renderFeedbackRow(feedback = {}, options = {}) {
  return `
    <article class="event-row feedback-row${options.taskMode ? " feedback-task-row" : ""}" data-feedback-id="${escapeHtml(feedback.id)}">
      <div>
        <div class="tag-row"><span class="tag">${escapeHtml(feedback.statusLabel || feedbackStatusLabel(feedback.status))}</span><span class="tag soft">权重 ${Number(feedback.feedbackWeight || 0)}</span></div>
        <h3><a href="activity.html?id=${encodeURIComponent(feedback.activityId)}">${escapeHtml(feedback.activityTitle || "未命名活动")}</a></h3>
        <p>${escapeHtml(renderFeedbackText(feedback))}</p>
        <p>AI：${escapeHtml(feedback.aiStatus || "未分析")} · ${escapeHtml(feedback.aiReason || "暂无说明")} · ${formatDate(feedback.createdAt)}</p>
      </div>
      <div class="row-actions">
        <a class="button outline" href="activity-feedback.html?id=${encodeURIComponent(feedback.activityId)}">活动反馈</a>
        ${renderFeedbackReviewButtons(feedback, options)}
      </div>
    </article>
  `;
}

function bindFeedbackReviewActions(root = document, after = async () => {}) {
  qsa("[data-feedback-id]", root).forEach((row) => {
    qs("[data-approve-feedback]", row)?.addEventListener("click", async () => {
      await api.post(`/api/feedbacks/${encodeURIComponent(row.dataset.feedbackId)}/review`, { action: "approve" });
      showToast("保存成功");
      resetPagedState("feedbacks");
      await after();
    });
    qs("[data-reject-feedback]", row)?.addEventListener("click", async () => {
      const label = qs("[data-reject-feedback]", row).dataset.feedbackActionLabel || "不展示";
      if (!confirm(`确定${label}这条反馈吗？`)) return;
      await api.post(`/api/feedbacks/${encodeURIComponent(row.dataset.feedbackId)}/review`, { action: "reject" });
      showToast("保存成功");
      resetPagedState("feedbacks");
      await after();
    });
  });
}

async function downloadFeedbacksCsv() {
  const filters = qs("[data-feedback-filters]");
  const query = queryFromForm(filters, {});
  const token = localStorage.getItem("yk_session_token");
  const response = await fetch(`${api.baseUrl}/api/feedbacks/export${query}`, {
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-YK-Client-Id": getClientId(),
      "X-YK-Fingerprint": getFingerprint(),
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    showToast(data.error || "导出失败");
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `有空活动反馈-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function feedbackPageUrl(activityId) {
  return new URL(`feedback.html?id=${encodeURIComponent(activityId)}`, location.href).href;
}

async function loadQrSvg(text) {
  const response = await fetch(`${api.baseUrl}/api/qr?text=${encodeURIComponent(text)}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("二维码生成失败");
  return response.text();
}

async function initActivityFeedbackPage() {
  const root = qs("[data-activity-feedback-page]");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    root.innerHTML = `<section class="section"><div class="wrap"><div class="empty-state"><strong>缺少活动 ID</strong><p>请从我的活动进入。</p></div></div></section>`;
    return;
  }
  await renderActivityFeedbackPage(root, id);
  qs("[data-load-more-activity-feedbacks]", root)?.addEventListener("click", async () => {
    mePageState.activityFeedbackPage += 1;
    await renderActivityFeedbackList(root, id);
  });
}

async function renderActivityFeedbackPage(root, id) {
  const { activity } = await api.get(`/api/activities/${encodeURIComponent(id)}`);
  qs("[data-feedback-activity-title]", root).textContent = activity.title;
  qs("[data-feedback-activity-summary]", root).textContent = `${activity.sourceName || "有空客厅"} · ${formatActivityTime(activity)} · ${activity.location}`;
  const url = feedbackPageUrl(activity.id);
  qs("[data-open-feedback-form]", root).href = url;
  const qrBox = qs("[data-feedback-qr]", root);
  try {
    const svg = await loadQrSvg(url);
    qrBox.innerHTML = svg;
    const downloadButton = qs("[data-download-feedback-qr]", root);
    downloadButton?.addEventListener("click", async () => {
      downloadButton.disabled = true;
      try {
        await downloadFeedbackQrJpg(`${activity.title || "活动反馈"}-反馈二维码.jpg`, svg);
        showToast("反馈二维码 JPG 已生成");
      } catch (error) {
        showToast(error.message || "二维码下载失败");
      } finally {
        downloadButton.disabled = false;
      }
    });
  } catch (error) {
    qrBox.innerHTML = `<div class="empty-state slim"><strong>二维码生成失败</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
  await renderActivityFeedbackList(root, id);
}

async function renderActivityFeedbackList(root, id) {
  const list = qs("[data-activity-feedback-list]", root);
  if (!list) return;
  const params = new URLSearchParams({
    manage: "true",
    page: String(mePageState.activityFeedbackPage),
    pageSize: String(mePageState.pageSize),
  });
  const { feedbacks, pageInfo } = await api.get(`/api/activities/${encodeURIComponent(id)}/feedbacks?${params.toString()}`);
  const loaded = mergePageItems("activityFeedbacks", mePageState.activityFeedbackPage, feedbacks);
  updatePagedCount(qs("[data-activity-feedback-count]", root), loaded.length, pageInfo);
  updateLoadMore(qs("[data-load-more-activity-feedbacks]", root), loaded.length, pageInfo?.total || loaded.length);
  if (!loaded.length) {
    list.innerHTML = `<div class="empty-state"><strong>还没有活动反馈</strong><p>把二维码发给参与者，活动开始后就可以匿名填写。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  list.innerHTML = loaded.map((feedback) => renderFeedbackRow(feedback, { reviewActions: false })).join("");
  bindFeedbackReviewActions(list, async () => {
    resetPagedState("activityFeedbacks");
    await renderActivityFeedbackList(root, id);
  });
  revealDynamicContent(list);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename, text, type = "text/plain") {
  downloadBlob(filename, new Blob([text], { type }));
}

async function downloadFeedbackQrJpg(filename, svgText) {
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("二维码图片加载失败"));
    });
    image.src = svgUrl;
    await loaded;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const padding = 120;
    ctx.drawImage(image, padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
    if (!blob) throw new Error("二维码 JPG 生成失败");
    downloadBlob(filename, blob);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

async function initFeedbackFormPage() {
  const root = qs("[data-feedback-form-page]");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  const form = qs("[data-activity-feedback-form]", root);
  const message = qs("[data-feedback-form-message]", root);
  if (!id) {
    form.hidden = true;
    setMessage(message, "缺少活动 ID，请从活动页面扫码进入。", "error");
    return;
  }
  try {
    const { activity } = await api.get(`/api/activities/${encodeURIComponent(id)}`);
    qs("[data-feedback-form-title]", root).textContent = activity.title;
    qs("[data-feedback-form-subtitle]", root).textContent = `${formatActivityTime(activity)} · ${activity.location}`;
    qs("[data-feedback-back-link]", root).href = `activity.html?id=${encodeURIComponent(activity.id)}`;
  } catch (error) {
    form.hidden = true;
    setMessage(message, error.message, "error");
    return;
  }
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(message, "正在提交匿名反馈...");
    try {
      const result = await api.post(`/api/activities/${encodeURIComponent(id)}/feedbacks`, {
        favorite: form.favorite.value,
        improvement: form.improvement.value,
        other: form.other.value,
      });
      setMessage(
        message,
        result.existing ? "这个设备已经提交过反馈了。" : "反馈已提交。适合公开的内容会展示在活动页，也会留给发起人复盘。",
        "success"
      );
      form.querySelector("button[type='submit']").disabled = true;
      showToast(result.existing ? "已经提交过反馈" : "反馈已提交");
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

async function safeInit(task) {
  try {
    await task();
  } catch (error) {
    console.error(error);
    showToast("页面数据读取失败，请刷新后重试");
    qsa("[data-activity-list], [data-public-activity-list], [data-me-dashboard], [data-admin-dashboard], [data-governance-cards], [data-activity-detail], [data-success-detail], [data-safety-rules], [data-ai-prompts], [data-ai-console-summary], [data-ai-model-list], [data-ai-usage-models], [data-ai-usage-errors], [data-confidence-detail], [data-trust-list], [data-trust-detail], [data-trust-policy-list], [data-badge-list], [data-badge-policy-list], [data-report-list], [data-friend-list], [data-feedback-list], [data-activity-feedback-list], [data-my-registrations], [data-my-feedbacks]")
      .filter((element) => /正在|读取|加载/.test(element.textContent || ""))
      .forEach((element) => {
        element.innerHTML = `<div class="empty-state"><strong>暂时没读到数据</strong><p>请刷新页面重试，或稍后再来。</p></div>`;
      });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  initLoginPage();
  await Promise.all([
    safeInit(initSessionNav),
    safeInit(renderActivityLists),
    safeInit(initPublicActivitiesPage),
    safeInit(initMeDashboardPage),
    safeInit(initActivityEditorPage),
    safeInit(initMyActivitiesPage),
    safeInit(initRegistrationsPage),
    safeInit(initReviewTasksPage),
    safeInit(initActivityPage),
    safeInit(initSuccessPage),
    safeInit(initAdminPage),
    safeInit(initAdminActivitiesPage),
    safeInit(initAdminMembersPage),
    safeInit(initAdminRolesPage),
    safeInit(initAdminRoleEditorPage),
    safeInit(initAdminModulesPage),
    safeInit(initAdminTemplatesPage),
    safeInit(initAdminTemplateEditorPage),
    safeInit(initAdminLogsPage),
    safeInit(initAdminReportsPage),
    safeInit(initAdminFriendsPage),
    safeInit(initAdminFeedbacksPage),
    safeInit(initActivityFeedbackPage),
    safeInit(initFeedbackFormPage),
    safeInit(initAdminSafetyPage),
    safeInit(initAdminAiPage),
    safeInit(initAdminAiModelsPage),
    safeInit(initAdminAiModelEditorPage),
    safeInit(initAdminAiPromptsPage),
    safeInit(initAdminAiPromptEditorPage),
    safeInit(initAdminAiUsagePage),
    safeInit(initAdminGovernancePage),
    safeInit(initAdminTrustPolicyPage),
    safeInit(initAdminBadgesPage),
    safeInit(initAdminBadgePolicyPage),
    safeInit(initAdminActivityConfidencePage),
    safeInit(initAdminTrustPage),
    safeInit(initAdminTrustDetailPage),
  ]);
});
