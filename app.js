const api = {
  baseUrl: location.hostname.endsWith("tcloudbaseapp.com")
    ? "https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com"
    : "",
  async request(path, options = {}) {
    const token = localStorage.getItem("yk_session_token");
    const method = String(options.method || "GET").toUpperCase();
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  ["user.create", "新增成员"],
  ["user.update", "保存成员"],
  ["user.delete", "删除成员"],
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
  ["admin_review", "管理员审核"],
  ["collaborator_review", "协作员审核"],
  ["returned", "退回"],
  ["rejected", "拒绝"],
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
  if (!user) return "login.html";
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
        location.href = "login.html";
      });
    });
    return null;
  }

  brandMarks.forEach((mark) => {
    mark.setAttribute("title", user ? "进入我的有空" : "登录有空");
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
    "admin-logs.html",
  ];
  const myActive = workspacePages.includes(pageName);
  const userPart = user
    ? `<a class="${myActive ? "active" : ""}" href="me.html">我的</a><button class="nav-button" type="button" data-logout>${escapeHtml(user.nickname)} · 退出</button>`
    : `<a class="${myActive ? "active" : ""}" href="login.html">我的</a>`;
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
    ? `<option value="">请选择协作员</option>${collaborators.map((item) => `<option value="${item.id}">${escapeHtml(item.nickname)}</option>`).join("")}`
    : `<option value="">暂无协作员，请先联系管理员添加</option>`;
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
          <p>${escapeHtml(list.dataset.emptyText || "等第一位有空成员发布活动，这里就会出现新的接龙。")}</p>
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

async function initMeDashboardPage() {
  const root = qs("[data-me-dashboard]");
  if (!root) return;
  const user = await requireCurrentUser();
  if (!user) return;
  mePageState.user = user;
  qs("[data-user-name]", root).textContent = user.nickname;

  const dashboard = await api.get("/api/dashboard/me");

  renderWorkspaceCards(root, user, dashboard.summary, dashboard.pending);
  renderDashboardSummary(qs("[data-workspace-summary]", root), dashboard.summary);

  const pendingPreview = qs("[data-my-pending]", root);
  const pendingSection = qs("[data-my-pending-section]", root);
  if (pendingSection && !hasRole(user, "collaborator")) {
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
    <div class="stat"><strong>${total}</strong><span>我发起的活动</span></div>
    <div class="stat"><strong>${counts.draft || 0}</strong><span>草稿</span></div>
    <div class="stat"><strong>${reviewing}</strong><span>审核中</span></div>
    <div class="stat"><strong>${published}</strong><span>已发布</span></div>
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
      body: "从草稿开始，选择协作员后提交审核。",
      meta: "草稿 / 提交审核",
      count: "+",
    },
    {
      href: "my-activities.html",
      label: "我发起的活动",
      title: "管理自己的活动和报名表",
      body: "筛选草稿、审核中、退回、已发布等状态。",
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
  const user = await requireCurrentUser();
  if (!user) return;
  mePageState.user = user;
  qs("[data-user-name]") && (qs("[data-user-name]").textContent = user.nickname);
  resetActivityForm(form);
  mePageState.richEditor = window.youkongRichEditor ? window.youkongRichEditor.mount(form) : null;
  mePageState.modules = await fillModuleSelect(form.moduleId);
  mePageState.collaborators = await fillCollaboratorSelect(form.collaboratorId);
  mePageState.templates = await fillTemplateSelect(qs("[data-template-select]", form));
  bindTemplateSelect(form);

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
    setMessage(message, intent === "draft" ? "正在保存草稿..." : "正在提交审核...");
    try {
      const { activity } = editing
        ? await api.put(`/api/activities/${editing.id}`, formData)
        : await api.post("/api/activities", formData);
      setMessage(message, intent === "draft" ? "草稿已保存。" : "活动已提交管理员审核。", "success");
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

function resetActivityForm(form) {
  mePageState.editingActivity = null;
  form.reset();
  form.initiator.value = mePageState.user ? mePageState.user.nickname : "";
  if (form.collaboratorId) form.collaboratorId.value = "";
  const templateSelect = qs("[data-template-select]", form);
  if (templateSelect) templateSelect.value = "";
  window.youkongRichEditor?.reset(form);
  qs("[data-activity-form-title]", form)?.replaceChildren(document.createTextNode("添加活动"));
  qs("[data-activity-submit]", form).textContent = "提交审核";
  qs("[data-cancel-edit]", form).hidden = true;
}

function fillActivityForm(form, activity) {
  mePageState.editingActivity = activity;
  form.moduleId.value = activity.moduleId;
  form.title.value = activity.title;
  form.initiator.value = activity.initiator;
  form.startsAt.value = toDatetimeLocal(activity.startsAt);
  if (form.endsAt) form.endsAt.value = toDatetimeLocal(activity.endsAt);
  form.location.value = activity.location;
  form.capacity.value = activity.capacity || "";
  form.collaboratorId.value = activity.collaboratorId || "";
  form.description.value = activity.description || "";
  window.youkongRichEditor?.setHtml(form, activity.description || "");
  form.cover.value = "";
  qs("[data-activity-form-title]", form)?.replaceChildren(document.createTextNode("编辑活动"));
  qs("[data-activity-submit]", form).textContent = "提交审核";
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
  const user = await requireCurrentUser();
  if (!user) return;
  mePageState.user = user;
  const filters = qs("[data-my-activity-filters]", root);
  fillStatusSelect(filters?.status);
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
  const user = await requireCurrentUser();
  if (!user) return;
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
  return `"${String(value).replaceAll('"', '""')}"`;
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
              </aside>`
            : `<aside class="form-note">
                <h3>暂不开放报名</h3>
                <p class="muted-text">这个活动当前是「${escapeHtml(activity.statusLabel)}」状态，公开发布后才可以报名。</p>
              </aside>`
        }
      </div>
    </section>
  `;
  revealDynamicContent(root);
  window.youkongActivityShare?.mount(root, activity, { showToast, formatActivityTime });

  const form = qs("[data-register-form]");
  if (!form) return;
  const message = qs("[data-register-message]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(message, "正在报名...");
    try {
      const { registration } = await api.post(`/api/activities/${id}/register`, {
        nickname: form.nickname.value,
        phone: form.phone.value,
      });
      location.href = `success.html?activity=${encodeURIComponent(id)}&registration=${encodeURIComponent(registration.id)}`;
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
  if (!activityId || !registrationId) {
    root.innerHTML = `<div class="empty-state"><strong>缺少报名信息</strong><p>请从活动详情页重新报名。</p></div>`;
    return;
  }

  try {
    const { activity, registration } = await api.get(`/api/activities/${activityId}/registrations/${registrationId}`);
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
            <button class="button outline danger-soft" type="button" data-cancel-registration>取消报名</button>
            <a class="button ghost" href="participate.html">看看其他活动</a>
          </div>
        </div>
      </section>
    `;
    revealDynamicContent(root);
    qs("[data-cancel-registration]", root)?.addEventListener("click", async () => {
      if (!confirm("确定取消这次报名吗？取消后如需参加，需要重新报名。")) return;
      await api.post(`/api/activities/${activityId}/registrations/${registrationId}/cancel`, {});
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
      label: "成员管理",
      title: "管理成员、协作员和手机号",
      body: "添加、搜索、修改、删除成员角色。",
      meta: "成员 / 协作员",
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
  bindTemplateForm();
  await renderTemplates();
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
      setMessage(userMessage, "成员已添加。", "success");
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
  return qs('[name="role"]', root)?.value || "member";
}

function bindTemplateForm() {
  const form = qs("[data-template-form]");
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
      resetTemplateForm(form);
      resetPagedState("templates");
      await renderTemplates();
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });

  qs("[data-cancel-template-edit]", form)?.addEventListener("click", () => {
    resetTemplateForm(form);
    setMessage(message, "已取消编辑。");
  });
}

function resetTemplateForm(form) {
  mePageState.editingTemplate = null;
  form.reset();
  window.youkongRichEditor?.reset(form);
  qs("[data-template-form-title]", form)?.replaceChildren(document.createTextNode("新增活动模板"));
  qs("[data-template-submit]", form).textContent = "保存模板";
  qs("[data-cancel-template-edit]", form).hidden = true;
}

function fillTemplateForm(form, template) {
  mePageState.editingTemplate = template;
  form.name.value = template.name || "";
  form.description.value = template.description || "";
  form.content.value = template.content || "";
  window.youkongRichEditor?.setHtml(form, template.content || "");
  qs("[data-template-form-title]", form)?.replaceChildren(document.createTextNode("编辑活动模板"));
  qs("[data-template-submit]", form).textContent = "保存修改";
  qs("[data-cancel-template-edit]", form).hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderRoleControls(user = {}) {
  const roles = user.roles || [user.role || "member"];
  if (roles.includes("admin")) {
    return `<span class="tag">有空管理员</span>`;
  }
  return `
    <select name="role" aria-label="角色">
      <option value="member" ${roles.includes("member") ? "selected" : ""}>成员</option>
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
    list.innerHTML = `<div class="empty-state"><strong>没有找到成员</strong><p>换一个关键词或角色筛选试试。</p></div>`;
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
      </div>
      <div class="review-actions">
        <label>审核意见
          <select data-review-action>
            <option value="" selected disabled>请选择</option>
            <option value="approve">通过</option>
            <option value="return">退回</option>
            <option value="reject">拒绝</option>
          </select>
        </label>
        <textarea data-review-comment placeholder="填写审核说明，可留空"></textarea>
        <button class="button primary" type="button" data-review-submit>提交审核</button>
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
            <button class="button outline" type="button" data-edit-template>编辑</button>
            <button class="button outline danger-soft" type="button" data-delete-template>删除</button>
          </div>
        </article>
      `
    )
    .join("");
  revealDynamicContent(list);

  qsa("[data-template-id]", list).forEach((row) => {
    const template = loaded.find((item) => item.id === row.dataset.templateId);
    qs("[data-edit-template]", row).addEventListener("click", () => {
      fillTemplateForm(qs("[data-template-form]"), template);
    });
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
    safeInit(initAdminLogsPage),
  ]);
});
