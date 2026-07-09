const api = {
  baseUrl: location.hostname.endsWith("tcloudbaseapp.com")
    ? "https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com"
    : "",
  async request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        credentials: "include",
        ...options,
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
  editingActivity: null,
};

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
  return user.role === "admin" ? "admin.html" : "me.html";
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

  let user = null;
  try {
    const session = await api.get("/api/session");
    user = session.user;
  } catch {
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
    await api.post("/api/logout", {});
    location.href = "index.html";
  });
  return user;
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
      const { user } = await api.post("/api/login", { phone: form.phone.value });
      setMessage(message, "登录成功，正在进入页面。", "success");
      location.href = userHome(user);
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
      return;
    }
    list.innerHTML = visible.map(renderActivityCard).join("");
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
  resetActivityForm(form);
  mePageState.modules = await fillModuleSelect(form.moduleId);

  const message = qs("[data-activity-message]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const editing = mePageState.editingActivity;
    setMessage(message, editing ? "正在保存活动..." : "正在发布活动...");
    try {
      const { activity } = editing
        ? await api.put(`/api/activities/${editing.id}`, formData)
        : await api.post("/api/activities", formData);
      setMessage(message, editing ? "活动已保存。" : "活动已发布，正在打开活动页。", "success");
      if (editing) {
        resetActivityForm(form);
        await renderMineActivities();
      } else {
        setTimeout(() => {
          location.href = `activity.html?id=${activity.id}`;
        }, 500);
      }
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });

  qs("[data-cancel-edit]")?.addEventListener("click", () => {
    resetActivityForm(form);
    setMessage(message, "已取消编辑。");
  });

  await renderMineActivities();
}

