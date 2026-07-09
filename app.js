const api = {
  baseUrl: location.hostname.endsWith("tcloudbaseapp.com")
    ? "https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com"
    : "",
  async request(path, options = {}) {
    const token = localStorage.getItem("yk_session_token");
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  submitIntent: "submit",
};

const actionLabels = {
  approve: "通过",
  reject: "拒绝",
  return: "退回",
  withdraw: "撤回",
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

function revealDynamicContent(root) {
  if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const elements = qsa(
    ".event-card, .event-row, .empty-state, .data-table, .activity-hero, .article-content, .success-card",
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

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function descriptionToHtml(value = "") {
  return escapeHtml(value.replaceAll("\\n", "\n"))
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
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
  const links = baseLinks
    .map(([href, label]) => `<a class="${pageName === href ? "active" : ""}" href="${href}">${label}</a>`)
    .join("");
  const myActive = pageName === "me.html" || pageName === "admin.html";
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
        <p>${escapeHtml(activity.location)} · ${formatDate(activity.startsAt)}</p>
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

  const { activities } = await api.get("/api/activities");
  lists.forEach((list) => {
    const limit = Number(list.dataset.limit || "0");
    const visible = limit ? activities.slice(0, limit) : activities;
    if (!visible.length) {
      list.innerHTML = `
        <div class="empty-state">
          <strong>公告栏还空着</strong>
          <p>等第一位有空成员发布活动，这里就会出现新的接龙。</p>
        </div>
      `;
      revealDynamicContent(list);
      return;
    }
    list.innerHTML = visible.map(renderActivityCard).join("");
    revealDynamicContent(list);
  });
}

async function initMePage() {
  const form = qs("[data-activity-form]");
  if (!form) return;

  const { user } = await api.get("/api/session");
  if (!user) {
    location.href = "login.html";
    return;
  }

  mePageState.user = user;
  qs("[data-user-name]").textContent = user.nickname;
  const pendingSection = qs("[data-my-pending-section]");
  if (pendingSection && !hasRole(user, "collaborator")) {
    pendingSection.hidden = true;
  }
  resetActivityForm(form);
  mePageState.modules = await fillModuleSelect(form.moduleId);
  mePageState.collaborators = await fillCollaboratorSelect(form.collaboratorId);

  qsa("[data-submit-intent]", form).forEach((button) => {
    button.addEventListener("click", () => {
      mePageState.submitIntent = button.dataset.submitIntent || "submit";
    });
  });

  const message = qs("[data-activity-message]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
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
      await renderMineActivities();
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

  await renderMineActivities();
  if (!pendingSection?.hidden) {
    await renderMyPendingTasks();
  }
}

function resetActivityForm(form) {
  mePageState.editingActivity = null;
  form.reset();
  form.initiator.value = mePageState.user ? mePageState.user.nickname : "";
  if (form.collaboratorId) form.collaboratorId.value = "";
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
  form.location.value = activity.location;
  form.capacity.value = activity.capacity || "";
  form.collaboratorId.value = activity.collaboratorId || "";
  form.description.value = activity.description || "";
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

async function renderMineActivities() {
  const list = qs("[data-my-activities]");
  if (!list) return;
  const { activities } = await api.get("/api/activities?owner=me");
  if (!activities.length) {
    list.innerHTML = `<div class="empty-state"><strong>还没有发起过活动</strong><p>写下一个小想法，客厅就多一张新纸条。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  list.innerHTML = activities
    .map(
      (activity) => `
        <article class="event-row">
          <div>
            <span class="tag">${escapeHtml(activity.moduleName)}</span>
            <h3><a href="activity.html?id=${activity.id}">${escapeHtml(activity.title)}</a></h3>
            <p>${formatDate(activity.startsAt)} · ${escapeHtml(activity.location)} · ${escapeHtml(activity.statusLabel)} · ${escapeHtml(activity.reviewStepLabel)} · ${activity.registrationCount} 人报名</p>
            <p>协作员：${escapeHtml(activity.collaboratorName || "未选择")}</p>
          </div>
          <div class="row-actions">
            ${canEditMine(activity) ? `<button class="button outline" type="button" data-edit-activity-id="${activity.id}">编辑</button>` : ""}
            ${canWithdraw(activity) ? `<button class="button outline danger-soft" type="button" data-withdraw-activity-id="${activity.id}">撤回</button>` : ""}
            <button class="button outline" type="button" data-registration-id="${activity.id}">查看报名表</button>
          </div>
        </article>
      `
    )
    .join("");
  revealDynamicContent(list);

  qsa("[data-edit-activity-id]", list).forEach((button) => {
    button.addEventListener("click", async () => {
      const { activity } = await api.get(`/api/activities/${button.dataset.editActivityId}`);
      fillActivityForm(qs("[data-activity-form]"), activity);
    });
  });

  qsa("[data-registration-id]", list).forEach((button) => {
    button.addEventListener("click", () => renderRegistrations(button.dataset.registrationId));
  });

  qsa("[data-withdraw-activity-id]", list).forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("确定撤回这个活动吗？撤回后会变成草稿。")) return;
      await api.post(`/api/activities/${button.dataset.withdrawActivityId}/withdraw`, {});
      showToast("保存成功");
      await renderMineActivities();
      await renderActivityLists();
    });
  });
}

async function renderMyPendingTasks() {
  const panel = qs("[data-my-pending]");
  if (!panel) return;
  const { activities } = await api.get("/api/activities?pending=me");
  renderPendingTasks(panel, activities);
}

function canRegisterActivity(activity) {
  return ["published", "full", "ended"].includes(activity.status);
}

async function renderRegistrations(activityId) {
  const panel = qs("[data-registration-panel]");
  if (!panel) return;
  panel.innerHTML = `<p class="muted-text">正在读取报名表...</p>`;
  try {
    const { registrations } = await api.get(`/api/activities/${activityId}/registrations`);
    if (!registrations.length) {
      panel.innerHTML = `<div class="empty-state"><strong>暂时还没人报名</strong><p>可以把活动链接发到社群里。</p></div>`;
      revealDynamicContent(panel);
      return;
    }
    panel.innerHTML = `
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
    revealDynamicContent(panel);
    qsa("[data-delete-registration]", panel).forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("确定删除这条报名记录吗？")) return;
        await api.delete(`/api/activities/${activityId}/registrations/${button.dataset.deleteRegistration}`);
        showToast("删除成功");
        await renderRegistrations(activityId);
        await renderMineActivities();
      });
    });
  } catch (error) {
    panel.innerHTML = `<p class="form-message" data-type="error">${escapeHtml(error.message)}</p>`;
  }
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
        <p>${escapeHtml(activity.location)} · ${formatDate(activity.startsAt)}</p>
        <div class="event-meta">
          <span>${escapeHtml(activity.statusLabel || "活动发布")}</span>
          <span>发起人：${escapeHtml(activity.initiator)}</span>
          <span>${activity.capacity ? `限额 ${activity.capacity} 人` : "人数无上限"}</span>
          <span>已报名 ${activity.registrationCount} 人</span>
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
              <p>${escapeHtml(activity.location)} · ${formatDate(activity.startsAt)}</p>
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
  const adminRoot = qs("[data-admin-root]");
  if (!adminRoot) return;
  const { user } = await api.get("/api/session");
  if (!user) {
    location.href = "login.html";
    return;
  }
  if (!hasRole(user, "admin")) {
    adminRoot.innerHTML = `<div class="empty-state"><strong>你还不是管理员</strong><p>只有 YKadmin 可以进入后台。</p></div>`;
    return;
  }

  await Promise.all([renderUsers(), renderModules(), renderAdminPendingTasks(), renderAllActivities()]);
  bindAdminForms();
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
        roles: selectedRoles(userForm),
      });
      userForm.reset();
      setMessage(userMessage, "成员已添加。", "success");
      showToast("保存成功");
      await Promise.all([renderUsers(), renderAdminPendingTasks(), renderAllActivities()]);
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
      await renderModules();
    } catch (error) {
      setMessage(moduleMessage, error.message, "error");
    }
  });
}

