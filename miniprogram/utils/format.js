function pad(value) {
  return String(value).padStart(2, "0");
}

function formatActivityTime(startsAt, endsAt) {
  if (!startsAt) return "时间待定";
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return startsAt;
  const startText = `${pad(start.getMonth() + 1)}/${pad(start.getDate())} ${pad(start.getHours())}:${pad(start.getMinutes())}`;
  if (!endsAt) return startText;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return startText;
  return `${startText} - ${pad(end.getMonth() + 1)}/${pad(end.getDate())} ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function responsiveRichTextHtml(value = "") {
  return String(value || "").replace(/<img\b([^>]*)>/gi, (_match, attributes = "") => {
    const cleanedAttributes = String(attributes || "")
      .replace(/\sstyle\s*=\s*"[^"]*"/gi, "")
      .replace(/\sstyle\s*=\s*'[^']*'/gi, "")
      .replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s\/\s*$/g, "")
      .trim();
    const spacing = cleanedAttributes ? " " : "";
    return `<img${spacing}${cleanedAttributes} style="max-width:100%;width:100%;height:auto;display:block;margin:8px 0;border-radius:12px;" width="100%">`;
  });
}

function activitySummary(activity = {}) {
  return stripHtml(activity.summary || activity.description || "").slice(0, 72);
}

function canRegisterActivity(activity = {}) {
  return activity.status === "published" && !activity.registrationDeadlinePassed;
}

function registrationNotice(activity = {}) {
  if (activity.status === "full") return "这个活动名额已经满了。";
  if (activity.status === "not_formed_cancelled") return "这个活动没有达到最低报名人数，已自动取消。";
  if (activity.status === "ended") return "这个活动已经结束。";
  if (activity.status === "cancelled") return "这个活动已经取消。";
  if (activity.registrationDeadlinePassed) return "这个活动报名已经截止。";
  if (activity.status && activity.status !== "published") {
    return `这个活动当前是「${activity.statusLabel || activity.status}」状态，公开发布后才可以报名。`;
  }
  return "";
}

function formationText(activity = {}) {
  const min = Number(activity.minRegistrationCount || 0);
  if (!activity.minRegistrationEnabled || !min) return "";
  const registered = Number(activity.registrationCount || 0);
  const deadline = activity.registrationDeadline ? formatDateTime(activity.registrationDeadline) : "活动开始前";
  return `最低 ${min} 人成团 · 当前 ${registered} 人报名 · 最后报名 ${deadline}`;
}

function toActivityView(activity = {}) {
  const displayFormation = formationText(activity);
  const canRegister = canRegisterActivity(activity);
  const displaySeries = activity.seriesName || (activity.series && activity.series.name) || "";
  return {
    ...activity,
    displayTime: formatActivityTime(activity.startsAt, activity.endsAt),
    displayRegistrationDeadline: formatDateTime(activity.registrationDeadline),
    displayFormation,
    displaySeries,
    canRegister,
    registrationNotice: registrationNotice(activity),
    displaySummary: activitySummary(activity),
    displaySource: activity.sourceName || activity.sourceLabel || activity.moduleName || "有空客厅"
  };
}

function toRegistrationView(registration = {}) {
  const activity = registration.activity || {};
  return {
    ...registration,
    activity: {
      ...activity,
      displayTime: formatActivityTime(activity.startsAt, activity.endsAt)
    },
    displayCreatedAt: formatDateTime(registration.createdAt)
  };
}

function feedbackText(feedback = {}) {
  return feedback.favorite || feedback.improvement || feedback.other || "已提交匿名反馈";
}

function toFeedbackView(feedback = {}) {
  const activity = feedback.activity || {};
  return {
    ...feedback,
    displayText: feedbackText(feedback),
    displayCreatedAt: formatDateTime(feedback.createdAt),
    activity: activity.id ? toActivityView(activity) : null,
    activityDisplayTime: formatActivityTime(feedback.activityStartsAt, feedback.activityEndsAt)
  };
}

module.exports = {
  formatActivityTime,
  formatDateTime,
  stripHtml,
  responsiveRichTextHtml,
  activitySummary,
  toActivityView,
  toRegistrationView,
  toFeedbackView,
  canRegisterActivity,
  registrationNotice
};
