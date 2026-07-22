const CLIENT_ID_KEY = "yk_client_id";
const ACTIVITY_TOKEN_KEY = "yk_activity_tokens";

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
  richEditor: null,
  submitIntent: "submit",
  pageSize: 12,
  myActivityPage: 1,
  adminActivityPage: 1,
  userPage: 1,
  modulePage: 1,
  templatePage: 1,
  logPage: 1,
  publicActivityPage: 1,
  myActivities: [],
  adminActivities: [],
  publicActivities: [],
  users: [],
  modulesPageItems: [],
  templates: [],
  logs: [],
  safetyRules: [],
  trustProfiles: [],
  aiPrompts: [],
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
  ["template.create", "新增模板"],
  ["template.update", "保存模板"],
  ["template.delete", "删除模板"],
  ["activity.create_draft", "保存活动草稿"],
  ["activity.create_submit", "提交活动审核"],
  ["activity.update_draft", "保存活动草稿"],
  ["activity.update_submit", "重新提交活动审核"],
  ["activity.withdraw", "撤回活动"],
  ["activity.review.approve", "审核通过"],
  ["activity.review.return", "审核退回"],
  ["activity.review.reject", "审核拒绝"],
  ["activity.cancel", "取消活动"],
  ["activity.end", "结束活动"],
  ["activity.auto_end", "自动结束活动"],
  ["registration.create", "新增报名"],
  ["registration.delete", "删除报名"],
  ["registration.cancel", "取消报名"],
];

const statusOptions = [
  ["", "全部状态"],
  ["draft", "草稿"],
  ["reviewing", "审核中"],
  ["admin_review", "管理员审核"],
  ["collaborator_review", "协作员审核"],
  ["returned", "退回"],
  ["rejected", "拒绝"],
  ["published_group", "已发布"],
  ["published", "活动发布"],
  ["full", "活动人满"],
  ["cancelled", "活动取消"],
  ["ended", "活动结束"],
];

const statusTone = {
  draft: "草稿",
  admin_review: "审核中",
  collaborator_review: "审核中",
  returned: "退回",
  rejected: "拒绝",
  published: "发布",
  full: "人满",
  cancelled: "取消",
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
}

function userHome(user) {
  if (!user) return "me.html";
  return user.roles && user.roles.includes("admin") ? "admin.html" : "me.html";
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
  if (!notice.text || notice.level === "none") return "";
  return `
    <div class="risk-notice ${escapeHtml(notice.level || "medium")}" role="note">
      <strong>社区提示</strong>
      <p>${escapeHtml(notice.text)}</p>
    </div>
  `;
}

