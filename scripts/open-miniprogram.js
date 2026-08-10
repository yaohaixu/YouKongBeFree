const { spawnSync } = require("child_process");
const path = require("path");

const cliPath = "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";
const projectPath = path.resolve(__dirname, "..", "miniprogram");

const result = spawnSync(cliPath, ["open", "--project", projectPath, "--lang", "zh"], {
  stdio: "inherit",
});

process.exit(result.status || 0);
