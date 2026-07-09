require("dotenv").config();

const { startServer } = require("./lib/app");

startServer().catch((error) => {
  console.error("启动失败：", error);
  process.exit(1);
});
