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
  const created = await createActivity(member.token, {
    title: "分页和日志测试活动",
    endsAt: localDateTimeFromNow(30, 22, 0),
  });
  assert.equal(created.activity.capacity, 99);
  assert.equal(created.activity.registrationCount, 0);
  assert.equal(created.activity.status, "admin_review");
  assert.equal(created.activity.endsAt, localDateTimeFromNow(30, 22, 0));

  const owned = await request("/api/activities?owner=me&page=1&pageSize=1", {}, member.token);
  assert.equal(owned.activities.length, 1);
  assert.equal(owned.pageInfo.pageSize, 1);

  await request(`/api/activities/${created.activity.id}/review`, {
    method: "POST",
    body: { action: "approve", comment: "管理员通过" },
  }, admin.token);
  const collaborator = await login("13300001111");
  await request(`/api/activities/${created.activity.id}/review`, {
    method: "POST",
    body: { action: "approve", comment: "协作员通过" },
  }, collaborator.token);

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

  const registrations = await request(`/api/activities/${created.activity.id}/registrations`, {}, member.token);
  assert.equal(registrations.registrations.length, 1);

  const byRegistrations = await request("/api/activities?all=true&sort=registrations-desc&page=1&pageSize=1", {}, admin.token);
  assert.equal(byRegistrations.activities[0].id, created.activity.id);
  assert.equal(byRegistrations.activities[0].registrationCount, 1);

  const logs = await request("/api/logs?page=1&pageSize=5&q=测试活动", {}, admin.token);
  assert.ok(logs.logs.length >= 1);
  assert.equal(logs.pageInfo.pageSize, 5);

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

  const coverBuffer = fs.readFileSync(path.join(__dirname, "..", "assets", "youkong-room.jpeg"));
  const pending = await createActivity(member.token, {
    title: "带封面审核测试活动",
    cover: {
      blob: new Blob([coverBuffer], { type: "image/jpeg" }),
      name: "youkong-room.jpeg",
    },
  });
  assert.equal(pending.activity.status, "admin_review");

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${baseUrl}/login.html`);
    await page.getByLabel("手机号").fill("13377779999");
    await page.getByRole("button", { name: "进入有空" }).click();
    await page.waitForURL("**/admin.html");
    await assertNoHorizontalOverflow(page, `${baseUrl}/activity-editor.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/activities.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/activities.html?view=history`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-activities.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-members.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-logs.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/registrations.html?id=${created.activity.id}`);

    await page.goto(`${baseUrl}/review-tasks.html`);
    await page.waitForLoadState("networkidle");
    const reviewState = await page.evaluate(() => ({
      value: document.querySelector("[data-review-action]")?.value,
      text: document.querySelector("[data-review-action] option:checked")?.textContent.trim(),
      coverCount: document.querySelectorAll(".review-cover").length,
    }));
    assert.equal(reviewState.value, "");
    assert.equal(reviewState.text, "请选择");
    assert.equal(reviewState.coverCount, 1);
  } finally {
    await browser.close();
  }
});
