const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const requiredFiles = [
  "dist/index.html",
  "dist/app.js",
  "dist/styles.css",
  "dist/assets/js/rich-editor.js",
  "dist/assets/js/activity-share.js",
  "tmp/cloudfunctions/youkongApi/index.js",
  "tmp/cloudfunctions/youkongApi/lib/app.js",
  "tmp/cloudfunctions/youkongApi/lib/store.js",
  "tmp/cloudfunctions/youkongApi/lib/rich-text.js",
  "tmp/cloudfunctions/youkongApi/lib/routes/logs.js",
  "tmp/cloudfunctions/youkongApi/package.json",
];
const forbiddenPatterns = [
  /^dist\/\.env/,
  /^dist\/node_modules\//,
  /^tmp\/cloudfunctions\/youkongApi\/\.env/,
  /^tmp\/cloudfunctions\/youkongApi\/data\/.*\.json/,
];

function walk(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    return entry.isDirectory() ? walk(relativePath) : [relativePath.replaceAll(path.sep, "/")];
  });
}

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`CloudBase dry-run failed. Missing files:\n${missing.map((file) => `- ${file}`).join("\n")}`);
  process.exit(1);
}

const packagedFiles = [...walk("dist"), ...walk("tmp/cloudfunctions/youkongApi")];
const forbidden = packagedFiles.filter((file) => forbiddenPatterns.some((pattern) => pattern.test(file)));
if (forbidden.length) {
  console.error(`CloudBase dry-run failed. Forbidden files:\n${forbidden.map((file) => `- ${file}`).join("\n")}`);
  process.exit(1);
}

console.log(`CloudBase dry-run passed. Checked ${requiredFiles.length} required files and ${packagedFiles.length} packaged files.`);
