const assert = require("node:assert/strict");
const { once } = require("node:events");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { chromium } = require("playwright");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youkong-test-"));
process.env.STORE_DRIVER = "json";
process.env.YK_DB_FILE = path.join(tmpDir, "youkong-db.json");
process.env.YKADMIN_NICKNAME = "有空管理员";
process.env.YKADMIN_PHONE = "18800000000";

const { createApp, store } = require("../lib/app");
const { shouldCallAi } = require("../lib/ai-analysis/service");

let server;
let baseUrl;
const activityManageTokens = new Map();
const testClientId = `client_${Date.now()}_${Math.random().toString(16).slice(2)}`;

async function request(pathname, options = {}, token = "") {
  const method = String(options.method || "GET").toUpperCase();
  const headers = {
    "X-YK-Client-Id": testClientId,
    "X-YK-Fingerprint": "fp_smoke_test",
    ...(options.headers || {}),
  };
  const activityId = String(pathname).match(/\/api\/activities\/([^/?]+)/)?.[1];
  if (activityId && activityManageTokens.has(activityId)) {
    headers["X-YK-Manage-Token"] = activityManageTokens.get(activityId);
  }
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
  if (data.manageToken && data.activity?.id) {
    activityManageTokens.set(data.activity.id, data.manageToken);
  }
  return data;
}

async function login(phone) {
  return request("/api/login", { method: "POST", body: { phone } });
}

async function startAiStub(report = {}) {
  let calls = 0;
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      calls += 1;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              riskScore: 12,
              confidence: 0.9,
              riskLevel: "low",
              isRealActivity: true,
              isAdvertisement: false,
              isSpam: false,
              isScam: false,
              containsPolitical: false,
              containsIllegal: false,
              containsAdult: false,
              containsViolence: false,
              summary: "AI stub 分析结果",
              category: "测试",
              tags: ["测试"],
              positiveSignals: ["有明确时间地点"],
              negativeSignals: [],
              riskReason: [],
              improvementSuggestions: [],
              ...report,
            }),
          },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end("{}");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    get calls() {
      return calls;
    },
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
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
  const { collaborators } = await request("/api/collaborators");
  const form = new FormData();
  form.set("title", overrides.title || "自动化测试活动");
  form.set("moduleId", modules.modules[0].id);
  form.set("collaboratorId", overrides.collaboratorId || collaborators[0].id);
  form.set("initiator", overrides.initiator || "成员A");
  form.set("startsAt", overrides.startsAt || localDateTimeFromNow(30));
  form.set("endsAt", overrides.endsAt || "");
  form.set("location", overrides.location || "有空客厅");
  form.set("capacity", overrides.capacity || "");
  form.set("showRegistrationNames", overrides.showRegistrationNames ? "yes" : "no");
  form.set("showFeedbacks", overrides.showFeedbacks === false ? "no" : "yes");
  form.set("sourceType", overrides.sourceType || "living_room");
  form.set("friendId", overrides.friendId || "");
  form.set("minRegistrationEnabled", overrides.minRegistrationEnabled ? "yes" : "no");
  form.set("minRegistrationCount", overrides.minRegistrationCount || "");
  form.set("registrationDeadline", overrides.registrationDeadline || (overrides.minRegistrationEnabled ? (overrides.startsAt || localDateTimeFromNow(30)) : ""));
  form.set("showInitiatorContact", overrides.showInitiatorContact ? "yes" : "no");
  form.set("initiatorContact", overrides.initiatorContact || "");
  const highRiskText = "诈骗 洗钱 博彩 办证 www.example.com https://spam.example.com https://spam2.example.com !!!!!!!!!! 加我加我加我加我";
  const baseDescription = overrides.description || "用于自动化测试发布、报名、日志和报名表。";
  form.set("description", overrides.forceReview ? `${baseDescription}<p>${highRiskText}</p>` : baseDescription);
  form.set("intent", overrides.intent || "submit");
  if (overrides.cover) {
    form.set("cover", overrides.cover.blob, overrides.cover.name);
  }
  const created = await request("/api/activities", { method: "POST", body: form }, token);
  if (overrides.waitForAnalysis === false || created.activity.status !== "analysis_pending") {
    return created;
  }
  return waitForActivityAnalysis(created, token);
}

