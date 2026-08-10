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
  defaultShare,
  defaultTimeline,
};
