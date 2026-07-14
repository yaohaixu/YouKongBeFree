const assert = require("node:assert/strict");
const { once } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { chromium } = require("playwright");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youkong-test-"));
process.env.STORE_DRIVER = "json";
process.env.YK_DB_FILE = path.join(tmpDir, "youkong-db.json");
process.env.YKADMIN_NICKNAME = "有空管理员";
process.env.YKADMIN_PHONE = "13377779999";

const { createApp, store } = require("../lib/app");

let server;
let baseUrl;

async function request(pathname, options = {}, token = "") {
  const method = String(options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!["GET", "HEAD"].includes(method)) headers["X-Requested-With"] = "XMLHttpRequest";
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${method} ${pathname} -> ${response.status} ${data.error || ""}`);
  }
  return data;
}

async function login(phone) {
  return request("/api/login", { method: "POST", body: { phone } });
}

function localDateTimeFromNow(days, hour = 19, minute = 30) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function localDateInput(days = 0) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function createActivity(token, overrides = {}) {
  const modules = await request("/api/modules");
  const admin = await login("13377779999");
  const { collaborators } = await request("/api/collaborators", {}, admin.token);
  const form = new FormData();
  form.set("title", overrides.title || "自动化测试活动");
  form.set("moduleId", modules.modules[0].id);
  form.set("collaboratorId", overrides.collaboratorId || collaborators[0].id);
  form.set("initiator", overrides.initiator || "成员A");
  form.set("startsAt", overrides.startsAt || localDateTimeFromNow(30));
  form.set("endsAt", overrides.endsAt || "");
  form.set("location", overrides.location || "有空客厅");
  form.set("capacity", overrides.capacity || "");
  form.set("showInitiatorContact", overrides.showInitiatorContact ? "yes" : "no");
  form.set("initiatorContact", overrides.initiatorContact || "");
  form.set("description", overrides.description || "用于自动化测试审核、报名、日志和报名表。");
  form.set("intent", overrides.intent || "submit");
  if (overrides.cover) {
    form.set("cover", overrides.cover.blob, overrides.cover.name);
  }
  return request("/api/activities", { method: "POST", body: form }, token);
}

async function assertNoHorizontalOverflow(page, url) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.equal(result.scrollWidth, result.clientWidth, `${url} should not overflow horizontally`);
}

async function assertMobileActionStack(page, url, minimumButtons = 2) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction((count) =>
    Array.from(document.querySelectorAll(".event-row .row-actions"))
      .some((row) => row.querySelectorAll(".button").length >= count), minimumButtons);
  const layout = await page.evaluate((count) => {
    const actions = Array.from(document.querySelectorAll(".event-row .row-actions"))
      .find((item) => item.querySelectorAll(".button").length >= count);
    if (!actions) return null;
    const row = actions.closest(".event-row");
    const rowStyle = getComputedStyle(row);
    const actionsStyle = getComputedStyle(actions);
    const buttons = Array.from(actions.querySelectorAll(".button")).slice(0, count);
    const rects = buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        text: button.textContent.trim(),
        whiteSpace: getComputedStyle(button).whiteSpace,
      };
    });
    return {
      rowDisplay: rowStyle.display,
      rowColumns: rowStyle.gridTemplateColumns.split(" ").filter(Boolean).length,
      actionsDisplay: actionsStyle.display,
      direction: actionsStyle.flexDirection,
      rects,
    };
  }, minimumButtons);
  assert.ok(layout, `${url} should render row action buttons`);
  assert.equal(layout.rowDisplay, "grid");
  assert.equal(layout.rowColumns, 2);
  assert.equal(layout.actionsDisplay, "flex");
  assert.equal(layout.direction, "column");
  assert.ok(layout.rects.every((rect) => rect.height >= 38), `${url} buttons should keep tappable height`);
  assert.ok(layout.rects.every((rect) => rect.whiteSpace === "nowrap"), `${url} buttons should keep readable horizontal text`);
  const widths = layout.rects.map((rect) => rect.width);
  assert.ok(Math.max(...widths) - Math.min(...widths) <= 2, `${url} buttons should have equal width`);
  const lefts = layout.rects.map((rect) => rect.left);
  assert.ok(Math.max(...lefts) - Math.min(...lefts) <= 2, `${url} buttons should align in one vertical column`);
  const tops = layout.rects.map((rect) => rect.top);
  assert.ok(tops.every((top, index) => index === 0 || top > tops[index - 1]), `${url} buttons should be stacked vertically`);
}

test.before(async () => {
  await store.ensureSeed();
  server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server && server.listening) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("api and browser smoke flow", { timeout: 90000 }, async () => {
  const unsafeLogin = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "13377779999" }),
  });
  assert.equal(unsafeLogin.status, 403, "non-GET API without intent header should be blocked");

  const admin = await login("13377779999");
  await request("/api/users", {
    method: "POST",
    body: { nickname: "协作员A", phone: "13300001111", role: "collaborator" },
  }, admin.token);
  await request("/api/users", {
    method: "POST",
    body: { nickname: "成员A", phone: "13300002222", role: "member" },
  }, admin.token);

  const usersPage = await request("/api/users?page=1&pageSize=1&q=成员", {}, admin.token);
  assert.equal(usersPage.users.length, 1);
  assert.equal(usersPage.pageInfo.pageSize, 1);
  assert.ok(usersPage.pageInfo.total >= 1);

  const modulesPage = await request("/api/modules?paged=true&page=1&pageSize=2&q=有空");
  assert.equal(modulesPage.modules.length, 2);
  assert.equal(modulesPage.pageInfo.pageSize, 2);

  const member = await login("13300002222");
  assert.equal(member.user.phone, "13300002222");
  const qrResponse = await fetch(`${baseUrl}/api/qr?text=${encodeURIComponent(`${baseUrl}/activity.html?id=demo`)}`);
  assert.equal(qrResponse.ok, true);
  assert.match(qrResponse.headers.get("content-type") || "", /image\/svg\+xml/);
  assert.match(await qrResponse.text(), /<svg/);
  const richImageBuffer = fs.readFileSync(path.join(__dirname, "..", "assets", "youkong-gathering.png"));
  const richImageForm = new FormData();
  richImageForm.set("image", new Blob([richImageBuffer], { type: "image/png" }), "rich-body.png");
  const richImage = await request("/api/uploads/rich-image", { method: "POST", body: richImageForm }, member.token);
  assert.match(richImage.url, /\/uploads\/.+\.png$/);

  const template = await request("/api/templates", {
    method: "POST",
    body: {
      name: "有空放映模板",
      description: "适合放映类活动的默认正文",
      content: `<h1>先写清楚为什么放映</h1><p>这里放活动缘起、流程和注意事项。</p><img src="${richImage.url}" alt="模板图">`,
    },
  }, admin.token);
  assert.match(template.template.content, /<h1>先写清楚为什么放映<\/h1>/);
  assert.match(template.template.content, /<img src="\/uploads\//);
  const updatedTemplate = await request(`/api/templates/${template.template.id}`, {
    method: "PUT",
    body: {
      name: "有空放映模板·新版",
      description: "更新后的放映活动底稿",
      content: "<h1>放映之前</h1><p>先把问题交给观众。</p>",
    },
  }, admin.token);
  assert.equal(updatedTemplate.template.name, "有空放映模板·新版");
  const memberTemplates = await request("/api/templates?page=1&pageSize=10&q=放映", {}, member.token);
  assert.ok(memberTemplates.templates.some((item) => item.id === template.template.id));

  const longDescriptionWithImage = `<h1>活动段落标题</h1><p>${"有".repeat(49880)}</p><img src="${richImage.url}" alt="正文图">`;
  const created = await createActivity(member.token, {
    title: "分页和日志测试活动",
    endsAt: localDateTimeFromNow(30, 22, 0),
    showInitiatorContact: true,
    initiatorContact: "13300002222",
    description: `${longDescriptionWithImage}<p>正文<strong>重点</strong><script>alert("x")</script></p>`,
  });
  assert.equal(created.activity.capacity, 99);
  assert.equal(created.activity.registrationCount, 0);
  assert.equal(created.activity.status, "admin_review");
  assert.equal(created.activity.endsAt, localDateTimeFromNow(30, 22, 0));
  assert.equal(created.activity.showInitiatorContact, true);
  assert.equal(created.activity.initiatorContact, "13300002222");
  assert.match(created.activity.description, /<h1>活动段落标题<\/h1>/);
  assert.match(created.activity.description, /<img src="\/uploads\//);
  assert.match(created.activity.description, /<strong>重点<\/strong>/);
  assert.doesNotMatch(created.activity.description, /script|alert/i);

  const owned = await request("/api/activities?owner=me&page=1&pageSize=1", {}, member.token);
  assert.equal(owned.activities.length, 1);
  assert.equal(owned.pageInfo.pageSize, 1);
  const reviewingMine = await request("/api/activities?owner=me&status=reviewing&page=1&pageSize=10", {}, member.token);
  assert.ok(reviewingMine.activities.some((activity) => activity.id === created.activity.id));
  assert.ok(reviewingMine.activities.every((activity) => ["admin_review", "collaborator_review"].includes(activity.status)));

  const memberDashboard = await request("/api/dashboard/me", {}, member.token);
  assert.equal(memberDashboard.summary.total, 1);
  assert.equal(memberDashboard.summary.byStatus.admin_review, 1);
  assert.equal(memberDashboard.pending.total, 0);

  const adminDashboard = await request("/api/dashboard/admin", {}, admin.token);
  assert.ok(adminDashboard.activities.total >= 1);
  assert.ok(adminDashboard.users.total >= 3);
  assert.ok(adminDashboard.modules.total >= 1);
  assert.ok(adminDashboard.templates.total >= 1);
  assert.ok(adminDashboard.pending.total >= 1);
  assert.equal(adminDashboard.pending.activities[0].status, "admin_review");

  await request(`/api/activities/${created.activity.id}/review`, {
    method: "POST",
    body: { action: "approve", comment: "管理员通过" },
  }, admin.token);
  const collaborator = await login("13300001111");
  await request(`/api/activities/${created.activity.id}/review`, {
    method: "POST",
    body: { action: "approve", comment: "协作员通过" },
  }, collaborator.token);
  const publishedMine = await request("/api/activities?owner=me&status=published_group&page=1&pageSize=10", {}, member.token);
  assert.ok(publishedMine.activities.some((activity) => activity.id === created.activity.id));
  assert.ok(publishedMine.activities.every((activity) => ["published", "full"].includes(activity.status)));

  const registration = await request(`/api/activities/${created.activity.id}/register`, {
    method: "POST",
    body: { nickname: "报名者", phone: "18800001111" },
  });
  const duplicate = await request(`/api/activities/${created.activity.id}/register`, {
    method: "POST",
    body: { nickname: "报名者", phone: "18800001111" },
  });
  assert.equal(duplicate.existing, true);
  assert.equal(duplicate.registration.id, registration.registration.id);
  assert.ok(registration.registration.id.startsWith("reg_"));

  const registrations = await request(`/api/activities/${created.activity.id}/registrations`, {}, member.token);
  assert.equal(registrations.registrations.length, 1);

  const byRegistrations = await request("/api/activities?all=true&sort=registrations-desc&page=1&pageSize=1", {}, admin.token);
  assert.equal(byRegistrations.activities[0].id, created.activity.id);
  assert.equal(byRegistrations.activities[0].registrationCount, 1);

  const logs = await request("/api/logs?page=1&pageSize=5&q=测试活动", {}, admin.token);
  assert.ok(logs.logs.length >= 1);
  assert.equal(logs.pageInfo.pageSize, 5);
  const submitLogs = await request(`/api/logs?page=1&pageSize=10&action=activity.create_submit&actorId=${member.user.id}&from=${localDateInput()}&to=${localDateInput()}`, {}, admin.token);
  assert.ok(submitLogs.logs.some((log) => log.targetName === "分页和日志测试活动"));
  assert.ok(submitLogs.logs.every((log) => log.action === "activity.create_submit"));
  assert.ok(submitLogs.logs.every((log) => log.actorId === member.user.id));
  const registrationLogs = await request("/api/logs?page=1&pageSize=10&q=报名活动", {}, admin.token);
  assert.ok(registrationLogs.logs.some((log) => log.actorPhone.includes("****")));
  assert.ok(registrationLogs.logs.every((log) => log.actorPhone !== "18800001111"));
  await store.insert("logs", {
    id: "log_old_retention",
    action: "test.old",
    actionLabel: "旧日志测试",
    actorId: "test",
    actorName: "测试",
    actorRole: "member",
    actorPhone: "",
    targetType: "system",
    targetId: "old",
    targetName: "旧日志保留测试",
    detail: "超过 30 天的操作日志应被清理",
    createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const oldLogs = await request("/api/logs?page=1&pageSize=10&q=旧日志保留测试", {}, admin.token);
  assert.equal(oldLogs.logs.length, 0);
  assert.equal(await store.find("logs", (log) => log.id === "log_old_retention"), null);

  const limited = await createActivity(member.token, {
    title: "一人名额保护测试活动",
    capacity: "1",
  });
  await request(`/api/activities/${limited.activity.id}/review`, {
    method: "POST",
    body: { action: "approve", comment: "管理员通过" },
  }, admin.token);
  await request(`/api/activities/${limited.activity.id}/review`, {
    method: "POST",
    body: { action: "approve", comment: "协作员通过" },
  }, collaborator.token);
  const limitedAttempts = await Promise.allSettled([
    request(`/api/activities/${limited.activity.id}/register`, {
      method: "POST",
      body: { nickname: "报名甲", phone: "18800002222" },
    }),
    request(`/api/activities/${limited.activity.id}/register`, {
      method: "POST",
      body: { nickname: "报名乙", phone: "18800003333" },
    }),
  ]);
  assert.equal(limitedAttempts.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(limitedAttempts.filter((item) => item.status === "rejected").length, 1);
  const fullActivity = await request(`/api/activities/${limited.activity.id}`);
  assert.equal(fullActivity.activity.status, "full");
  assert.equal(fullActivity.activity.registrationCount, 1);
  const limitedRegistrations = await request(`/api/activities/${limited.activity.id}/registrations`, {}, member.token);
  assert.equal(limitedRegistrations.registrations.length, 1);
  const deletedRegistration = limitedRegistrations.registrations[0];
  await request(`/api/activities/${limited.activity.id}/registrations/${limitedRegistrations.registrations[0].id}`, {
    method: "DELETE",
  }, member.token);
  const reopenedActivity = await request(`/api/activities/${limited.activity.id}`);
  assert.equal(reopenedActivity.activity.status, "published");
  assert.equal(reopenedActivity.activity.registrationCount, 0);
  const deleteRegistrationLogs = await request(`/api/logs?page=1&pageSize=10&action=registration.delete&q=${encodeURIComponent(deletedRegistration.nickname)}`, {}, admin.token);
  assert.ok(deleteRegistrationLogs.logs.some((log) => log.detail.includes(deletedRegistration.nickname)));

  const temporaryUser = await request("/api/users", {
    method: "POST",
    body: { nickname: "待删除成员", phone: "13300003333", role: "member" },
  }, admin.token);
  await request(`/api/users/${temporaryUser.user.id}`, { method: "DELETE" }, admin.token);
  const deleteUserLogs = await request(`/api/logs?page=1&pageSize=10&action=user.delete&actorId=admin&q=${encodeURIComponent("待删除成员")}`, {}, admin.token);
  assert.ok(deleteUserLogs.logs.some((log) => log.action === "user.delete" && log.targetName === "待删除成员"));

  const cancellable = await createActivity(member.token, {
    title: "管理员取消日志测试活动",
  });
  await request(`/api/activities/${cancellable.activity.id}/review`, {
    method: "POST",
    body: { action: "approve", comment: "管理员通过" },
  }, admin.token);
  await request(`/api/activities/${cancellable.activity.id}/review`, {
    method: "POST",
    body: { action: "approve", comment: "协作员通过" },
  }, collaborator.token);
  await request(`/api/activities/${cancellable.activity.id}/cancel`, { method: "POST", body: {} }, admin.token);
  const cancelLogs = await request(`/api/logs?page=1&pageSize=10&action=activity.cancel&q=${encodeURIComponent("管理员取消日志测试活动")}`, {}, admin.token);
  assert.ok(cancelLogs.logs.some((log) => log.action === "activity.cancel"));
  await request(`/api/templates/${template.template.id}`, { method: "DELETE" }, admin.token);
  const templateLogs = await request("/api/logs?page=1&pageSize=20&q=放映模板", {}, admin.token);
  assert.ok(templateLogs.logs.some((log) => log.action === "template.create"));
  assert.ok(templateLogs.logs.some((log) => log.action === "template.update"));
  assert.ok(templateLogs.logs.some((log) => log.action === "template.delete"));

  const expired = await createActivity(member.token, {
    title: "应自动结束的历史活动",
    startsAt: localDateTimeFromNow(-30, 18, 0),
  });
  await request(`/api/activities/${expired.activity.id}/review`, {
    method: "POST",
    body: { action: "approve", comment: "管理员通过" },
  }, admin.token);
  await request(`/api/activities/${expired.activity.id}/review`, {
    method: "POST",
    body: { action: "approve", comment: "协作员通过" },
  }, collaborator.token);
  const upcoming = await request("/api/activities?view=upcoming&page=1&pageSize=20");
  assert.ok(!upcoming.activities.some((activity) => activity.id === expired.activity.id));
  const history = await request("/api/activities?view=history&page=1&pageSize=20");
  const endedActivity = history.activities.find((activity) => activity.id === expired.activity.id);
  assert.equal(endedActivity?.status, "ended");
  const manualSweep = await request("/api/system/auto-end", {
    method: "POST",
    body: {},
  }, admin.token);
  assert.ok(Object.hasOwn(manualSweep, "endedCount"));

  const crossDay = await createActivity(member.token, {
    title: "跨天未结束活动",
    startsAt: localDateTimeFromNow(-1, 20, 0),
    endsAt: localDateTimeFromNow(1, 10, 0),
  });
  await request(`/api/activities/${crossDay.activity.id}/review`, {
    method: "POST",
    body: { action: "approve", comment: "管理员通过" },
  }, admin.token);
  await request(`/api/activities/${crossDay.activity.id}/review`, {
    method: "POST",
    body: { action: "approve", comment: "协作员通过" },
  }, collaborator.token);
  const upcomingAfterCrossDay = await request("/api/activities?view=upcoming&page=1&pageSize=20");
  const ongoing = upcomingAfterCrossDay.activities.find((activity) => activity.id === crossDay.activity.id);
  assert.equal(ongoing?.status, "published");
  assert.equal(ongoing?.endsAt, localDateTimeFromNow(1, 10, 0));

  const coverBuffer = fs.readFileSync(path.join(__dirname, "..", "assets", "youkong-gathering.png"));
  const pending = await createActivity(member.token, {
    title: "带封面审核测试活动",
    description: `<h1>待办详情正文图</h1><p>审核时也应该能看到正文图片。</p><img src="${richImage.url}" alt="审核正文图">`,
    cover: {
      blob: new Blob([coverBuffer], { type: "image/png" }),
      name: "youkong-gathering.png",
    },
  });
  assert.equal(pending.activity.status, "admin_review");

  const browser = await chromium.launch();
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/login.html`);
    await page.waitForSelector("[data-theme-switch]");
    const themeSwitchState = await page.evaluate(() => {
      const switcher = document.querySelector("[data-theme-switch]");
      return {
        hasSwitch: Boolean(switcher),
        mode: switcher?.dataset.themeMode,
        svgCount: document.querySelectorAll("[data-theme-switch] svg").length,
        label: switcher?.getAttribute("aria-label") || "",
      };
    });
    assert.equal(themeSwitchState.hasSwitch, true);
    assert.equal(themeSwitchState.mode, "system");
    assert.equal(themeSwitchState.svgCount, 3);
    assert.match(themeSwitchState.label, /跟随系统/);
    await page.locator("[data-theme-switch]").click();
    const themeSwitchAfterClick = await page.evaluate(() => {
      const switcher = document.querySelector("[data-theme-switch]");
      return {
        mode: switcher?.dataset.themeMode,
        label: switcher?.getAttribute("aria-label") || "",
      };
    });
    assert.equal(themeSwitchAfterClick.mode, "dark");
    assert.match(themeSwitchAfterClick.label, /黑夜模式/);
    await page.getByLabel("手机号").fill("13377779999");
    await page.getByRole("button", { name: "进入有空" }).click();
    await page.waitForURL("**/admin.html");
    await assertNoHorizontalOverflow(page, `${baseUrl}/index.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/whitepaper.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/about.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/me.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/my-activities.html?status=draft`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/my-activities.html?status=reviewing`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/my-activities.html?status=published_group`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/activity-editor.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/activities.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/activities.html?view=history`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-activities.html`);
    await assertMobileActionStack(page, `${baseUrl}/admin-activities.html`, 3);
    const memberActionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const memberActionPage = await memberActionContext.newPage();
    await memberActionPage.goto(`${baseUrl}/index.html`);
    await memberActionPage.evaluate(({ token, user }) => {
      localStorage.setItem("yk_session_token", token);
      localStorage.setItem("yk_user", JSON.stringify(user));
    }, { token: member.token, user: member.user });
    await assertMobileActionStack(memberActionPage, `${baseUrl}/my-activities.html`, 2);
    await memberActionContext.close();
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-members.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-templates.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-template-editor.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-logs.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/registrations.html?id=${created.activity.id}`);

    await page.goto(`${baseUrl}/me.html`);
    await page.waitForLoadState("networkidle");
    const dashboardLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-workspace-summary] a.stat-link")).map((link) => ({
        text: link.textContent.trim(),
        href: link.getAttribute("href"),
      }))
    );
    assert.deepEqual(
      dashboardLinks.map((link) => link.href),
      ["my-activities.html", "my-activities.html?status=draft", "my-activities.html?status=reviewing", "my-activities.html?status=published_group"]
    );

    await page.goto(`${baseUrl}/activity-editor.html`);
    await page.waitForLoadState("networkidle");
    const editorState = await page.evaluate(() => ({
      hasEditor: Boolean(document.querySelector("[data-rich-editor]")),
      toolCount: document.querySelectorAll("[data-rich-command]").length,
      hasH1Tool: Boolean(document.querySelector('[data-rich-command="h1"]')),
      hasTemplateSelect: Boolean(document.querySelector("[data-template-select]")),
      hasContactToggle: Boolean(document.querySelector("[data-initiator-contact-toggle]")),
      contactHidden: document.querySelector("[data-initiator-contact-field]")?.hidden,
    }));
    assert.equal(editorState.hasEditor, true);
    assert.ok(editorState.toolCount >= 8);
    assert.equal(editorState.hasH1Tool, true);
    assert.equal(editorState.hasTemplateSelect, true);
    assert.equal(editorState.hasContactToggle, true);
    assert.equal(editorState.contactHidden, true);
    const richEditorCommandState = await page.evaluate(() => {
      const canvas = document.querySelector("[data-rich-canvas]");
      canvas.innerHTML = "<p>移动端标题</p>";
      canvas.focus();
      const range = document.createRange();
      range.selectNodeContents(canvas.firstElementChild);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      document.querySelector('[data-rich-command="h1"]').click();
      const afterH1 = canvas.firstElementChild?.tagName;
      const h1Active = document.querySelector('[data-rich-command="h1"]').classList.contains("is-active");
      document.querySelector('[data-rich-command="h1"]').click();
      const afterToggle = canvas.firstElementChild?.tagName;
      const data = new DataTransfer();
      data.setData("text/plain", "第一段\n\n第二段");
      canvas.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
      return {
        afterH1,
        h1Active,
        afterToggle,
        html: canvas.innerHTML,
      };
    });
    assert.equal(richEditorCommandState.afterH1, "H1");
    assert.equal(richEditorCommandState.h1Active, true);
    assert.equal(richEditorCommandState.afterToggle, "P");
    assert.match(richEditorCommandState.html, /<p>第一段<\/p><p>第二段<\/p>/);
    assert.doesNotMatch(richEditorCommandState.html, /style=|class=/i);

    await page.goto(`${baseUrl}/admin-templates.html`);
    await page.waitForLoadState("networkidle");
    const templateListState = await page.evaluate(() => ({
      hasCreateLink: Boolean(document.querySelector('a[href="admin-template-editor.html"]')),
      hasInlineForm: Boolean(document.querySelector("[data-template-form]")),
    }));
    assert.deepEqual(templateListState, {
      hasCreateLink: true,
      hasInlineForm: false,
    });

    await page.goto(`${baseUrl}/admin-template-editor.html`);
    await page.waitForLoadState("networkidle");
    const templateEditorState = await page.evaluate(() => ({
      hasForm: Boolean(document.querySelector("[data-template-form]")),
      hasEditor: Boolean(document.querySelector("[data-template-form] [data-rich-editor]")),
      hasContentSource: Boolean(document.querySelector('textarea[name="content"][data-rich-source]')),
    }));
    assert.deepEqual(templateEditorState, {
      hasForm: true,
      hasEditor: true,
      hasContentSource: true,
    });

    await page.goto(`${baseUrl}/activity.html?id=${created.activity.id}`);
    await page.waitForLoadState("networkidle");
    const shareState = await page.evaluate(() => ({
      poster: Boolean(document.querySelector("[data-download-poster]")),
      copy: Boolean(document.querySelector("[data-copy-registration-link]")),
      calendar: Boolean(document.querySelector("[data-download-calendar]")),
      richHeading: Boolean(document.querySelector(".article-content h1")),
      richImage: Boolean(document.querySelector(".article-content img")),
      contact: document.querySelector(".initiator-contact")?.textContent || "",
    }));
    assert.equal(shareState.poster, true);
    assert.equal(shareState.copy, true);
    assert.equal(shareState.calendar, true);
    assert.equal(shareState.richHeading, true);
    assert.equal(shareState.richImage, true);
    assert.match(shareState.contact, /13300002222/);

    await page.goto(`${baseUrl}/success.html?activity=${created.activity.id}&registration=${registration.registration.id}`);
    await page.waitForLoadState("networkidle");
    const successPosterState = await page.evaluate(() => ({
      poster: Boolean(document.querySelector("[data-download-poster]")),
      activityShareLoaded: Boolean(window.youkongActivityShare),
    }));
    assert.deepEqual(successPosterState, {
      poster: true,
      activityShareLoaded: true,
    });
    const posterTextPreview = await page.evaluate(() => window.youkongActivityShare.posterTextPreview({
      title: "鹳鸟踟蹰",
      moduleName: "有空放映",
      initiator: "发起人甲",
      location: "有空客厅",
      startsAt: "2026-07-12T20:00",
      endsAt: "2026-07-12T23:00",
    }, {
      registration: {
        nickname: "报名者",
        phone: "18800001111",
      },
    }));
    assert.deepEqual(posterTextPreview, {
      title: "有空放映丨鹳鸟踟蹰",
      initiator: "发起人甲",
      invitee: "报名者",
      phone: "18800001111",
      address: "有空客厅",
      date: "2026年7月12日20:00-2026年7月12日23:00",
      qrLabel: "活动二维码",
      showUrlText: false,
    });
    assert.doesNotMatch(JSON.stringify(posterTextPreview), /【|】/);
    const posterDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载分享海报" }).click();
    const posterFile = await posterDownload;
    assert.match(posterFile.suggestedFilename(), /分享海报\.png$/);

    await page.goto(`${baseUrl}/review-tasks.html`);
    await page.waitForLoadState("networkidle");
    const reviewState = await page.evaluate(() => ({
      value: document.querySelector("[data-review-action]")?.value,
      text: document.querySelector("[data-review-action] option:checked")?.textContent.trim(),
      coverCount: document.querySelectorAll(".review-cover").length,
      richImageCount: document.querySelectorAll(".review-detail .article-content img").length,
    }));
    assert.equal(reviewState.value, "");
    assert.equal(reviewState.text, "请选择");
    assert.equal(reviewState.coverCount, 1);
    assert.ok(reviewState.richImageCount >= 1);
  } finally {
    if (context) await context.close();
    await browser.close();
  }
});
