const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const output = path.join(root, "dist");
const files = [
  "index.html",
  "whitepaper.html",
  "activities.html",
  "participate.html",
  "donate.html",
  "about.html",
  "login.html",
  "me.html",
  "activity-editor.html",
  "my-activities.html",
  "registrations.html",
  "review-tasks.html",
  "admin.html",
  "admin-activities.html",
  "admin-members.html",
  "admin-modules.html",
  "admin-templates.html",
  "admin-logs.html",
  "activity.html",
  "success.html",
  "styles.css",
  "theme.js",
  "script.js",
  "app.js",
];
const directories = ["assets"];

function copyFile(relativePath) {
  const from = path.join(root, relativePath);
  const to = path.join(output, relativePath);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDirectory(relativePath) {
  const from = path.join(root, relativePath);
  const to = path.join(output, relativePath);
  fs.cpSync(from, to, { recursive: true });
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

files.forEach(copyFile);
directories.forEach(copyDirectory);

console.log(`静态站点已生成：${output}`);