function selectedRoles(root) {
  return qsa('[name="roles"]:checked', root).map((input) => input.value);
}

function renderRoleControls(user = {}) {
  const roles = user.roles || [user.role || "member"];
  if (roles.includes("admin")) {
    return `<span class="tag">有空管理员</span>`;
  }
  return `
    <label><input type="checkbox" name="roles" value="member" ${roles.includes("member") ? "checked" : ""} /> 成员</label>
    <label><input type="checkbox" name="roles" value="collaborator" ${roles.includes("collaborator") ? "checked" : ""} /> 协作员</label>
  `;
}

async function renderUsers() {
  const list = qs("[data-user-list]");
  if (!list) return;
  const { users } = await api.get("/api/users");
  list.innerHTML = users
    .map(
      (user) => `
        <article class="manage-row user-manage-row" data-user-id="${user.id}">
          <input name="nickname" value="${escapeHtml(user.nickname)}" />
          <input name="phone" value="${escapeHtml(user.phone)}" inputmode="tel" />
          <div class="check-group" aria-label="角色">${renderRoleControls(user)}</div>
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
        roles: selectedRoles(row),
      });
      showToast("保存成功");
      await Promise.all([renderUsers(), renderAdminPendingTasks(), renderAllActivities()]);
    });
    qs("[data-delete-user]", row).addEventListener("click", async () => {
      if (!confirm("确定删除这个成员吗？")) return;
      await api.delete(`/api/users/${row.dataset.userId}`);
      showToast("删除成功");
      await Promise.all([renderUsers(), renderAdminPendingTasks(), renderAllActivities()]);
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
        <p>${escapeHtml(activity.moduleName)} · ${formatDate(activity.startsAt)} · ${escapeHtml(activity.location || "地点待定")}</p>
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
      await api.post(`/api/activities/${row.dataset.reviewActivityId}/review`, {
        action: qs("[data-review-action]", row).value,
        comment: qs("[data-review-comment]", row).value,
      });
      showToast("保存成功");
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
  const { activities } = await api.get("/api/activities?all=true");
  if (!activities.length) {
    list.innerHTML = `<div class="empty-state"><strong>暂无活动</strong><p>所有状态的活动会显示在这里。</p></div>`;
    revealDynamicContent(list);
    return;
  }
  list.innerHTML = activities
    .map(
      (activity) => `
        <article class="event-row">
          <div>
            <span class="tag">${escapeHtml(activity.statusLabel)}</span>
            <h3><a href="activity.html?id=${activity.id}">${escapeHtml(activity.title)}</a></h3>
            <p>${escapeHtml(activity.reviewStepLabel)} · ${formatDate(activity.startsAt)} · ${escapeHtml(activity.location || "地点待定")} · ${activity.registrationCount} 人报名</p>
            <p>发起人：${escapeHtml(activity.initiator)} · 协作员：${escapeHtml(activity.collaboratorName || "未选择")}</p>
          </div>
        </article>
      `
    )
    .join("");
  revealDynamicContent(list);
}

async function renderModules() {
  const list = qs("[data-module-list]");
  if (!list) return;
  const { modules } = await api.get("/api/modules");
  list.innerHTML = modules
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
      await renderModules();
    });
    qs("[data-delete-module]", row).addEventListener("click", async () => {
      try {
        if (!confirm("确定删除这个活动模块吗？")) return;
        await api.delete(`/api/modules/${row.dataset.moduleId}`);
        showToast("删除成功");
        await renderModules();
      } catch (error) {
        alert(error.message);
      }
    });
  });
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
    safeInit(initMePage),
    safeInit(initActivityPage),
    safeInit(initSuccessPage),
    safeInit(initAdminPage),
  ]);
});
