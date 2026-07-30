const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const { COLLECTIONS, createStore } = require("../lib/store");

const DEFAULT_COLLECTIONS = COLLECTIONS.filter((collection) => collection !== "sessions");
const DEFAULT_OUTPUT_DIR = path.join(__dirname, "..", "output", "backups");
const PAGE_SIZE = 100;

function parseArgs(argv) {
  const options = {
    includeSessions: false,
    includeSecrets: false,
    output: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--include-sessions") {
      options.includeSessions = true;
    } else if (arg === "--include-secrets") {
      options.includeSecrets = true;
    } else if (arg === "--out") {
      options.output = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return options;
}

function usage() {
  return [
    "Usage: node scripts/backup-data.js [--out <file-or-dir>] [--include-sessions] [--include-secrets]",
    "",
    "Examples:",
    "  npm run backup:data",
    "  STORE_DRIVER=cloudbase npm run backup:data",
    "  node scripts/backup-data.js --out output/backups/prod.json",
    "",
    "By default, sessions are excluded and sensitive fields are redacted.",
    "Use --include-secrets only for encrypted offline incident response archives.",
  ].join("\n");
}

function maskPhoneLike(value = "") {
  const text = String(value || "");
  const digits = text.replace(/\D/g, "");
  if (digits.length < 8) return text ? "[redacted]" : "";
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

function shouldRedactKey(key = "") {
  const normalized = String(key || "").toLowerCase();
  return normalized.includes("apikey")
    || normalized.includes("token")
    || normalized.includes("secret")
    || normalized.includes("salt")
    || normalized.includes("authorization")
    || normalized.includes("password")
    || normalized === "phonehash"
    || normalized.endsWith("tokenhash")
    || normalized.endsWith("keyencrypted");
}

function redactValue(key, value) {
  const normalized = String(key || "").toLowerCase();
  if (shouldRedactKey(key)) return value ? "[redacted]" : value;
  if (normalized === "phone" || normalized.endsWith("phone")) return maskPhoneLike(value);
  if (["initiatorcontact", "contactinfo"].includes(normalized)) return value ? "[redacted]" : value;
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
  if (value && typeof value === "object") return redactSecrets(value);
  return value;
}

function redactSecrets(record = {}) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, redactValue(key, value)]));
}

function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function resolveOutputPath(output = "") {
  if (!output) {
    return path.join(DEFAULT_OUTPUT_DIR, `youkong-backup-${timestampForFilename()}.json`);
  }

  const resolved = path.resolve(output);
  if (path.extname(resolved).toLowerCase() === ".json") return resolved;
  return path.join(resolved, `youkong-backup-${timestampForFilename()}.json`);
}

async function readCollection(store, collection) {
  if (typeof store.query !== "function") {
    return store.all(collection);
  }

  const records = [];
  for (let page = 1; page <= 10000; page += 1) {
    const { data, pageInfo } = await store.query(collection, {
      page,
      pageSize: PAGE_SIZE,
      maxPageSize: PAGE_SIZE,
    });
    records.push(...data);
    if (!pageInfo || !pageInfo.hasMore) break;
  }
  return records;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const store = createStore();
  const collections = options.includeSessions ? COLLECTIONS : DEFAULT_COLLECTIONS;
  const data = {};
  const counts = {};

  for (const collection of collections) {
    const records = await readCollection(store, collection);
    data[collection] = options.includeSecrets ? records : records.map(redactSecrets);
    counts[collection] = records.length;
  }

  const payload = {
    meta: {
      createdAt: new Date().toISOString(),
      storeDriver: process.env.STORE_DRIVER || "json",
      cloudbaseEnvId: process.env.CLOUDBASE_ENV_ID || process.env.CBR_ENV_ID || process.env.TCB_ENV_ID || "",
      includedCollections: collections,
      excludedCollections: COLLECTIONS.filter((collection) => !collections.includes(collection)),
      counts,
    },
    data,
  };

  const outputPath = resolveOutputPath(options.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`数据备份已生成：${outputPath}`);
  console.log(JSON.stringify({ counts, includedCollections: collections }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  redactSecrets,
  redactValue,
  shouldRedactKey,
};
