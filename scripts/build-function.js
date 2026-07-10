const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const output = path.join(root, "tmp", "cloudfunctions", "youkongApi");

const packageJson = {
  name: "youkong-api-function",
  version: "0.9.0",
  private: true,
  main: "index.js",
  scripts: {
    start: "node index.js",
  },
  dependencies: {
    "@cloudbase/node-sdk": "^3.18.3",
    "cookie-parser": "^1.4.7",
    dotenv: "^17.4.2",
    express: "^4.21.2",
    multer: "^2.0.2",
    "serverless-http": "^4.0.0",
    ws: "^8.21.0",
  },
};

const indexJs = `process.env.STORE_DRIVER = process.env.STORE_DRIVER || "cloudbase";
process.env.YKADMIN_NICKNAME = process.env.YKADMIN_NICKNAME || "有空管理员";
process.env.YKADMIN_PHONE = process.env.YKADMIN_PHONE || "13377779999";

const serverless = require("serverless-http");
const { createApp, store, sweepExpiredActivities } = require("./lib/app");

const app = createApp({
  serveStatic: false,
});
const handler = serverless(app);
let ready;

exports.main = async (event, context) => {
  ready = ready || store.ensureSeed();
  await ready;
  await sweepExpiredActivities({ reason: "cloudbase-request" });
  return handler(event, context);
};
`;

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(path.join(root, "lib"), path.join(output, "lib"), { recursive: true });
fs.writeFileSync(path.join(output, "package.json"), JSON.stringify(packageJson, null, 2));
fs.writeFileSync(path.join(output, "index.js"), indexJs);

console.log(`云函数包已生成：${output}`);