async function waitForActivityAnalysis(created, token = "", attempts = 80) {
  let current = created;
  for (let index = 0; index < attempts; index += 1) {
    if (current.activity?.status && current.activity.status !== "analysis_pending") return { ...created, ...current };
    await new Promise((resolve) => setTimeout(resolve, 50));
    current = await request(`/api/activities/${created.activity.id}`, {}, token);
  }
  throw new Error(`activity ${created.activity.id} stayed analysis_pending`);
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
  const safetyConfig = await store.findById("systemConfigs", "safety_config");
  await store.update("systemConfigs", "safety_config", {
    value: {
      ...safetyConfig.value,
      rateLimit: {
        ...safetyConfig.value.rateLimit,
        publishMinuteMax: 100,
        publishDayMax: 100,
        draftMinuteMax: 100,
        uploadMinuteMax: 100,
      },
    },
  });
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
    body: JSON.stringify({ phone: "18800000000" }),
  });
  assert.equal(unsafeLogin.status, 403, "non-GET API without intent header should be blocked");

  const admin = await login("18800000000");
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

  const friendForm = new FormData();
  friendForm.set("name", "邻里小屋");
  friendForm.set("description", "一个可以一起读书和交换旧物的朋友空间");
  friendForm.set("address", "重庆江北朋友巷 1 号");
  friendForm.set("contactName", "朋友主理人");
  friendForm.set("contactInfo", "wechat-friend");
  friendForm.set("enabled", "true");
  const friendCreated = await request("/api/living-room-friends", {
    method: "POST",
    body: friendForm,
  }, admin.token);
  assert.equal(friendCreated.friend.name, "邻里小屋");
  assert.equal(friendCreated.friend.enabled, true);
  const friendList = await request("/api/living-room-friends?enabled=true&page=1&pageSize=10&q=邻里");
  assert.ok(friendList.friends.some((friend) => friend.id === friendCreated.friend.id));

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
  const fakeImageForm = new FormData();
  fakeImageForm.set("image", new Blob(["<script>alert(1)</script>"], { type: "image/png" }), "fake.png");
  const fakeImageUpload = await fetch(`${baseUrl}/api/uploads/rich-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${member.token}`,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: fakeImageForm,
  });
  assert.equal(fakeImageUpload.status, 400);

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

  const longMeetingUrl = `https://meeting.tencent.com/dm/${"YK".repeat(120)}?meeting_code=${"1234567890".repeat(12)}`;
  const longDescriptionWithImage = `<h1>活动段落标题</h1><p>${"有".repeat(48500)}</p><img src="${richImage.url}" alt="正文图">`;
  const created = await createActivity(member.token, {
    title: "分页和日志测试活动",
    endsAt: localDateTimeFromNow(30, 22, 0),
    showInitiatorContact: true,
    initiatorContact: "13300002222",
    description: `${longDescriptionWithImage}<p>腾讯会议链接：<a href="${longMeetingUrl}">${longMeetingUrl}</a></p><p>正文<strong>重点</strong><script>alert("x")</script></p>`,
  });
  assert.equal(created.activity.capacity, 99);
  assert.equal(created.activity.registrationCount, 0);
  assert.equal(created.activity.status, "published");
  assert.ok(created.activity.confidenceScore <= 100);
  assert.equal(created.activity.endsAt, localDateTimeFromNow(30, 22, 0));
  assert.equal(created.activity.showInitiatorContact, true);
  assert.equal(created.activity.initiatorContact, "13300002222");
  assert.match(created.activity.description, /<h1>活动段落标题<\/h1>/);
  assert.match(created.activity.description, /<img src="\/uploads\//);
  assert.match(created.activity.description, /<strong>重点<\/strong>/);
  assert.doesNotMatch(created.activity.description, /script|alert/i);

  const friendSourceActivity = await createActivity(member.token, {
    title: "客厅朋友来源测试活动",
    sourceType: "friend",
    friendId: friendCreated.friend.id,
  });
  assert.equal(friendSourceActivity.activity.sourceType, "friend");
  assert.equal(friendSourceActivity.activity.sourceName, "邻里小屋");
  assert.equal(friendSourceActivity.activity.friend.id, friendCreated.friend.id);
  const friendSourceList = await request("/api/activities?all=true&sourceType=friend&page=1&pageSize=10", {}, admin.token);
  assert.ok(friendSourceList.activities.some((activity) => activity.id === friendSourceActivity.activity.id));

  const owned = await request("/api/activities?owner=me&page=1&pageSize=1", {}, member.token);
  assert.equal(owned.activities.length, 1);
  assert.equal(owned.pageInfo.pageSize, 1);
  assert.equal(owned.pageInfo.total, 2);
  const reviewingMine = await request("/api/activities?owner=me&status=reviewing&page=1&pageSize=10", {}, member.token);
  assert.ok(reviewingMine.activities.every((activity) => ["admin_review", "collaborator_review"].includes(activity.status)));

  const memberDashboard = await request("/api/dashboard/me", {}, member.token);
  assert.equal(memberDashboard.summary.total, 2);
  assert.equal(memberDashboard.summary.byStatus.published, 2);
  assert.equal(memberDashboard.pending.total, 0);

  const reviewCandidate = await createActivity(member.token, {
    title: "社区复核测试活动",
    forceReview: true,
  });
  assert.equal(reviewCandidate.activity.status, "admin_review");

  const adminDashboard = await request("/api/dashboard/admin", {}, admin.token);
  assert.ok(adminDashboard.activities.total >= 2);
  assert.ok(adminDashboard.users.total >= 3);
  assert.ok(adminDashboard.modules.total >= 1);
  assert.ok(adminDashboard.templates.total >= 1);
  assert.ok(adminDashboard.pending.total >= 1);
  assert.equal(adminDashboard.pending.activities[0].status, "admin_review");

  const safetyRules = await request("/api/safety/rules", {}, admin.token);
  assert.ok(safetyRules.rules.some((rule) => rule.type === "sensitive_terms"));
  const safetyConfigPublic = await request("/api/safety/client-config");
  assert.equal(safetyConfigPublic.turnstile.enabled, false);
  const aiSettings = await request("/api/ai/settings", {}, admin.token);
  assert.equal(aiSettings.settings.enabled, false);
  assert.equal(aiSettings.settings.apiKeyStatus, "未配置");
  assert.equal(aiSettings.settings.callStrategy.ruleConfidenceMax, 70);
  assert.equal(aiSettings.settings.callStrategy.firstActivityCount, 3);
  const aiSettingsUpdate = await request("/api/ai/settings", {
    method: "PUT",
    body: { callStrategy: { ruleConfidenceMax: 55, firstActivityCount: 4 } },
  }, admin.token);
  assert.equal(aiSettingsUpdate.settings.callStrategy.ruleConfidenceMax, 55);
  assert.equal(aiSettingsUpdate.settings.callStrategy.firstActivityCount, 4);
  assert.equal(aiSettingsUpdate.settings.callStrategy.lowConfidenceOnly, true);
  assert.equal(aiSettingsUpdate.settings.callStrategy.firstActivitiesAlways, true);
  assert.equal(shouldCallAi({
    enabled: true,
    callStrategy: {
      lowConfidenceOnly: true,
      ruleConfidenceMax: 55,
      firstActivitiesAlways: false,
      mediumRiskOnly: false,
      randomSampleRate: 0,
    },
  }, {
    ruleReport: { riskScore: 47, confidenceScore: 53 },
    identityActivityCount: 9,
  }).reason, "low-rule-confidence");
  assert.equal(shouldCallAi({
    enabled: true,
    callStrategy: {
      lowConfidenceOnly: true,
      ruleConfidenceMax: 55,
      firstActivitiesAlways: true,
      firstActivityCount: 4,
      mediumRiskOnly: false,
      randomSampleRate: 0,
    },
  }, {
    ruleReport: { riskScore: 0, confidenceScore: 100 },
    identityActivityCount: 3,
  }).reason, "new-identity-first-activities");
  assert.equal(shouldCallAi({
    enabled: true,
    callStrategy: {
      lowConfidenceOnly: true,
      ruleConfidenceMax: 100,
      firstActivitiesAlways: false,
      mediumRiskOnly: false,
      randomSampleRate: 0,
    },
  }, {
    ruleReport: { riskScore: 0, confidenceScore: 100 },
    identityActivityCount: 99,
  }).reason, "low-rule-confidence");
  const aiStub = await startAiStub();
  try {
    await request("/api/ai/settings", {
      method: "PUT",
      body: {
        enabled: "true",
        provider: "openai-compatible",
        baseUrl: aiStub.baseUrl,
        model: "stub-model",
        apiKey: "stub-key",
        cacheTtlSeconds: 0,
        callStrategy: {
          lowConfidenceOnly: true,
          ruleConfidenceMax: 100,
          firstActivitiesAlways: false,
          mediumRiskOnly: false,
          randomSampleRate: 0,
        },
      },
    }, admin.token);
    const savedAiSettings = await request("/api/ai/settings", {}, admin.token);
    assert.equal(savedAiSettings.settings.apiKeyStatus, "已保存，可覆盖替换");
    await request("/api/ai/settings", {
      method: "PUT",
      body: {
        enabled: "true",
        provider: "openai-compatible",
        baseUrl: aiStub.baseUrl,
        model: "stub-model",
        apiKey: "",
        cacheTtlSeconds: 0,
        callStrategy: {
          lowConfidenceOnly: true,
          ruleConfidenceMax: 100,
          firstActivitiesAlways: false,
          mediumRiskOnly: false,
          randomSampleRate: 0,
        },
      },
    }, admin.token);
    const savedKeyConnection = await request("/api/ai/test-connection", {
      method: "POST",
      body: {},
    }, admin.token);
    assert.equal(savedKeyConnection.ok, true);
    const aiCalledActivity = await createActivity("", {
      title: "匿名 AI 必调测试活动",
      initiator: "匿名发起人",
      description: "这是一个普通的匿名活动，用于验证规则置信度阈值为 100 时 AI 真的会被调用。",
    });
    assert.equal(aiCalledActivity.activity.status, "published");
    assert.ok(aiStub.calls >= 1);
    const aiCalledConfidence = await request(`/api/activities/${aiCalledActivity.activity.id}/confidence`, {}, admin.token);
    assert.equal(aiCalledConfidence.latestAnalysis.aiMeta.skipped, false);
    assert.equal(aiCalledConfidence.latestAnalysis.aiMeta.triggerReason, "low-rule-confidence");
    assert.equal(aiCalledConfidence.latestAnalysis.aiReport.summary, "AI stub 分析结果");
  } finally {
    await aiStub.close();
  }
  const clearAdStub = await startAiStub({
    riskScore: 20,
    confidence: 0.95,
    isAdvertisement: true,
    advertisementLevel: "clear",
    summary: "这是明确营销引流活动",
    riskReason: ["明确营销、引流和销售"],
  });
  try {
    await request("/api/ai/settings", {
      method: "PUT",
      body: {
        enabled: "true",
        provider: "openai-compatible",
        baseUrl: clearAdStub.baseUrl,
        model: "stub-model",
        apiKey: "stub-key",
        cacheTtlSeconds: 0,
        callStrategy: {
          lowConfidenceOnly: true,
          ruleConfidenceMax: 100,
          firstActivitiesAlways: false,
          mediumRiskOnly: false,
          randomSampleRate: 0,
        },
      },
    }, admin.token);
    const clearAdActivity = await createActivity("", {
      title: "明确营销强信号测试活动",
      initiator: "匿名发起人",
      description: "表面上是一场分享会，但 AI 会明确标记为营销。",
    });
    assert.equal(clearAdActivity.activity.status, "admin_review");
    assert.equal(clearAdActivity.activity.isHidden, true);
    assert.equal(clearAdActivity.activity.reviewFlag, "clear_advertisement");
    assert.ok(clearAdActivity.activity.riskScore >= 75);
  } finally {
    await clearAdStub.close();
  }
  const forceAiStub = await startAiStub({
    riskScore: 16,
    confidence: 0.91,
    summary: "强制重新分析使用的新 Prompt 结果",
  });
  try {
    const forcePrompt = await request("/api/ai/prompts", {
      method: "POST",
      body: {
        type: "activity",
        version: "activity-force-v2",
        name: "强制重新分析 Prompt",
        active: "false",
        systemPrompt: "你是强制重新分析测试观察员，只输出 JSON。",
        userPrompt: "请用新版 Prompt 分析活动内容。",
      },
    }, admin.token);
    await request(`/api/ai/prompts/${forcePrompt.prompt.id}/activate`, {
      method: "POST",
      body: {},
    }, admin.token);
    await request("/api/ai/settings", {
      method: "PUT",
      body: {
        enabled: "true",
        provider: "openai-compatible",
        baseUrl: forceAiStub.baseUrl,
        model: "stub-model",
        apiKey: "stub-key",
        cacheTtlSeconds: 86400,
        callStrategy: {
          lowConfidenceOnly: true,
          ruleConfidenceMax: 100,
          firstActivitiesAlways: false,
          mediumRiskOnly: false,
          randomSampleRate: 0,
        },
      },
    }, admin.token);
    const cachedAiActivity = await createActivity("", {
      title: "强制重新分析缓存测试活动",
      initiator: "匿名发起人",
      description: "普通社区活动，用于验证重新分析一定绕过缓存再次调用 AI。",
    });
    const callsAfterCreate = forceAiStub.calls;
    assert.ok(callsAfterCreate >= 1);
    await request(`/api/activities/${cachedAiActivity.activity.id}/reanalyze`, {
      method: "POST",
      body: {},
    }, admin.token);
    assert.ok(forceAiStub.calls > callsAfterCreate, "manual reanalysis should bypass AI cache and call provider again");
    const forcedConfidence = await request(`/api/activities/${cachedAiActivity.activity.id}/confidence`, {}, admin.token);
    assert.equal(forcedConfidence.latestAnalysis.aiMeta.triggerReason, "manual-forced");
    assert.equal(forcedConfidence.latestAnalysis.aiMeta.forced, true);
    assert.equal(forcedConfidence.latestAnalysis.aiMeta.promptVersion, "activity-force-v2");
  } finally {
    await forceAiStub.close();
  }
  await request("/api/ai/settings", {
    method: "PUT",
    body: {
      enabled: "false",
      callStrategy: {
        lowConfidenceOnly: true,
        ruleConfidenceMax: 100,
        firstActivitiesAlways: false,
        mediumRiskOnly: false,
        randomSampleRate: 0,
      },
    },
  }, admin.token);
  const aiClosedFallback = await createActivity("", {
    title: "匿名 AI 关闭兜底测试活动",
    initiator: "匿名发起人",
    description: "澳门赌场 发票 投资 成人 贷款 套现 返现，这是一条用于测试高风险内容在 AI 关闭时进入管理员兜底审核的活动。",
  });
  assert.equal(aiClosedFallback.activity.status, "admin_review");
  assert.equal(aiClosedFallback.activity.policyAction, "review");
  assert.equal(aiClosedFallback.activity.safetyFallbackReason, "ai-unavailable");
  const fallbackConfidence = await request(`/api/activities/${aiClosedFallback.activity.id}/confidence`, {}, admin.token);
  assert.equal(fallbackConfidence.latestAnalysis.aiMeta.reason, "disabled");
  assert.ok(fallbackConfidence.latestAnalysis.ruleReport.findings.some((item) => item.ruleId === "regulated_sensitive_terms"));
  const stuckPending = await createActivity("", {
    title: "缺失分析任务恢复测试活动",
    initiator: "匿名发起人",
    description: "普通社区活动，用于验证 analysis_pending 活动在任务缺失时会被 sweep 恢复。",
    waitForAnalysis: false,
  });
  await store.remove("activityAnalysisJobs", (item) => item.activityId === stuckPending.activity.id);
  await store.update("activities", stuckPending.activity.id, {
    status: "analysis_pending",
    reviewStep: "analysis",
    analysisStatus: "pending",
    analysisVersion: Number(stuckPending.activity.analysisVersion || 1) + 1,
    updatedAt: new Date().toISOString(),
  });
  const recoveredSweep = await request("/api/system/analysis-jobs/sweep", {
    method: "POST",
    body: {},
  }, admin.token);
  assert.ok(recoveredSweep.recovered >= 1 || recoveredSweep.processed >= 1);
  const recoveredActivity = await request(`/api/activities/${stuckPending.activity.id}`, {}, admin.token);
  assert.notEqual(recoveredActivity.activity.status, "analysis_pending");
  const confidenceDetail = await request(`/api/activities/${created.activity.id}/confidence`, {}, admin.token);
  assert.equal(confidenceDetail.activity.id, created.activity.id);
  assert.ok(confidenceDetail.latestAnalysis.ruleReport);
  const communityReport = await request(`/api/activities/${created.activity.id}/reports`, {
    method: "POST",
    body: { reason: "广告营销", detail: "测试社区反馈入口" },
  });
  assert.equal(communityReport.ok, true);
  const reportAdminList = await request("/api/reports?page=1&pageSize=10&q=测试社区反馈入口", {}, admin.token);
  assert.ok(reportAdminList.reports.some((report) => report.activityId === created.activity.id));
  const confidenceAfterReport = await request(`/api/activities/${created.activity.id}/confidence`, {}, admin.token);
  assert.ok(confidenceAfterReport.reports.some((report) => report.detail === "测试社区反馈入口"));
  const trustProfiles = await request("/api/trust-profiles?page=1&pageSize=10", {}, admin.token);
  assert.ok(trustProfiles.profiles.some((profile) => profile.id));
  const governanceOverview = await request("/api/governance/overview", {}, admin.token);
  assert.ok(governanceOverview.overview.identities.total >= 1);
  const governanceIdentities = await request("/api/governance/identities?page=1&pageSize=10", {}, admin.token);
  assert.ok(governanceIdentities.profiles.some((profile) => profile.communityId && Array.isArray(profile.badges)));
  const governanceDetail = await request(`/api/governance/identities/${encodeURIComponent(created.activity.anonymousIdentityId)}`, {}, admin.token);
  assert.ok(governanceDetail.communityEvents.some((event) => event.type === "activity.confidence.evaluated"));
  assert.ok(governanceDetail.trustEvents.some((event) => event.metadata?.communityEventId));
  const trustPolicies = await request("/api/governance/trust-policies?page=1&pageSize=100", {}, admin.token);
  assert.ok(trustPolicies.policies.some((policy) => policy.eventType === "activity.confidence.evaluated"));
  const createdTrustPolicy = await request("/api/governance/trust-policies", {
    method: "POST",
    body: {
      name: "测试信用策略",
      eventType: "test.event",
      enabled: "true",
      order: 999,
      conditionMode: "all",
      conditions: [],
      effect: { trustDelta: 0 },
      description: "测试可配置策略",
    },
  }, admin.token);
  const updatedTrustPolicy = await request(`/api/governance/trust-policies/${createdTrustPolicy.policy.id}`, {
    method: "PUT",
    body: {
      ...createdTrustPolicy.policy,
      name: "测试信用策略更新",
      effect: { trustDelta: 1 },
    },
  }, admin.token);
  assert.equal(updatedTrustPolicy.policy.effect.trustDelta, 1);
  await request(`/api/governance/trust-policies/${createdTrustPolicy.policy.id}`, { method: "DELETE" }, admin.token);
  const badges = await request("/api/governance/badges?page=1&pageSize=100", {}, admin.token);
  assert.ok(badges.badges.some((badge) => badge.type === "identity"));
  const createdBadge = await request("/api/governance/badges", {
    method: "POST",
    body: {
      name: "测试徽章",
      type: "achievement",
      icon: "test",
      color: "#123456",
      enabled: "true",
      order: 999,
      description: "测试徽章",
      rule: { mode: "all", conditions: [{ field: "profile.communityTrust", op: "gte", value: 0 }] },
    },
  }, admin.token);
  const badgePolicies = await request("/api/governance/badge-policies?page=1&pageSize=100", {}, admin.token);
  const createdBadgePolicy = badgePolicies.policies.find((policy) => policy.badgeId === createdBadge.badge.id);
  assert.ok(createdBadgePolicy);
  const updatedBadgePolicy = await request(`/api/governance/badge-policies/${createdBadgePolicy.id}`, {
    method: "PUT",
    body: {
      ...createdBadgePolicy,
      publicVisible: "true",
      displayLocations: { activityDetail: true, adminOnly: false },
    },
  }, admin.token);
  assert.equal(updatedBadgePolicy.policy.publicVisible, true);
  await request(`/api/governance/badges/${createdBadge.badge.id}`, { method: "DELETE" }, admin.token);

  const sensitiveRule = safetyRules.rules.find((rule) => rule.type === "sensitive_terms");
  assert.ok(sensitiveRule);
  const beforeReanalysis = await request(`/api/activities/${reviewCandidate.activity.id}/confidence`, {}, admin.token);
  await request(`/api/safety/rules/${sensitiveRule.id}`, {
    method: "PUT",
    body: {
      name: sensitiveRule.name,
      type: sensitiveRule.type,
      weight: 8,
      enabled: String(sensitiveRule.enabled !== false),
      description: sensitiveRule.description,
      params: sensitiveRule.params,
    },
  }, admin.token);
  const reanalyzed = await request(`/api/activities/${reviewCandidate.activity.id}/reanalyze`, {
    method: "POST",
    body: {},
  }, admin.token);
  assert.ok(reanalyzed.activity.riskScore <= beforeReanalysis.activity.riskScore - 10);
  assert.ok(reanalyzed.activity.confidenceScore < 100);
  assert.ok(reanalyzed.analysis.ruleReport.findings.some((item) => item.ruleId === sensitiveRule.id && item.scoreDelta === 8));
  await request(`/api/safety/rules/${sensitiveRule.id}`, {
    method: "PUT",
    body: {
      name: sensitiveRule.name,
      type: sensitiveRule.type,
      weight: sensitiveRule.weight,
      enabled: String(sensitiveRule.enabled !== false),
      description: sensitiveRule.description,
      params: sensitiveRule.params,
    },
  }, admin.token);

  await request(`/api/activities/${reviewCandidate.activity.id}/review`, {
    method: "POST",
    body: { action: "approve", comment: "管理员通过" },
  }, admin.token);
  const reviewedCandidate = await request(`/api/activities/${reviewCandidate.activity.id}`, {}, member.token);
  assert.equal(reviewedCandidate.activity.status, "published");
  const publishedMine = await request("/api/activities?owner=me&status=published_group&page=1&pageSize=10", {}, member.token);
  assert.ok(publishedMine.activities.some((activity) => activity.id === created.activity.id));
  assert.ok(publishedMine.activities.every((activity) => ["published", "full"].includes(activity.status)));

  const registration = await request(`/api/activities/${created.activity.id}/register`, {
    method: "POST",
    body: { nickname: "报名者" },
  });
  const duplicate = await request(`/api/activities/${created.activity.id}/register`, {
    method: "POST",
    body: { nickname: "报名者" },
  });
  assert.equal(duplicate.existing, true);
  assert.equal(duplicate.registration.id, registration.registration.id);
  assert.ok(registration.registration.id.startsWith("reg_"));
  assert.ok(registration.accessToken);
  assert.equal(registration.registration.accessToken, registration.accessToken);
  assert.equal(registration.registration.phone, undefined);
  assert.equal(registration.registration.phoneHash, undefined);
  assert.ok(duplicate.accessToken);
  assert.notEqual(duplicate.accessToken, registration.accessToken);
  const noTokenConfirm = await fetch(`${baseUrl}/api/activities/${created.activity.id}/registrations/${registration.registration.id}`);
  assert.equal(noTokenConfirm.status, 403);
  const staleTokenConfirm = await fetch(`${baseUrl}/api/activities/${created.activity.id}/registrations/${registration.registration.id}?token=${encodeURIComponent(registration.accessToken)}`);
  assert.equal(staleTokenConfirm.status, 403);
  const publicConfirm = await request(`/api/activities/${created.activity.id}/registrations/${registration.registration.id}?token=${encodeURIComponent(duplicate.accessToken)}`);
  assert.equal(publicConfirm.registration.nickname, "报名者");
  assert.equal(publicConfirm.registration.phone, undefined);
  assert.equal(publicConfirm.registration.phoneHash, undefined);
  const noTokenCancel = await fetch(`${baseUrl}/api/activities/${created.activity.id}/registrations/${registration.registration.id}/cancel`, {
    method: "POST",
    headers: { "X-Requested-With": "XMLHttpRequest" },
    body: "{}",
  });
  assert.equal(noTokenCancel.status, 403);
  const cancellableRegistration = await request(`/api/activities/${created.activity.id}/register`, {
    method: "POST",
    headers: { "X-YK-Client-Id": `${testClientId}_cancel` },
    body: { nickname: "临时取消" },
  });
  await request(`/api/activities/${created.activity.id}/registrations/${cancellableRegistration.registration.id}/cancel`, {
    method: "POST",
    body: { token: cancellableRegistration.accessToken },
  });
  const myActiveRegistrations = await request("/api/my/registrations?page=1&pageSize=10");
  assert.ok(myActiveRegistrations.registrations.some((item) => item.id === registration.registration.id));
  const myCancelledRegistrations = await request("/api/my/registrations?page=1&pageSize=10", {
    headers: { "X-YK-Client-Id": `${testClientId}_cancel` },
  });
  assert.ok(!myCancelledRegistrations.registrations.some((item) => item.id === cancellableRegistration.registration.id));

  const registrations = await request(`/api/activities/${created.activity.id}/registrations`, {}, member.token);
  assert.equal(registrations.registrations.length, 1);
  assert.equal(registrations.registrations[0].phone, undefined);
  assert.equal(registrations.registrations[0].phoneHash, undefined);

  const byRegistrations = await request("/api/activities?all=true&sort=registrations-desc&page=1&pageSize=1", {}, admin.token);
  assert.equal(byRegistrations.activities[0].id, created.activity.id);
  assert.equal(byRegistrations.activities[0].registrationCount, 1);

  const interest = await request(`/api/activities/${created.activity.id}/interests`, {
    method: "POST",
    headers: { "X-YK-Client-Id": `${testClientId}_interest` },
    body: {},
  });
  const duplicateInterest = await request(`/api/activities/${created.activity.id}/interests`, {
    method: "POST",
    headers: { "X-YK-Client-Id": `${testClientId}_interest` },
    body: {},
  });
  assert.equal(interest.existing, false);
  assert.equal(duplicateInterest.existing, true);
  assert.equal(duplicateInterest.interestCount, 1);
  const interestedActivity = await request(`/api/activities/${created.activity.id}`, {
    headers: { "X-YK-Client-Id": `${testClientId}_interest` },
  });
  assert.equal(interestedActivity.activity.interestedByMe, true);
  assert.equal(interestedActivity.activity.interestCount, 1);

  const publicNamesActivity = await createActivity(member.token, {
    title: "报名昵称公示测试活动",
    showRegistrationNames: true,
  });
  await request(`/api/activities/${publicNamesActivity.activity.id}/register`, {
    method: "POST",
    headers: { "X-YK-Client-Id": `${testClientId}_public_name` },
    body: { nickname: "愿意公示昵称" },
  });
  const publicNamesDetail = await request(`/api/activities/${publicNamesActivity.activity.id}`);
  assert.equal(publicNamesDetail.activity.showRegistrationNames, true);
  assert.deepEqual(publicNamesDetail.activity.publicRegistrations.map((item) => item.nickname), ["愿意公示昵称"]);

  const logs = await request("/api/logs?page=1&pageSize=5&q=测试活动", {}, admin.token);
  assert.ok(logs.logs.length >= 1);
  assert.equal(logs.pageInfo.pageSize, 5);
  const submitLogs = await request(`/api/logs?page=1&pageSize=10&action=activity.create_submit&actorId=${member.user.id}&from=${localDateInput()}&to=${localDateInput()}`, {}, admin.token);
  assert.ok(submitLogs.logs.some((log) => log.targetName === "分页和日志测试活动"));
  assert.ok(submitLogs.logs.every((log) => log.action === "activity.create_submit"));
  assert.ok(submitLogs.logs.every((log) => log.actorId === member.user.id));
  const registrationLogs = await request("/api/logs?page=1&pageSize=10&q=报名活动", {}, admin.token);
  assert.ok(registrationLogs.logs.some((log) => log.action === "registration.create"));
  assert.ok(registrationLogs.logs.every((log) => !log.actorPhone));
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
  assert.equal(limited.activity.status, "published");
  const limitedAttempts = await Promise.allSettled([
    request(`/api/activities/${limited.activity.id}/register`, {
      method: "POST",
      headers: { "X-YK-Client-Id": `${testClientId}_limited_a` },
      body: { nickname: "报名甲" },
    }),
    request(`/api/activities/${limited.activity.id}/register`, {
      method: "POST",
      headers: { "X-YK-Client-Id": `${testClientId}_limited_b` },
      body: { nickname: "报名乙" },
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

  const notFormed = await createActivity(member.token, {
    title: "未成团自动取消测试活动",
    capacity: "5",
    minRegistrationEnabled: true,
    minRegistrationCount: "3",
    registrationDeadline: localDateTimeFromNow(-1),
    startsAt: localDateTimeFromNow(10),
  });
  assert.equal(notFormed.activity.minRegistrationEnabled, true);
  assert.equal(notFormed.activity.minRegistrationCount, 3);
  await request("/api/system/auto-end", { method: "POST", body: {} }, admin.token);
  const notFormedClosed = await request(`/api/activities/${notFormed.activity.id}`, {}, member.token);
  assert.equal(notFormedClosed.activity.status, "not_formed_cancelled");

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
  assert.equal(cancellable.activity.status, "published");
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
  assert.equal(expired.activity.status, "published");
  const friendHistory = await createActivity(member.token, {
    title: "客厅朋友历史测试活动",
    sourceType: "friend",
    friendId: friendCreated.friend.id,
    startsAt: localDateTimeFromNow(-29, 18, 30),
  });
  assert.equal(friendHistory.activity.sourceType, "friend");
  const upcoming = await request("/api/activities?view=upcoming&page=1&pageSize=20");
  assert.ok(!upcoming.activities.some((activity) => activity.id === expired.activity.id));
  const history = await request("/api/activities?view=history&page=1&pageSize=20");
  const endedActivity = history.activities.find((activity) => activity.id === expired.activity.id);
  assert.equal(endedActivity?.status, "ended");
  const friendHistoryList = await request("/api/activities?view=history&sourceType=friend&page=1&pageSize=20");
  assert.ok(friendHistoryList.activities.some((activity) => activity.id === friendHistory.activity.id));
  const livingRoomHistoryList = await request("/api/activities?view=history&sourceType=living_room&page=1&pageSize=50");
  assert.ok(livingRoomHistoryList.activities.some((activity) => activity.id === expired.activity.id));
  assert.ok(!livingRoomHistoryList.activities.some((activity) => activity.id === friendHistory.activity.id));
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
  assert.equal(crossDay.activity.status, "published");
  const upcomingAfterCrossDay = await request("/api/activities?view=upcoming&page=1&pageSize=20");
  const ongoing = upcomingAfterCrossDay.activities.find((activity) => activity.id === crossDay.activity.id);
  assert.equal(ongoing?.status, "published");
  assert.equal(ongoing?.endsAt, localDateTimeFromNow(1, 10, 0));

  await assert.rejects(
    request(`/api/activities/${created.activity.id}/feedbacks`, {
      method: "POST",
      headers: { "X-YK-Client-Id": `${testClientId}_feedback_future` },
      body: { favorite: "还没开始就不能写体验" },
    }),
    /400/
  );
  const approvedFeedbackStub = await startAiStub({
    shouldDisplay: true,
    feedbackWeight: 88,
    summary: "反馈具体且适合展示",
    displayReason: "反馈包含具体体验和建设性建议",
    positiveSignals: ["提到饭桌氛围", "有路线建议"],
  });
  try {
    await request("/api/ai/settings", {
      method: "PUT",
      body: {
        enabled: "true",
        provider: "openai-compatible",
        baseUrl: approvedFeedbackStub.baseUrl,
        model: "stub-model",
        apiKey: "stub-key",
        cacheTtlSeconds: 0,
      },
    }, admin.token);
    const approvedFeedback = await request(`/api/activities/${expired.activity.id}/feedbacks`, {
      method: "POST",
      headers: { "X-YK-Client-Id": `${testClientId}_feedback_good` },
      body: {
        favorite: "饭桌很松弛，大家愿意慢慢听人说话。",
        improvement: "下次可以提前发一张从轻轨站走过来的路线图。",
        other: "还会再来。",
      },
    });
    assert.equal(approvedFeedback.existing, false);
    assert.equal(approvedFeedback.feedback.status, "approved");
    assert.equal(approvedFeedback.feedback.feedbackWeight, 88);
    assert.ok(approvedFeedbackStub.calls >= 1);
    const duplicateFeedback = await request(`/api/activities/${expired.activity.id}/feedbacks`, {
      method: "POST",
      headers: { "X-YK-Client-Id": `${testClientId}_feedback_good` },
      body: { favorite: "重复提交不会新增" },
    });
    assert.equal(duplicateFeedback.existing, true);
    assert.equal(duplicateFeedback.feedback.id, approvedFeedback.feedback.id);
    const myFeedbacks = await request("/api/my/feedbacks?page=1&pageSize=10", {
      headers: { "X-YK-Client-Id": `${testClientId}_feedback_good` },
    });
    assert.ok(myFeedbacks.feedbacks.some((feedback) => feedback.id === approvedFeedback.feedback.id));
    const managedFeedbacks = await request(`/api/activities/${expired.activity.id}/feedbacks?manage=true&page=1&pageSize=10`, {}, member.token);
    assert.ok(managedFeedbacks.feedbacks.some((feedback) => feedback.id === approvedFeedback.feedback.id));
    const publicFeedbackDetail = await request(`/api/activities/${expired.activity.id}`);
    assert.ok(publicFeedbackDetail.activity.publicFeedbacks.some((feedback) => feedback.id === approvedFeedback.feedback.id));
    const hiddenFeedbackActivity = await createActivity(member.token, {
      title: "不展示反馈测试活动",
      startsAt: localDateTimeFromNow(-2, 20, 0),
      showFeedbacks: false,
    });
    await request(`/api/activities/${hiddenFeedbackActivity.activity.id}/feedbacks`, {
      method: "POST",
      headers: { "X-YK-Client-Id": `${testClientId}_feedback_hidden` },
      body: { favorite: "这条反馈只给发起人看，不公开展示。" },
    });
    const hiddenFeedbackDetail = await request(`/api/activities/${hiddenFeedbackActivity.activity.id}`);
    assert.equal(hiddenFeedbackDetail.activity.showFeedbacks, false);
    assert.deepEqual(hiddenFeedbackDetail.activity.publicFeedbacks, []);
  } finally {
    await approvedFeedbackStub.close();
  }

  const riskyFeedbackStub = await startAiStub({
    riskScore: 82,
    riskLevel: "high",
    shouldDisplay: false,
    feedbackWeight: 12,
    isSpam: true,
    summary: "反馈含垃圾广告",
    displayReason: "包含广告引流和无关内容，建议管理员审核",
    riskReason: ["垃圾广告"],
  });
  try {
    await request("/api/ai/settings", {
      method: "PUT",
      body: {
        enabled: "true",
        provider: "openai-compatible",
        baseUrl: riskyFeedbackStub.baseUrl,
        model: "stub-model",
        apiKey: "stub-key",
        cacheTtlSeconds: 0,
      },
    }, admin.token);
    const riskyFeedback = await request(`/api/activities/${expired.activity.id}/feedbacks`, {
      method: "POST",
      headers: { "X-YK-Client-Id": `${testClientId}_feedback_bad` },
      body: {
        favorite: "垃圾反馈，加我领投资优惠。",
        improvement: "返利返现。",
      },
    });
    assert.equal(riskyFeedback.feedback.status, "admin_review");
    assert.equal(riskyFeedback.feedback.feedbackWeight, 12);
    const feedbackAdminList = await request("/api/feedbacks?status=admin_review&page=1&pageSize=10&q=垃圾反馈", {}, admin.token);
    assert.ok(feedbackAdminList.feedbacks.some((feedback) => feedback.id === riskyFeedback.feedback.id));
    const adminDashboardWithFeedback = await request("/api/dashboard/admin", {}, admin.token);
    assert.ok(adminDashboardWithFeedback.pending.feedbackTotal >= 1);
    assert.ok(adminDashboardWithFeedback.pending.feedbacks.some((feedback) => feedback.id === riskyFeedback.feedback.id));
    const reviewedFeedback = await request(`/api/feedbacks/${riskyFeedback.feedback.id}/review`, {
      method: "POST",
      body: { action: "approve" },
    }, admin.token);
    assert.equal(reviewedFeedback.feedback.status, "approved");
    const hiddenFeedback = await request(`/api/feedbacks/${riskyFeedback.feedback.id}/review`, {
      method: "POST",
      body: { action: "reject" },
    }, admin.token);
    assert.equal(hiddenFeedback.feedback.status, "rejected");
    const restoredFeedback = await request(`/api/feedbacks/${riskyFeedback.feedback.id}/review`, {
      method: "POST",
      body: { action: "approve" },
    }, admin.token);
    assert.equal(restoredFeedback.feedback.status, "approved");
    const exportResponse = await fetch(`${baseUrl}/api/feedbacks/export?activityId=${encodeURIComponent(expired.activity.id)}`, {
      headers: {
        Authorization: `Bearer ${admin.token}`,
        "X-YK-Client-Id": testClientId,
        "X-YK-Fingerprint": "fp_smoke_test",
      },
    });
    assert.equal(exportResponse.ok, true);
    assert.match(exportResponse.headers.get("content-type") || "", /text\/csv/);
    const exportText = await exportResponse.text();
    assert.match(exportText, /活动标题/);
    assert.match(exportText, /应自动结束的历史活动/);
  } finally {
    await riskyFeedbackStub.close();
    await request("/api/ai/settings", {
      method: "PUT",
      body: { enabled: "false" },
    }, admin.token);
  }

  const pendingFeedbackForReviewTasks = await request(`/api/activities/${expired.activity.id}/feedbacks`, {
    method: "POST",
    headers: { "X-YK-Client-Id": `${testClientId}_feedback_todo` },
    body: {
      favorite: "AI 关闭时这条反馈应进入管理员待办。",
      improvement: "需要管理员确认后再展示。",
    },
  });
  assert.equal(pendingFeedbackForReviewTasks.feedback.status, "admin_review");

  const coverBuffer = fs.readFileSync(path.join(__dirname, "..", "assets", "youkong-gathering.png"));
  const pending = await createActivity(member.token, {
    title: "带封面审核测试活动",
    description: `<h1>待办详情正文图</h1><p>审核时也应该能看到正文图片。</p><img src="${richImage.url}" alt="审核正文图">`,
    forceReview: true,
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
      const ring = switcher?.querySelector(".theme-switch-ring");
      return {
        hasSwitch: Boolean(switcher),
        mode: switcher?.dataset.themeMode,
        svgCount: document.querySelectorAll("[data-theme-switch] svg").length,
        ringWidth: ring ? parseFloat(getComputedStyle(ring).width || "0") : 0,
        svgWidths: [...document.querySelectorAll("[data-theme-switch] svg")].map((svg) => parseFloat(getComputedStyle(svg).width || "0")),
        label: switcher?.getAttribute("aria-label") || "",
      };
    });
    assert.equal(themeSwitchState.hasSwitch, true);
    assert.equal(themeSwitchState.mode, "system");
    assert.equal(themeSwitchState.svgCount, 3);
    assert.ok(themeSwitchState.ringWidth >= 36);
    assert.ok(Math.max(...themeSwitchState.svgWidths) <= 16);
    assert.match(themeSwitchState.label, /跟随系统/);
    await page.locator("[data-theme-switch]").click();
    const themeSwitchAfterClick = await page.evaluate(() => {
      const switcher = document.querySelector("[data-theme-switch]");
      return {
        mode: switcher?.dataset.themeMode,
        label: switcher?.getAttribute("aria-label") || "",
        cycling: switcher?.classList.contains("is-cycling") || false,
      };
    });
    assert.equal(themeSwitchAfterClick.mode, "dark");
    assert.match(themeSwitchAfterClick.label, /黑夜模式/);
    assert.equal(themeSwitchAfterClick.cycling, true);
    await page.goto(`${baseUrl}/me.html`);
    await page.waitForSelector("[data-workspace-cards] .workspace-icon svg[data-octicon='true']");
    await page.waitForFunction(() => document.querySelector("[data-my-pending-section]")?.hidden === true);
    const openWorkspaceMotionState = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("[data-workspace-cards] .workspace-card")];
      const firstCard = cards[0];
      const firstIcon = firstCard?.querySelector(".workspace-icon");
      const firstIconStyle = firstIcon ? getComputedStyle(firstIcon) : null;
      return {
        cardCount: cards.length,
        iconCount: document.querySelectorAll("[data-workspace-cards] .workspace-icon svg[data-octicon='true']").length,
        cueCount: document.querySelectorAll("[data-workspace-cards] .workspace-card-cue svg").length,
        toneCount: document.querySelectorAll("[data-workspace-cards] .workspace-card[data-card-tone]").length,
        labels: cards.map((card) => card.querySelector(".workspace-card-top > span:not(.workspace-icon):not(.workspace-card-cue)")?.textContent.trim()),
        hrefs: cards.map((card) => card.getAttribute("href")),
        iconTransition: firstIconStyle?.transitionProperty || "",
        iconFill: firstCard?.querySelector(".workspace-icon svg") ? getComputedStyle(firstCard.querySelector(".workspace-icon svg")).fill : "",
        pendingHidden: document.querySelector("[data-my-pending-section]")?.hidden,
      };
    });
    assert.equal(openWorkspaceMotionState.cardCount, 4);
    assert.equal(openWorkspaceMotionState.iconCount, openWorkspaceMotionState.cardCount);
    assert.equal(openWorkspaceMotionState.cueCount, openWorkspaceMotionState.cardCount);
    assert.equal(openWorkspaceMotionState.toneCount, openWorkspaceMotionState.cardCount);
    assert.deepEqual(openWorkspaceMotionState.labels, ["我的报名", "我的反馈", "发起活动", "我发起的活动"]);
    assert.deepEqual(openWorkspaceMotionState.hrefs, ["#my-registrations", "#my-feedbacks", "activity-editor.html", "my-activities.html"]);
    assert.match(openWorkspaceMotionState.iconTransition, /transform/);
    assert.notEqual(openWorkspaceMotionState.iconFill, "none");
    assert.equal(openWorkspaceMotionState.pendingHidden, true);
    await page.goto(`${baseUrl}/login.html`);
    await page.getByLabel("手机号").fill("18800000000");
    await page.getByRole("button", { name: "进入有空" }).click();
    await page.waitForURL("**/admin.html");
    await page.waitForSelector(".admin-module-group .workspace-icon svg");
    const adminMotionState = await page.evaluate(() => {
      const icon = document.querySelector(".admin-module-group .workspace-icon");
      const svg = icon?.querySelector("svg");
      const group = document.querySelector(".admin-module-groups");
      return {
        groupCount: document.querySelectorAll(".admin-module-group").length,
        iconCount: document.querySelectorAll(".admin-module-group .workspace-icon svg").length,
        cueCount: document.querySelectorAll(".admin-module-group .workspace-card-cue svg").length,
        toneCount: document.querySelectorAll(".admin-module-group .workspace-card[data-card-tone]").length,
        octiconCount: document.querySelectorAll(".admin-module-group .workspace-icon svg[data-octicon='true']").length,
        hasGroupedSurface: Boolean(group),
        iconTransition: getComputedStyle(icon).transitionProperty,
        svgFill: getComputedStyle(svg).fill,
      };
    });
    assert.ok(adminMotionState.groupCount >= 5);
    assert.ok(adminMotionState.iconCount >= 10);
    assert.equal(adminMotionState.octiconCount, adminMotionState.iconCount);
    assert.equal(adminMotionState.cueCount, adminMotionState.iconCount);
    assert.equal(adminMotionState.toneCount, adminMotionState.iconCount);
    assert.equal(adminMotionState.hasGroupedSurface, true);
    assert.match(adminMotionState.iconTransition, /transform/);
    assert.notEqual(adminMotionState.svgFill, "none");
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
    await assertNoHorizontalOverflow(page, `${baseUrl}/activity.html?id=${created.activity.id}`);
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
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-reports.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-friends.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-feedbacks.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-safety.html`);
    await page.waitForSelector("[data-rule-id] textarea[name='params']");
    const safetyTextareaState = await page.evaluate(() => {
      const description = document.querySelector("[data-rule-id] textarea[name='description']");
      const params = document.querySelector("[data-rule-id] textarea[name='params']");
      const descriptionStyle = getComputedStyle(description);
      const paramsStyle = getComputedStyle(params);
      return {
        descriptionFont: descriptionStyle.fontFamily,
        paramsFont: paramsStyle.fontFamily,
        descriptionHeight: Math.round(description.getBoundingClientRect().height),
        paramsHeight: Math.round(params.getBoundingClientRect().height),
        descriptionRadius: descriptionStyle.borderRadius,
        paramsRadius: paramsStyle.borderRadius,
      };
    });
    assert.equal(safetyTextareaState.paramsFont, safetyTextareaState.descriptionFont);
    assert.equal(safetyTextareaState.paramsHeight, safetyTextareaState.descriptionHeight);
    assert.equal(safetyTextareaState.paramsRadius, safetyTextareaState.descriptionRadius);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-ai.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-governance.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-trust-policy.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-badges.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-badge-policy.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-trust.html`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/admin-activity-confidence.html?id=${created.activity.id}`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/registrations.html?id=${created.activity.id}`);
    await assertNoHorizontalOverflow(page, `${baseUrl}/activity-feedback.html?id=${expired.activity.id}`);
    const feedbackQrDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载反馈二维码" }).click();
    const feedbackQrFile = await feedbackQrDownload;
    assert.match(feedbackQrFile.suggestedFilename(), /反馈二维码\.jpg$/);
    await assertNoHorizontalOverflow(page, `${baseUrl}/feedback.html?id=${expired.activity.id}`);
    await page.goto(`${baseUrl}/feedback.html?id=${expired.activity.id}`);
    await page.waitForLoadState("networkidle");
    const feedbackFormState = await page.evaluate(() => ({
      hasFavorite: Boolean(document.querySelector('textarea[name="favorite"]')),
      hasImprovement: Boolean(document.querySelector('textarea[name="improvement"]')),
      hasOther: Boolean(document.querySelector('textarea[name="other"]')),
      hasName: Boolean(document.querySelector('input[name="nickname"], input[name="name"]')),
      hasRating: Boolean(document.querySelector('input[name="rating"], select[name="rating"], [data-rating]')),
    }));
    assert.deepEqual(feedbackFormState, {
      hasFavorite: true,
      hasImprovement: true,
      hasOther: true,
      hasName: false,
      hasRating: false,
    });

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
      hasSourceType: Boolean(document.querySelector("[data-source-type-toggle]")),
      hasFriendField: Boolean(document.querySelector("[data-friend-field]")),
      hasFeedbackDisplay: Boolean(document.querySelector('select[name="showFeedbacks"]')),
    }));
    assert.equal(editorState.hasEditor, true);
    assert.ok(editorState.toolCount >= 8);
    assert.equal(editorState.hasH1Tool, true);
    assert.equal(editorState.hasTemplateSelect, true);
    assert.equal(editorState.hasContactToggle, true);
    assert.equal(editorState.contactHidden, true);
    assert.equal(editorState.hasSourceType, true);
    assert.equal(editorState.hasFriendField, true);
    assert.equal(editorState.hasFeedbackDisplay, true);
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
    await page.evaluate(() => window.youkongTheme?.setMode("light"));
	    const shareState = await page.evaluate(() => ({
	      poster: Boolean(document.querySelector("[data-download-poster]")),
	      posterText: document.querySelector("[data-download-poster]")?.textContent.trim() || "",
	      copy: Boolean(document.querySelector("[data-copy-registration-link]")),
	      calendar: Boolean(document.querySelector("[data-download-calendar]")),
	      phoneField: Boolean(document.querySelector('[data-register-form] input[name="phone"]')),
	      nicknameField: Boolean(document.querySelector('[data-register-form] input[name="nickname"]')),
	      richHeading: Boolean(document.querySelector(".article-content h1")),
	      richImage: Boolean(document.querySelector(".article-content img")),
	      contact: document.querySelector(".initiator-contact")?.textContent || "",
      contactMarginTop: parseFloat(getComputedStyle(document.querySelector(".activity-hero .initiator-contact")).marginTop || "0"),
      detailLineColor: getComputedStyle(document.querySelector(".activity-hero > div:first-child > p")).color,
      detailLineWeight: Number(getComputedStyle(document.querySelector(".activity-hero > div:first-child > p")).fontWeight),
	    }));
	    assert.equal(shareState.poster, true);
	    assert.equal(shareState.posterText, "下载活动邀请函");
	    assert.equal(shareState.copy, true);
	    assert.equal(shareState.calendar, true);
	    assert.equal(shareState.phoneField, false);
	    assert.equal(shareState.nicknameField, true);
	    assert.equal(shareState.richHeading, true);
    assert.equal(shareState.richImage, true);
    assert.match(shareState.contact, /13300002222/);
    assert.ok(shareState.contactMarginTop >= 24);
    assert.equal(shareState.detailLineColor, "rgb(43, 48, 43)");
    assert.ok(shareState.detailLineWeight >= 650);

    await page.goto(`${baseUrl}/success.html?activity=${created.activity.id}&registration=${registration.registration.id}&token=${encodeURIComponent(duplicate.accessToken)}`);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.youkongTheme?.setMode("light"));
    const successPosterState = await page.evaluate(() => ({
      poster: Boolean(document.querySelector("[data-download-poster]")),
      activityShareLoaded: Boolean(window.youkongActivityShare),
      summaryColor: getComputedStyle(document.querySelector(".success-card > p:not(.eyebrow)")).color,
      summaryWeight: Number(getComputedStyle(document.querySelector(".success-card > p:not(.eyebrow)")).fontWeight),
      labelColor: getComputedStyle(document.querySelector(".success-grid span")).color,
    }));
    assert.deepEqual(successPosterState, {
      poster: true,
      activityShareLoaded: true,
      summaryColor: "rgb(43, 48, 43)",
      summaryWeight: 620,
      labelColor: "rgb(63, 73, 63)",
    });
    const csvEscaped = await page.evaluate(() => window.escapeCsv("=HYPERLINK(\"https://example.com\")"));
    assert.equal(csvEscaped, "\"'=HYPERLINK(\"\"https://example.com\"\")\"");
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
	      },
	    }));
	    assert.deepEqual(posterTextPreview, {
	      title: "有空放映丨鹳鸟踟蹰",
	      initiator: "发起人甲",
	      invitee: "报名者",
	      address: "有空客厅",
	      date: "2026年7月12日20:00-2026年7月12日23:00",
      qrLabel: "活动二维码",
      showUrlText: false,
	    });
	    assert.doesNotMatch(JSON.stringify(posterTextPreview), /【|】/);
	    const posterDownload = page.waitForEvent("download");
	    await page.getByRole("button", { name: "下载活动邀请函" }).click();
	    const posterFile = await posterDownload;
	    assert.match(posterFile.suggestedFilename(), /活动邀请函\.jpg$/);

    await page.goto(`${baseUrl}/review-tasks.html`);
    await page.waitForLoadState("networkidle");
    const reviewState = await page.evaluate(() => ({
      value: document.querySelector("[data-review-action]")?.value,
      text: document.querySelector("[data-review-action] option:checked")?.textContent.trim(),
      coverCount: document.querySelectorAll(".review-cover").length,
      richImageCount: document.querySelectorAll(".review-detail .article-content img").length,
      feedbackTaskCount: document.querySelectorAll(".feedback-task-row").length,
      feedbackTaskActions: Array.from(document.querySelectorAll(".feedback-task-row .row-actions .button")).map((button) => button.textContent.trim()),
    }));
    assert.equal(reviewState.value, "");
    assert.equal(reviewState.text, "请选择");
    assert.equal(reviewState.coverCount, 1);
    assert.ok(reviewState.richImageCount >= 1);
    assert.ok(reviewState.feedbackTaskCount >= 1);
    assert.ok(reviewState.feedbackTaskActions.includes("展示"));
    assert.ok(reviewState.feedbackTaskActions.includes("不展示"));
  } finally {
    if (context) await context.close();
    await browser.close();
  }
});
