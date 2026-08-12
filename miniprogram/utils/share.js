const APP_NAME = "有空客厅";

function enableShareMenu() {
  if (!wx.showShareMenu) return;
  wx.showShareMenu({
    withShareTicket: true,
    menus: ["shareAppMessage", "shareTimeline"],
  });
}

function activityPath(activityOrId = "") {
  const id = typeof activityOrId === "string" ? activityOrId : activityOrId.id;
  return `/pages/activity-detail/activity-detail?id=${encodeURIComponent(id || "")}`;
}

function activityShare(activity = {}) {
  return {
    title: activity.title || "有空客厅活动",
    path: activityPath(activity),
  };
}

function activityShareFromEvent(event = {}) {
  const dataset = event.target?.dataset || {};
  if (!dataset.activityId) return null;
  return {
    title: dataset.activityTitle || "有空客厅活动",
    path: activityPath(dataset.activityId),
  };
}

function roomLogPath(roomLogOrId = "") {
  const id = typeof roomLogOrId === "string" ? roomLogOrId : roomLogOrId.id;
  return id
    ? `/pages/room-logs/room-logs?id=${encodeURIComponent(id)}`
    : "/pages/room-logs/room-logs";
}

function roomLogShare(roomStatusOrLog = {}) {
  const log = roomStatusOrLog.currentLog || roomStatusOrLog;
  const title = roomStatusOrLog.title || (log.statusLabel ? `有空客厅${log.statusLabel}` : "有空客厅开门值班记录");
  return {
    title,
    path: roomLogPath(log && log.id ? log.id : ""),
  };
}

function defaultShare(path = "/pages/home/home") {
  return {
    title: `${APP_NAME}：一个在重庆生长的弱中心化社区`,
    path,
  };
}

function defaultTimeline(query = "") {
  return {
    title: `${APP_NAME}：一个在重庆生长的弱中心化社区`,
    query,
  };
}

module.exports = {
  APP_NAME,
  enableShareMenu,
  activityPath,
  activityShare,
  activityShareFromEvent,
  roomLogPath,
  roomLogShare,
  defaultShare,
  defaultTimeline,
};