function renderCommunityReportBox(activity = {}) {
  if (!["published", "full", "ended"].includes(activity.status)) return "";
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
    "admin.html",
    "admin-activities.html",
    "admin-members.html",
    "admin-modules.html",
    "admin-templates.html",
    "admin-template-editor.html",
    "admin-logs.html",
    "admin-safety.html",
    "admin-ai.html",
    "admin-trust.html",
    "admin-trust-detail.html",
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

function renderActivityCard(activity) {
  const cover = activity.coverUrl
    ? `<img src="${escapeHtml(activity.coverUrl)}" alt="${escapeHtml(activity.title)}" />`
    : `<div class="activity-cover-placeholder">${escapeHtml(activity.moduleName)}</div>`;
  const capacity = activity.capacity ? `${activity.registrationCount}/${activity.capacity} 人` : `${activity.registrationCount} 人已报名`;
  return `
    <article class="event-card">
      <a class="event-cover" href="activity.html?id=${activity.id}">${cover}</a>
      <div class="event-body">
        <span class="tag">${escapeHtml(activity.moduleName)}</span>
        <h3><a href="activity.html?id=${activity.id}">${escapeHtml(activity.title)}</a></h3>
        <p>${escapeHtml(activity.location)} · ${formatActivityTime(activity)}</p>
        <div class="event-meta">
          <span>${escapeHtml(activity.statusLabel || "活动发布")}</span>
          <span>发起人：${escapeHtml(activity.initiator)}</span>
          <span>${capacity}</span>
        </div>
      </div>
    </article>
  `;
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

  const pendingPreview = qs("[data-my-pending]", root);
  const pendingSection = qs("[data-my-pending-section]", root);
  if (pendingSection && (!user || !hasRole(user, "collaborator"))) {
    pendingSection.hidden = true;
  } else {
    renderPendingTasks(pendingPreview, (dashboard.pending?.activities || []).slice(0, 3), { compact: true });
  }
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
  const reviewing = Number(summary?.reviewing ?? ((counts.admin_review || 0) + (counts.collaborator_review || 0)));
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
  const reviewing = Number(summary?.reviewing ?? ((counts.admin_review || 0) + (counts.collaborator_review || 0)));
  const pendingTotal = Array.isArray(pendingSummary) ? pendingSummary.length : Number(pendingSummary?.total || 0);
  const cards = [
    {
      href: "activity-editor.html",
      label: "发起活动",
      title: "写下一个新的活动想法",
      body: "不需要注册登录。写清楚时间、地点和想做的事，系统会给出轻量风险判断。",
      meta: "草稿 / 直接发布 / 社区复核",
      count: "+",
    },
    {
      href: "my-activities.html",
      label: "我发起的活动",
      title: "管理自己的活动和报名表",
      body: "同一浏览器里可以继续编辑、撤回活动和查看报名表。",
      meta: `${reviewing} 个审核中`,
      count: total,
    },
  ];
  if (hasRole(user, "collaborator")) {
    cards.push({
      href: "review-tasks.html",
      label: "审核待办",
      title: "处理需要你审核的活动",
      body: "查看活动详情、封面、描述和审核历史。",
      meta: "协作员入口",
      count: pendingTotal,
    });
  }
  if (hasRole(user, "admin")) {
    cards.push({
      href: "admin.html",
      label: "管理后台",
      title: "进入 YKadmin 工作台",
      body: "活动、成员、模块分页面管理。",
      meta: "管理员入口",
      count: "Admin",
    });
  }
  container.innerHTML = cards.map(renderWorkspaceCard).join("");
  revealDynamicContent(container);
}

function renderWorkspaceCard(card) {
  return `
    <a class="workspace-card" href="${card.href}">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(String(card.count))}</strong>
      <h3>${escapeHtml(card.title)}</h3>
      <p>${escapeHtml(card.body)}</p>
      <small>${escapeHtml(card.meta)}</small>
    </a>
  `;
}

async function initActivityEditorPage() {
  const form = qs("[data-activity-form]");
  if (!form) return;
  const user = await getOptionalUser();
  mePageState.user = user;
  qs("[data-user-name]") && (qs("[data-user-name]").textContent = user?.nickname || "朋友");
  resetActivityForm(form);
  bindInitiatorContactToggle(form);
  mePageState.richEditor = window.youkongRichEditor ? window.youkongRichEditor.mount(form) : null;
  mePageState.modules = await fillModuleSelect(form.moduleId);
  mePageState.collaborators = await fillCollaboratorSelect(form.collaboratorId);
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
  qs("[data-initiator-contact-field]", form)?.setAttribute("hidden", "");
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
  return ["admin_review", "collaborator_review", "published", "full"].includes(activity.status);
}

function resetPagedState(key) {
  const pageKeys = {
    myActivities: "myActivityPage",
    adminActivities: "adminActivityPage",
    users: "userPage",
    modulesPageItems: "modulePage",
    templates: "templatePage",
    logs: "logPage",
    publicActivities: "publicActivityPage",
    trustProfiles: "userPage",
    aiPrompts: "templatePage",
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
            <span class="tag">${escapeHtml(activity.moduleName)}</span>
            <h3><a href="activity.html?id=${activity.id}">${escapeHtml(activity.title)}</a></h3>
            <p>${formatActivityTime(activity)} · ${escapeHtml(activity.location)} · ${escapeHtml(activity.statusLabel)} · ${escapeHtml(activity.reviewStepLabel)} · ${activity.registrationCount} 人报名</p>
            <p>协作员：${escapeHtml(activity.collaboratorName || "未选择")}</p>
          </div>
          <div class="row-actions">
            ${canEditMine(activity) ? `<a class="button outline" href="activity-editor.html?id=${encodeURIComponent(activity.id)}">编辑</a>` : ""}
            ${canWithdraw(activity) ? `<button class="button outline danger-soft" type="button" data-withdraw-activity-id="${activity.id}">撤回</button>` : ""}
            ${canViewRegistrations(activity) ? `<a class="button outline" href="registrations.html?id=${encodeURIComponent(activity.id)}">查看报名表</a>` : ""}
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
    || ["published", "full", "cancelled", "ended"].includes(activity.status);
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
  const { activities } = await api.get("/api/activities?pending=me");
  renderPendingTasks(panel, activities);
}

async function initReviewTasksPage() {
  const root = qs("[data-review-tasks-root]");
  if (!root) return;
  const user = await requireCurrentUser();
  if (!user) return;
  if (!hasRole(user, "collaborator") && !hasRole(user, "admin")) {
    root.innerHTML = `<section class="section"><div class="wrap"><div class="empty-state"><strong>暂无审核权限</strong><p>只有协作员或管理员可以查看审核待办。</p></div></div></section>`;
    return;
  }
  await renderMyPendingTasks();
}

function canRegisterActivity(activity) {
  return ["published", "full", "ended"].includes(activity.status);
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
      <thead><tr><th>昵称</th><th>手机号</th><th>报名时间</th><th>操作</th></tr></thead>
      <tbody>
        ${registrations
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.nickname)}</td>
                <td>${escapeHtml(item.phone)}</td>
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
    ["活动标题", "昵称", "手机号", "报名时间"],
    ...registrations.map((item) => [activity.title, item.nickname, item.phone, item.createdAt]),
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
  const registrationLookupOnly = activity.status === "full" || activity.status === "ended";
  root.innerHTML = `
    <section class="activity-hero">
      <div>
        <span class="tag">${escapeHtml(activity.moduleName)}</span>
        <h1>${escapeHtml(activity.title)}</h1>
        <p>${escapeHtml(activity.location)} · ${formatActivityTime(activity)}</p>
        <div class="event-meta">
          <span>${escapeHtml(activity.statusLabel || "活动发布")}</span>
          <span>发起人：${escapeHtml(activity.initiator)}</span>
          <span>${activity.capacity ? `限额 ${activity.capacity} 人` : "人数无上限"}</span>
          <span>已报名 ${activity.registrationCount} 人</span>
        </div>
        ${renderRiskNotice(activity)}
        ${renderInitiatorContact(activity)}
        <div class="activity-share-actions" aria-label="活动分享操作">
          <button class="button ghost" type="button" data-download-poster>分享海报</button>
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
                <h3>${registrationLookupOnly ? "查看报名确认" : "报名这个活动"}</h3>
                ${
                  registrationLookupOnly
                    ? `<p class="muted-text">这个活动当前不接受新报名。已经报名的人可以输入原手机号查看确认页。</p>`
                    : ""
                }
                <form data-register-form>
                  <label for="nickname">昵称</label>
                  <input id="nickname" name="nickname" required />
                  <label for="phone">手机号</label>
                  <input id="phone" name="phone" inputmode="tel" required />
                  <button class="button primary" type="submit">${registrationLookupOnly ? "查找报名" : "提交报名"}</button>
                  <p class="form-message" data-register-message></p>
                </form>
                ${renderCommunityReportBox(activity)}
              </aside>`
            : `<aside class="form-note">
                <h3>暂不开放报名</h3>
                <p class="muted-text">这个活动当前是「${escapeHtml(activity.statusLabel)}」状态，公开发布后才可以报名。</p>
                ${renderCommunityReportBox(activity)}
              </aside>`
        }
      </div>
    </section>
  `;
  revealDynamicContent(root);
  window.youkongActivityShare?.mount(root, activity, {
    showToast,
    formatActivityTime,
    getInvitee: () => {
      const form = qs("[data-register-form]", root);
      return {
        nickname: form?.nickname?.value || "",
        phone: form?.phone?.value || "",
      };
    },
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
        phone: form.phone.value,
      });
      const token = accessToken || registration.accessToken || "";
      const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : "";
      location.href = `success.html?activity=${encodeURIComponent(id)}&registration=${encodeURIComponent(registration.id)}${tokenQuery}`;
    } catch (error) {
      setMessage(message, error.message, "error");
    }
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
              <p>${escapeHtml(registration.phone)}</p>
            </div>
          </div>
          <div class="button-row">
            <a class="button primary" href="activity.html?id=${encodeURIComponent(activity.id)}">查看活动</a>
            <button class="button ghost" type="button" data-download-poster>下载分享海报</button>
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
  const user = await requireAdminUser(adminRoot);
  if (!user) return;

  const dashboard = await api.get("/api/dashboard/admin");
  renderAdminDashboardCards(adminRoot, dashboard.activities, dashboard.users, dashboard.modules, dashboard.templates, dashboard.pending);
  renderPendingTasks(qs("[data-admin-pending]", adminRoot), (dashboard.pending?.activities || []).slice(0, 4), { compact: true });
}

async function requireAdminUser(root) {
  const user = await requireCurrentUser();
  if (!user) return null;
  if (!hasRole(user, "admin")) {
    if (root) {
      root.innerHTML = `<section class="section"><div class="wrap"><div class="empty-state"><strong>你还不是管理员</strong><p>只有 YKadmin 可以进入后台。</p></div></div></section>`;
    }
    return;
  }
  return user;
}

function renderAdminDashboardCards(root, activitiesSummary, usersSummary, modulesSummary, templatesSummary, pendingSummary) {
  const container = qs("[data-admin-dashboard-cards]", root);
  if (!container) return;
  const counts = activitiesSummary?.byStatus || {};
  const reviewing = Number(activitiesSummary?.reviewing ?? ((counts.admin_review || 0) + (counts.collaborator_review || 0)));
  const activityTotal = Number(activitiesSummary?.total || 0);
  const userTotal = Number(usersSummary?.total || 0);
  const moduleTotal = Number(modulesSummary?.total || 0);
  const templateTotal = Number(templatesSummary?.total || 0);
  const pendingTotal = Number(pendingSummary?.total || 0);
  const cards = [
    {
      href: "admin-activities.html",
      label: "全部活动",
      title: "筛选和查看所有状态活动",
      body: "按标题、模块、状态、时间和报名数管理。",
      meta: `${reviewing} 个审核中`,
      count: activityTotal,
    },
    {
      href: "admin-members.html",
      label: "协作员管理",
      title: "管理协作员和手机号",
      body: "添加、搜索、修改、删除可登录治理后台的人。",
      meta: "管理员 / 协作员",
      count: userTotal,
    },
    {
      href: "admin-modules.html",
      label: "模块管理",
      title: "维护活动分类模块",
      body: "管理有空放映、有空食堂等分类。",
      meta: "活动分类",
      count: moduleTotal,
    },
    {
      href: "admin-templates.html",
      label: "活动模板",
      title: "维护活动描述模板",
      body: "给放映、食堂、夜校等活动准备可复用正文。",
      meta: "描述模板",
      count: templateTotal,
    },
    {
      href: "review-tasks.html",
      label: "审核待办",
      title: "处理当前审核任务",
      body: "查看详情、封面和审核记录后处理。",
      meta: "管理员审核",
      count: pendingTotal,
    },
    {
      href: "admin-logs.html",
      label: "操作日志",
      title: "查看系统里的关键动作",
      body: "新增、保存、删除、提交、审核、撤回都会留下记录。",
      meta: "审计记录",
      count: "Log",
    },
    {
      href: "admin-safety.html",
      label: "规则引擎",
      title: "配置开放发布的风险规则",
      body: "调整敏感词、URL、格式异常等规则分值和策略阈值。",
      meta: "Rule Engine",
      count: "OS",
    },
    {
      href: "admin-ai.html",
      label: "AI 分析",
      title: "管理可插拔 AI Analysis Engine",
      body: "开启或关闭 AI，配置 Provider、Prompt、能力和调用策略。",
      meta: "Observer",
      count: "AI",
    },
    {
      href: "admin-trust.html",
      label: "社区信用度",
      title: "查看匿名身份的社区信任变化",
      body: "按活动发起、举报成立、低风险发布等事件追溯信用变化。",
      meta: "Community Trust",
      count: "Trust",
    },
  ];
  container.innerHTML = cards.map(renderWorkspaceCard).join("");
  revealDynamicContent(container);
}

async function initAdminActivitiesPage() {
  const root = qs("[data-admin-activities-page]");
  if (!root) return;
  const user = await requireAdminUser(root);
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
  const user = await requireAdminUser(root);
  if (!user) return;
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
  await renderUsers();
}

async function initAdminModulesPage() {
  const root = qs("[data-admin-modules-page]");
  if (!root) return;
  const user = await requireAdminUser(root);
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
  await renderModules();
}

async function initAdminTemplatesPage() {
  const root = qs("[data-admin-templates-page]");
  if (!root) return;
  const user = await requireAdminUser(root);
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
  await renderTemplates();
}

async function initAdminTemplateEditorPage() {
  const root = qs("[data-admin-template-editor-page]");
  if (!root) return;
  const user = await requireAdminUser(root);
  if (!user) return;
  const form = qs("[data-template-form]", root);
  bindTemplateForm(form);
  const editingId = new URLSearchParams(location.search).get("id");
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
  const user = await requireAdminUser(root);
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

async function initAdminSafetyPage() {
  const root = qs("[data-admin-safety-page]");
  if (!root) return;
  const user = await requireAdminUser(root);
  if (!user) return;
  const configForm = qs("[data-safety-config-form]", root);
  const ruleForm = qs("[data-safety-rule-form]", root);
  const message = qs("[data-safety-message]", root);
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
      <button class="button outline" type="button" data-save-rule>保存</button>
      <button class="button outline danger-soft" type="button" data-delete-rule>删除</button>
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

async function initAdminAiPage() {
  const root = qs("[data-admin-ai-page]");
  if (!root) return;
  const user = await requireAdminUser(root);
  if (!user) return;
  const settingsForm = qs("[data-ai-settings-form]", root);
  const promptForm = qs("[data-ai-prompt-form]", root);
  const message = qs("[data-ai-message]", root);
  try {
    const [{ settings }, { prompts }] = await Promise.all([
      api.get("/api/ai/settings"),
      api.get("/api/ai/prompts?page=1&pageSize=100"),
    ]);
    fillAiSettingsForm(settingsForm, settings);
    renderAiPrompts(qs("[data-ai-prompts]", root), prompts);
  } catch (error) {
    setMessage(message, error.message, "error");
  }
  settingsForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = aiSettingsPayload(settingsForm);
      const { settings } = await api.put("/api/ai/settings", payload);
      fillAiSettingsForm(settingsForm, settings);
      setMessage(message, "AI 设置已保存。", "success");
      showToast("保存成功");
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
  qs("[data-ai-test]", settingsForm)?.addEventListener("click", async () => {
    setMessage(message, "正在测试 AI 连接...");
    const result = await api.post("/api/ai/test-connection", aiSettingsPayload(settingsForm));
    setMessage(message, result.ok ? `连接成功，响应 ${result.durationMs}ms。` : `连接失败：${result.error}`, result.ok ? "success" : "error");
  });
  promptForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api.post("/api/ai/prompts", {
        type: promptForm.type.value,
        version: promptForm.version.value,
        name: promptForm.name.value,
        active: promptForm.active.value,
        systemPrompt: promptForm.systemPrompt.value,
        userPrompt: promptForm.userPrompt.value,
      });
      promptForm.reset();
      await refreshAiPrompts(root);
      showToast("保存成功");
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

function fillAiSettingsForm(form, settings = {}) {
  if (!form) return;
  form.enabled.value = settings.enabled ? "true" : "false";
  form.provider.value = settings.provider || "openai-compatible";
  form.baseUrl.value = settings.baseUrl || "";
  form.model.value = settings.model || "";
  form.apiKey.value = "";
  form.apiKey.placeholder = settings.apiKeyStatus || "未配置";
  form.requestTimeoutMs.value = settings.requestTimeoutMs || 15000;
  form.temperature.value = settings.temperature ?? 0.2;
  form.maxTokens.value = settings.maxTokens || 1200;
  form.retryCount.value = settings.retryCount || 1;
  form.cacheTtlSeconds.value = settings.cacheTtlSeconds || 86400;
  form.promptVersion.value = settings.promptVersion || "activity-default-v1";
  form.callStrategy.value = JSON.stringify(settings.callStrategy || {}, null, 2);
  form.capabilities.value = JSON.stringify(settings.capabilities || {}, null, 2);
}

function aiSettingsPayload(form) {
  return {
    enabled: form.enabled.value,
    provider: form.provider.value,
    baseUrl: form.baseUrl.value,
    model: form.model.value,
    apiKey: form.apiKey.value,
    requestTimeoutMs: form.requestTimeoutMs.value,
    temperature: form.temperature.value,
    maxTokens: form.maxTokens.value,
    retryCount: form.retryCount.value,
    cacheTtlSeconds: form.cacheTtlSeconds.value,
    promptVersion: form.promptVersion.value,
    callStrategy: form.callStrategy.value,
    capabilities: form.capabilities.value,
  };
}

async function refreshAiPrompts(root = document) {
  const { prompts } = await api.get("/api/ai/prompts?page=1&pageSize=100");
  renderAiPrompts(qs("[data-ai-prompts]", root), prompts);
}

function renderAiPrompts(container, prompts = []) {
  if (!container) return;
  if (!prompts.length) {
    container.innerHTML = `<div class="empty-state"><strong>还没有 Prompt</strong><p>系统初始化后会自动补一个活动分析默认版本。</p></div>`;
    return;
  }
  container.innerHTML = prompts.map((prompt) => `
    <article class="event-row" data-prompt-id="${prompt.id}">
      <div>
        <span class="tag">${prompt.active ? "启用中" : "历史版本"}</span>
        <h3>${escapeHtml(prompt.name)}</h3>
        <p>${escapeHtml(prompt.type)} · ${escapeHtml(prompt.version)} · ${formatDate(prompt.updatedAt || prompt.createdAt)}</p>
        <details class="review-detail">
          <summary>查看 Prompt</summary>
          <pre>${escapeHtml(prompt.systemPrompt || "")}</pre>
          <pre>${escapeHtml(prompt.userPrompt || "")}</pre>
        </details>
      </div>
      <div class="row-actions">
        <button class="button outline" type="button" data-activate-prompt ${prompt.active ? "disabled" : ""}>启用</button>
        <button class="button outline danger-soft" type="button" data-delete-prompt>删除</button>
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

async function initAdminActivityConfidencePage() {
  const root = qs("[data-admin-activity-confidence-page]");
  if (!root) return;
  const user = await requireAdminUser(root);
  if (!user) return;
  const id = new URLSearchParams(location.search).get("id");
  const container = qs("[data-confidence-detail]", root);
  if (!id) {
    container.innerHTML = `<div class="empty-state"><strong>缺少活动 ID</strong><p>请从全部活动进入置信度详情。</p></div>`;
    return;
  }
  await renderActivityConfidence(root, id);
  qs("[data-reanalyze-activity]", root)?.addEventListener("click", async () => {
    await api.post(`/api/activities/${id}/reanalyze`, {});
    showToast("保存成功");
    await renderActivityConfidence(root, id);
  });
}

async function renderActivityConfidence(root, id) {
  const container = qs("[data-confidence-detail]", root);
  const { activity, trustProfile, reports, analyses, latestAnalysis } = await api.get(`/api/activities/${id}/confidence`);
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
      </div>
    </article>
    <section class="panel-block">
      <h3>规则引擎明细</h3>
      ${renderRuleFindings(latestAnalysis?.ruleReport?.findings || activity.ruleFindings || [])}
    </section>
    <section class="panel-block">
      <h3>AI Analysis Report</h3>
      ${latestAnalysis?.aiReport ? renderAiReport(latestAnalysis.aiReport) : `<p class="muted-text">AI 未调用或当前已关闭。</p>`}
    </section>
    <section class="panel-block">
      <h3>分析历史</h3>
      ${analyses.length ? analyses.map((item) => `<p>${formatDate(item.createdAt)} · 风险分 ${item.policy?.riskScore ?? item.ruleReport?.riskScore ?? 0} · ${escapeHtml(item.aiMeta?.reason || "rule")}</p>`).join("") : `<p class="muted-text">暂无分析历史。</p>`}
    </section>
  `;
  revealDynamicContent(container);
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
    ["垃圾内容", report.isSpam],
    ["诈骗风险", report.isScam],
    ["违法风险", report.containsIllegal],
  ];
  return `
    <div class="ai-report">
      <p><strong>摘要：</strong>${escapeHtml(report.summary || "暂无摘要")}</p>
      <p><strong>分类：</strong>${escapeHtml(report.category || "未分类")} · ${escapeHtml((report.tags || []).join(" / "))}</p>
      <p><strong>风险原因：</strong>${escapeHtml((report.riskReason || []).join("；") || "无")}</p>
      <p><strong>可信特征：</strong>${escapeHtml((report.positiveSignals || []).join("；") || "无")}</p>
      <p><strong>风险特征：</strong>${escapeHtml((report.negativeSignals || []).join("；") || "无")}</p>
      <div class="chip-row">${flags.map(([label, value]) => `<span class="tag">${escapeHtml(label)}：${value ? "是" : "否"}</span>`).join("")}</div>
    </div>
  `;
}

async function initAdminTrustPage() {
  const root = qs("[data-admin-trust-page]");
  if (!root) return;
  const user = await requireAdminUser(root);
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
  const { profiles, pageInfo } = await api.get(`/api/trust-profiles${query}`);
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
        <span class="tag">信用度 ${Number(profile.communityTrust || 0)}</span>
        <h3>${escapeHtml(profile.latestInitiator || profile.id)}</h3>
        <p>${escapeHtml(profile.ipMasked || "IP 已脱敏")} · ${escapeHtml(profile.latestActivityTitle || "暂无活动")}</p>
        <p>${escapeHtml(profile.userAgentSample || "")}</p>
      </div>
      <div class="row-actions">
        <a class="button outline" href="admin-trust-detail.html?id=${encodeURIComponent(profile.id)}">查看</a>
      </div>
    </article>
  `).join("");
  revealDynamicContent(list);
}

