const { once } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { chromium } = require("playwright");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youkong-visual-"));
process.env.STORE_DRIVER = "json";
process.env.YK_DB_FILE = path.join(tmpDir, "youkong-db.json");
process.env.YKADMIN_NICKNAME = "有空管理员";
process.env.YKADMIN_PHONE = "13377779999";

const { createApp, store } = require("../lib/app");

const outputDir = path.join(__dirname, "..", "test-results", "visual");

async function loginAsAdmin(page, baseUrl) {
  await page.goto(`${baseUrl}/login.html`, { waitUntil: "networkidle" });
  await page.getByLabel("手机号").fill("13377779999");
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

  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await screenshot(desktop, baseUrl, "/index.html", "desktop-home.png");
    await screenshot(desktop, baseUrl, "/login.html", "desktop-login.png");
    await loginAsAdmin(desktop, baseUrl);
    await screenshot(desktop, baseUrl, "/admin.html", "desktop-admin.png");
    await screenshot(desktop, baseUrl, "/activity-editor.html", "desktop-activity-editor.png");
    await screenshot(desktop, baseUrl, "/admin-templates.html", "desktop-admin-templates.png");
    await screenshot(desktop, baseUrl, "/admin-template-editor.html", "desktop-admin-template-editor.png");
    await desktop.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await screenshot(mobile, baseUrl, "/index.html", "mobile-home.png");
    await loginAsAdmin(mobile, baseUrl);
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
