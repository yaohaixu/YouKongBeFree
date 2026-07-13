"use strict";

function registerLogRoutes(app, deps) {
  const {
    asyncRoute,
    cleanText,
    logFilters,
    pageQueryOptions,
    pruneOldLogs,
    requireAdmin,
    store,
  } = deps;

  app.get("/api/logs", requireAdmin, asyncRoute(async (req, res) => {
    await pruneOldLogs({ force: true });
    const keyword = cleanText(req.query.q).toLowerCase();
    const { data, pageInfo } = await store.query("logs", {
      ...pageQueryOptions(req.query),
      filters: logFilters(req.query),
      keyword,
      keywordFields: [
        "action",
        "actionLabel",
        "actorName",
        "actorPhone",
        "actorRole",
        "targetType",
        "targetId",
        "targetName",
        "detail",
      ],
      sort: [{ field: "createdAt", direction: "desc" }],
    });
    res.json({ logs: data, pageInfo });
  }));
}

module.exports = {
  registerLogRoutes,
};
