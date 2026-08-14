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
  if (activity.hasEnded) return false;
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

function roomLogStatusTone(status = "") {
  return {
    opened: "open",
    scheduled: "upcoming",
    closed: "closed",
    cancelled: "empty",
    expired_cancelled: "empty",
    none: "empty",
  }[status] || "empty";
}

function roomLogStatusLabel(status = "") {
  return {
    opened: "已开门",
    scheduled: "即将开门",
    closed: "已关门",
    cancelled: "已取消",
    expired_cancelled: "过期未开门",
    none: "今日暂无安排",
  }[status] || "即将开门";
}

function roomLogDateLabel(value = "") {
  if (!value) return "";
  const text = String(value || "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return text;
  return `${match[2]}/${match[3]}`;
}

function roomLogTime(value = "") {
  const match = String(value || "").match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function roomLogPlainNote(log = {}) {
  return stripHtml(log.openNote || log.nightNote || "");
}

function reviewReasonText(status = "", aiStatus = "", aiReason = "", kind = "内容") {
  const reason = stripHtml(aiReason || "");
  if (status === "admin_review") {
    if (reason) return `${kind}待审核：${reason}`;
    if (aiStatus === "completed") return `${kind}待审核：AI 建议管理员确认后再展示。`;
    return `${kind}待审核：AI 暂时没有给出通过结果，等待管理员确认。`;
  }
  if (status === "rejected") {
    return reason ? `${kind}不展示：${reason}` : `${kind}不展示：管理员或 AI 判断不适合公开。`;
  }
  return "";
}

function roomStatusView(status = {}) {
  const currentLog = status.currentLog || {};
  const state = status.status || "none";
  const isActivityEvent = currentLog.eventType === "activity";
  const primaryAction = isActivityEvent && currentLog.activityId
    ? { type: "activity", label: "查看活动", icon: "calendar" }
    : ["opened", "closed"].includes(state) && currentLog.id
      ? { type: "note", label: "写夜记", icon: "feedback" }
      : { type: "manage", label: "有空开门", icon: "door" };
  return {
    ...status,
    status: state,
    tone: status.tone || roomLogStatusTone(state),
    statusLabel: status.statusLabel || roomLogStatusLabel(state),
    title: status.title || "今日暂无开门安排",
    text: stripHtml(status.text || ""),
    currentLog: currentLog.id ? toRoomLogView(currentLog) : {},
    hasLog: Boolean(currentLog.id),
    primaryAction,
  };
}

function toRoomLogView(log = {}) {
  const openNote = responsiveRichTextHtml(log.openNote || "");
  const nightNote = responsiveRichTextHtml(log.nightNote || "");
  const status = log.status || "scheduled";
  const eventType = log.eventType || "duty";
  const titleTime = status === "opened"
    ? roomLogTime(log.openedAt || log.scheduledOpenAt)
    : status === "closed"
      ? roomLogTime(log.closedAt || log.scheduledCloseAt)
      : roomLogTime(log.scheduledOpenAt);
  const nightNotes = (log.nightNotes || []).map((note) => ({
    ...note,
    content: responsiveRichTextHtml(note.content || ""),
    avatarUrl: note.authorProfile && note.authorProfile.avatarUrl ? note.authorProfile.avatarUrl : "",
    avatarInitial: String(note.authorName || "有").slice(0, 1),
    reviewText: reviewReasonText(note.status, note.aiStatus, note.aiReason, "夜记"),
    displayCreatedAt: formatDateTime(note.updatedAt || note.createdAt)
  }));
  return {
    ...log,
    eventType,
    isActivityEvent: eventType === "activity",
    status,
    tone: roomLogStatusTone(status),
    statusLabel: log.statusLabel || (eventType === "activity" && status === "opened" ? "活动中" : roomLogStatusLabel(status)),
    dateLabel: roomLogDateLabel(log.scheduledOpenAt || log.dateKey || log.createdAt),
    titleTime,
    timingText: log.timingText || "",
    openNote,
    nightNote,
    nightNotes,
    nightNoteCount: Number(log.nightNoteCount || nightNotes.length || 0),
    approvedNightNoteCount: Number(log.approvedNightNoteCount || nightNotes.length || 0),
    myNightNote: log.myNightNote ? {
      ...log.myNightNote,
      content: responsiveRichTextHtml(log.myNightNote.content || ""),
      avatarUrl: log.myNightNote.authorProfile && log.myNightNote.authorProfile.avatarUrl ? log.myNightNote.authorProfile.avatarUrl : "",
      avatarInitial: String(log.myNightNote.authorName || "有").slice(0, 1),
      reviewText: reviewReasonText(log.myNightNote.status, log.myNightNote.aiStatus, log.myNightNote.aiReason, "我的夜记"),
      displayCreatedAt: formatDateTime(log.myNightNote.updatedAt || log.myNightNote.createdAt)
    } : null,
    plainNote: roomLogPlainNote(log),
    hasPublicOpenNote: Boolean(openNote),
    hasPublicNightNote: Boolean(nightNote),
    openNoteInReview: log.openNoteStatus === "admin_review",
    nightNoteInReview: log.nightNoteStatus === "admin_review",
    openNoteRejected: log.openNoteStatus === "rejected",
    nightNoteRejected: log.nightNoteStatus === "rejected",
    openNoteReviewText: reviewReasonText(log.openNoteStatus, log.openNoteAiStatus, log.openNoteAiReason, "开门文字"),
    nightNoteReviewText: reviewReasonText(log.nightNoteStatus, log.nightNoteAiStatus, log.nightNoteAiReason, "夜记"),
    canOpen: Boolean(log.canManage && status === "scheduled" && !log.deletedAt && !log.isHidden),
    canClose: Boolean(log.canManage && status === "opened" && !log.deletedAt && !log.isHidden),
    canEditOpenNote: log.canEditOpenNote !== undefined
      ? Boolean(log.canEditOpenNote)
      : Boolean(log.canManage && ["scheduled", "opened"].includes(status) && !log.deletedAt && !log.isHidden),
    canWriteNightNote: log.canWriteNightNote !== undefined
      ? Boolean(log.canWriteNightNote)
      : ["opened", "closed"].includes(status),
    canDeleteExpired: Boolean(log.canDeleteExpired && status === "expired_cancelled" && !log.deletedAt),
    displayUpdatedAt: formatDateTime(log.updatedAt || log.createdAt),
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
  roomLogStatusTone,
  roomLogStatusLabel,
  roomStatusView,
  toRoomLogView,
  canRegisterActivity,
  registrationNotice
};