function resetActivityForm(form) {
  mePageState.editingActivity = null;
  form.reset();
  form.initiator.value = mePageState.user ? mePageState.user.nickname : "";
  qs("[data-activity-form-title]", form)?.replaceChildren(document.createTextNode("添加活动"));
  qs("[data-activity-submit]", form).textContent = "发布活动";
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
  form.description.value = activity.description || "";
  form.cover.value = "";
  qs("[data-activity-form-title]", form)?.replaceChildren(document.createTextNode("编辑活动"));
  qs("[data-activity-submit]", form).textContent = "保存活动";
  qs("[data-cancel-edit]", form).hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function renderMineActivities() {
  const list = qs("[data-my-activities]");
  if (!list) return;
  const { activities } = await api.get("/api/activities?owner=me");
  if (!activities.length) {
    list.innerHTML = `<div class="empty-state"><strong>还没有发起过活动</strong><p>写下一个小想法，客厅就多一张新纸条。</p></div>`;
    return;
  }
  list.innerHTML = activities
    .map(
      (activity) => `
        <article class="event-row">
          <div>
            <span class="tag">${escapeHtml(activity.moduleName)}</span>
            <h3><a href="activity.html?id=${activity.id}">${escapeHtml(activity.title)}</a></h3>
            <p>${formatDate(activity.startsAt)} · ${escapeHtml(activity.location)} · ${activity.registrationCount} 人报名</p>
          </div>
          <div class="row-actions">
            <button class="button outline" type="button" data-edit-activity-id="${activity.id}">编辑</button>
            <button class="button outline" type="button" data-registration-id="${activity.id}">查看报名表</button>
          </div>
        </article>
      `
    )
    .join("");

  qsa("[data-edit-activity-id]", list).forEach((button) => {
    button.addEventListener("click", async () => {
      const { activity } = await api.get(`/api/activities/${button.dataset.editActivityId}`);
      fillActivityForm(qs("[data-activity-form]"), activity);
    });
  });

  qsa("[data-registration-id]", list).forEach((button) => {
    button.addEventListener("click", () => renderRegistrations(button.dataset.registrationId));
  });
}

async function renderRegistrations(activityId) {
  const panel = qs("[data-registration-panel]");
  if (!panel) return;
  panel.innerHTML = `<p class="muted-text">正在读取报名表...</p>`;
  try {
    const { registrations } = await api.get(`/api/activities/${activityId}/registrations`);
    if (!registrations.length) {
      panel.innerHTML = `<div class="empty-state"><strong>暂时还没人报名</strong><p>可以把活动链接发到社群里。</p></div>`;
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
    qsa("[data-delete-registration]", panel).forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("确定删除这条报名记录吗？")) return;
        await api.delete(`/api/activities/${activityId}/registrations/${button.dataset.deleteRegistration}`);
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
  root.innerHTML = `
    <section class="activity-hero">
      <div>
        <span class="tag">${escapeHtml(activity.moduleName)}</span>
        <h1>${escapeHtml(activity.title)}</h1>
        <p>${escapeHtml(activity.location)} · ${formatDate(activity.startsAt)}</p>
        <div class="event-meta">
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
        <aside class="form-note">
          <h3>报名这个活动</h3>
          <form data-register-form>
            <label for="nickname">昵称</label>
            <input id="nickname" name="nickname" required />
            <label for="phone">手机号</label>
            <input id="phone" name="phone" inputmode="tel" required />
            <button class="button primary" type="submit">提交报名</button>
            <p class="form-message" data-register-message></p>
          </form>
        </aside>
      </div>
    </section>
  `;

  const form = qs("[data-register-form]");
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
            <a class="button ghost" href="participate.html">看看其他活动</a>
          </div>
        </div>
      </section>
    `;
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
  if (user.role !== "admin") {
    adminRoot.innerHTML = `<div class="empty-state"><strong>你还不是管理员</strong><p>只有 YKadmin 可以进入后台。</p></div>`;
    return;
  }

  await Promise.all([renderUsers(), renderModules()]);
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
        role: userForm.role.value,
      });
      userForm.reset();
      setMessage(userMessage, "成员已添加。", "success");
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
      await renderModules();
    } catch (error) {
      setMessage(moduleMessage, error.message, "error");
    }
  });
}

async function renderUsers() {
  const list = qs("[data-user-list]");
  if (!list) return;
  const { users } = await api.get("/api/users");
  list.innerHTML = users
    .map(
      (user) => `
        <article class="manage-row" data-user-id="${user.id}">
          <input name="nickname" value="${escapeHtml(user.nickname)}" />
          <input name="phone" value="${escapeHtml(user.phone)}" inputmode="tel" />
          <select name="role">
            <option value="member" ${user.role === "member" ? "selected" : ""}>成员</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>管理员</option>
          </select>
          <button class="button outline" type="button" data-save-user>保存</button>
          <button class="button outline" type="button" data-delete-user ${user.id === "admin" ? "disabled" : ""}>删除</button>
        </article>
      `
    )
    .join("");

  qsa("[data-user-id]", list).forEach((row) => {
    qs("[data-save-user]", row).addEventListener("click", async () => {
      await api.put(`/api/users/${row.dataset.userId}`, {
        nickname: qs('[name="nickname"]', row).value,
        phone: qs('[name="phone"]', row).value,
        role: qs('[name="role"]', row).value,
      });
      await renderUsers();
    });
    qs("[data-delete-user]", row).addEventListener("click", async () => {
      await api.delete(`/api/users/${row.dataset.userId}`);
      await renderUsers();
    });
  });
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

  qsa("[data-module-id]", list).forEach((row) => {
    qs("[data-save-module]", row).addEventListener("click", async () => {
      await api.put(`/api/modules/${row.dataset.moduleId}`, {
        name: qs('[name="name"]', row).value,
        description: qs('[name="description"]', row).value,
      });
      await renderModules();
    });
    qs("[data-delete-module]", row).addEventListener("click", async () => {
      try {
        await api.delete(`/api/modules/${row.dataset.moduleId}`);
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