async function initAdminTrustDetailPage() {
  const root = qs("[data-admin-trust-detail-page]");
  if (!root) return;
  const user = await requireAdminUser(root);
  if (!user) return;
  const id = new URLSearchParams(location.search).get("id");
  const container = qs("[data-trust-detail]", root);
  if (!id) {
    container.innerHTML = `<div class="empty-state"><strong>缺少身份 ID</strong><p>请从社区信用度列表进入。</p></div>`;
    return;
  }
  const { profile, events, activities } = await api.get(`/api/trust-profiles/${encodeURIComponent(id)}`);
  container.innerHTML = `
    <article class="confidence-panel">
      <div class="confidence-score">
        <span>社区信用度</span>
        <strong>${Number(profile.communityTrust || 0)}</strong>
        <p>${escapeHtml(profile.ipMasked || "IP 已脱敏")} · ${profile.activityCount || 0} 次活动记录</p>
      </div>
    </article>
    <section class="panel-block">
      <h3>信用变化</h3>
      ${events.length ? events.map((event) => `<p><strong>${Number(event.delta || 0) > 0 ? "+" : ""}${Number(event.delta || 0)}</strong> · ${escapeHtml(event.reason || event.type)} · ${formatDate(event.createdAt)}</p>`).join("") : `<p class="muted-text">暂无信用变化事件。</p>`}
    </section>
    <section class="panel-block">
      <h3>关联活动</h3>
      ${activities.length ? activities.map((activity) => `<p><a href="admin-activity-confidence.html?id=${encodeURIComponent(activity.id)}">${escapeHtml(activity.title)}</a> · 风险分 ${Number(activity.riskScore || 0)} · ${formatDate(activity.createdAt)}</p>`).join("") : `<p class="muted-text">暂无关联活动。</p>`}
    </section>
  `;
  revealDynamicContent(container);
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
      setMessage(userMessage, "协作员已添加。", "success");
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
  const roles = user.roles || [user.role || "collaborator"];
  if (roles.includes("admin")) {
    return `<span class="tag">有空管理员</span>`;
  }
  return `
    <select name="role" aria-label="角色">
      <option value="collaborator" ${roles.includes("collaborator") ? "selected" : ""}>协作员</option>
    </select>
  `;
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
    list.innerHTML = `<div class="empty-state"><strong>没有找到协作员</strong><p>换一个关键词或角色筛选试试。</p></div>`;
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
          <button class="button outline" type="button" data-save-user>保存</button>
          <button class="button outline" type="button" data-delete-user ${user.id === "admin" ? "disabled" : ""}>删除</button>
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
      if (!confirm("确定删除这个成员吗？")) return;
      await api.delete(`/api/users/${row.dataset.userId}`);
      showToast("删除成功");
      resetPagedState("users");
      await renderUsers();
    });
  });
}

