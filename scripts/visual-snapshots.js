const { once } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { chromium } = require("playwright");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youkong-visual-"));
process.env.STORE_DRIVER = "json";
process.env.YK_DB_FILE = path.join(tmpDir, "youkong-db.json");
process.env.YKADMIN_NICKNAME = "有空管理员";
process.env.YKADMIN_PHONE = "18800000000";

const { createApp, store } = require("../lib/app");

const outputDir = path.join(__dirname, "..", "test-results", "visual");

async function seedReviewTask() {
  const now = new Date().toISOString();
  const futureDate = (days, hour) => {
    const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
  };
  await store.insert("users", {
    id: "visual_member",
    nickname: "视觉成员",
    phone: "13300008888",
    role: "member",
    roles: ["member"],
    createdAt: now,
    updatedAt: now,
  });
  await store.insert("users", {
    id: "visual_collaborator",
    nickname: "视觉协作员",
    phone: "13300009999",
    role: "collaborator",
    roles: ["collaborator"],
    createdAt: now,
    updatedAt: now,
  });
  for (const [index, title] of ["江边放映和聊天", "周末一起做饭", "山城公共议题小会"].entries()) {
    await store.insert("activities", {
      id: `visual_home_activity_${index + 1}`,
      title,
      moduleId: index === 1 ? "canteen" : "screening",
      collaboratorId: "visual_collaborator",
      initiator: "视觉成员",
      showInitiatorContact: false,
      initiatorContact: "",
      startsAt: futureDate(7 + index, 19 + index),
      endsAt: "",
      location: "有空客厅",
      capacity: 36,
      description: "<p>这条临时数据用于截图检查首页近期活动布局。</p>",
      coverUrl: "",
      coverFileId: "",
      registrationCount: index,
      status: "published",
      reviewStep: "",
      reviewLogs: [],
      createdBy: "visual_member",
      createdAt: now,
      updatedAt: now,
    });
  }
  await store.insert("activities", {
    id: "visual_review_activity",
    title: "视觉检查用审核活动",
    moduleId: "screening",
    collaboratorId: "visual_collaborator",
    initiator: "视觉成员",
    showInitiatorContact: false,
    initiatorContact: "",
    startsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    endsAt: "",
    location: "有空客厅",
    capacity: 24,
    description: "<h1>审核待办视觉检查</h1><p>这条临时数据用于截图检查 PC 端审核意见、备注和提交按钮是否对齐。</p>",
    coverUrl: "",
    coverFileId: "",
    registrationCount: 0,
    status: "admin_review",
    reviewStep: "admin",
    reviewLogs: [],
    createdBy: "visual_member",
    createdAt: now,
    updatedAt: now,
  });
}

async function loginAsAdmin(page, baseUrl) {
  await page.goto(`${baseUrl}/login.html`, { waitUntil: "networkidle" });
  await page.getByLabel("手机号").fill("18800000000");
  await page.getByRole("button", { name: "进入有空" }).click();
  await page.waitForURL("**/admin.html");
  await page.waitForLoadState("networkidle");
}

async function screenshot(page, baseUrl, pathname, filename) {
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputDir, filename), fullPage: true });
}

async function main() {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  await store.ensureSeed();
  await seedReviewTask();

  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await screenshot(desktop, baseUrl, "/index.html", "desktop-home.png");
    await screenshot(desktop, baseUrl, "/whitepaper.html", "desktop-whitepaper.png");
    await screenshot(desktop, baseUrl, "/activities.html", "desktop-activities.png");
    await screenshot(desktop, baseUrl, "/about.html", "desktop-about.png");
    await screenshot(desktop, baseUrl, "/login.html", "desktop-login.png");
    await loginAsAdmin(desktop, baseUrl);
    await screenshot(desktop, baseUrl, "/me.html", "desktop-me.png");
    await screenshot(desktop, baseUrl, "/admin.html", "desktop-admin.png");
    await screenshot(desktop, baseUrl, "/review-tasks.html", "desktop-review-tasks.png");
    await screenshot(desktop, baseUrl, "/activity-editor.html", "desktop-activity-editor.png");
    await screenshot(desktop, baseUrl, "/admin-templates.html", "desktop-admin-templates.png");
    await screenshot(desktop, baseUrl, "/admin-template-editor.html", "desktop-admin-template-editor.png");
    await desktop.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await screenshot(mobile, baseUrl, "/index.html", "mobile-home.png");
    await screenshot(mobile, baseUrl, "/whitepaper.html", "mobile-whitepaper.png");
    await screenshot(mobile, baseUrl, "/activities.html", "mobile-activities.png");
    await screenshot(mobile, baseUrl, "/about.html", "mobile-about.png");
    await loginAsAdmin(mobile, baseUrl);
    await screenshot(mobile, baseUrl, "/me.html", "mobile-me.png");
    await screenshot(mobile, baseUrl, "/admin-activities.html", "mobile-admin-activities.png");
    await screenshot(mobile, baseUrl, "/review-tasks.html", "mobile-review-tasks.png");
    await screenshot(mobile, baseUrl, "/activity-editor.html", "mobile-activity-editor.png");
    await screenshot(mobile, baseUrl, "/admin-templates.html", "mobile-admin-templates.png");
    await screenshot(mobile, baseUrl, "/admin-template-editor.html", "mobile-admin-template-editor.png");
    await mobile.close();
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`Visual snapshots saved to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
});
