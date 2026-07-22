"use strict";

async function withRetry(handler, options = {}) {
  const retryCount = Math.max(0, Number(options.retryCount || 0));
  const delayMs = Math.max(50, Number(options.delayMs || 250));
  let lastError = null;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await handler(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retryCount) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

module.exports = {
  withRetry,
};