function renderPendingTasks(container, activities) {
  if (!container) return;
  if (!activities.length) {
    container.innerHTML = `<div class="empty-state"><strong>暂无待办</strong><p>需要你审核的活动会出现在这里。</p></div>`;
    revealDynamicContent(container);
    return;
  }
  container.innerHTML = activities.map(renderReviewTask).join("");
  revealDynamicContent(container);
  bindReviewButtons(container);
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
            <span class="tag">${escapeHtml(statusTone[activity.status] || activity.statusLabel)}</span>
            <h3><a href="activity.html?id=${activity.id}">${escapeHtml(activity.title)}</a></h3>
            <p>${escapeHtml(activity.reviewStepLabel)} · ${formatActivityTime(activity)} · ${escapeHtml(activity.location || "地点待定")} · ${activity.registrationCount} 人报名</p>
            <p>发起人：${escapeHtml(activity.initiator)} · 协作员：${escapeHtml(activity.collaboratorName || "未选择")}</p>
          </div>
          <div class="row-actions">
            <a class="button outline" href="activity.html?id=${encodeURIComponent(activity.id)}">查看</a>
            <a class="button outline" href="admin-activity-confidence.html?id=${encodeURIComponent(activity.id)}">置信度</a>
            ${canViewRegistrations(activity) ? `<a class="button outline" href="registrations.html?id=${encodeURIComponent(activity.id)}">报名表</a>` : ""}
            ${canAdminCancel(activity) ? `<button class="button outline danger-soft" type="button" data-admin-cancel-activity-id="${activity.id}">取消</button>` : ""}
            ${canAdminEnd(activity) ? `<button class="button outline" type="button" data-admin-end-activity-id="${activity.id}">结束</button>` : ""}
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
  return !["cancelled", "ended", "rejected"].includes(activity.status);
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
  list.innerHTML = loaded
    .map(
      (module) => `
        <article class="manage-row" data-module-id="${module.id}">
          <input name="name" value="${escapeHtml(module.name)}" />
          <input name="description" value="${escapeHtml(module.description || "")}" />
          <button class="button outline" type="button" data-save-module>保存</button>
          <button class="button outline" type="button" data-delete-module>删除</button>
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
            <a class="button outline" href="admin-template-editor.html?id=${encodeURIComponent(template.id)}">编辑</a>
            <button class="button outline danger-soft" type="button" data-delete-template>删除</button>
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

async function safeInit(task) {
  try {
    await task();
  } catch (error) {
    console.error(error);
    showToast("页面数据读取失败，请刷新后重试");
    qsa("[data-activity-list], [data-public-activity-list], [data-me-dashboard], [data-admin-dashboard], [data-activity-detail], [data-success-detail], [data-safety-rules], [data-ai-prompts], [data-confidence-detail], [data-trust-list], [data-trust-detail]")
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
    safeInit(initAdminModulesPage),
    safeInit(initAdminTemplatesPage),
    safeInit(initAdminTemplateEditorPage),
    safeInit(initAdminLogsPage),
    safeInit(initAdminSafetyPage),
    safeInit(initAdminAiPage),
    safeInit(initAdminActivityConfidencePage),
    safeInit(initAdminTrustPage),
    safeInit(initAdminTrustDetailPage),
  ]);
});
