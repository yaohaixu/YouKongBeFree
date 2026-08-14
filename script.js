const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
const navWrap = document.querySelector(".nav-wrap");
const mainSurface = document.querySelector("main");
const productSurfaceSelectors = [
  "[data-admin-dashboard]",
  "[data-admin-activities-page]",
  "[data-admin-members-page]",
  "[data-admin-roles-page]",
  "[data-admin-role-editor-page]",
  "[data-admin-modules-page]",
  "[data-admin-templates-page]",
  "[data-admin-template-editor-page]",
  "[data-admin-logs-page]",
  "[data-admin-reports-page]",
  "[data-admin-safety-page]",
  "[data-admin-ai-page]",
  "[data-admin-governance-page]",
  "[data-admin-trust-policy-page]",
  "[data-admin-badges-page]",
  "[data-admin-badge-policy-page]",
  "[data-admin-trust-page]",
  "[data-admin-trust-detail-page]",
  "[data-admin-activity-confidence-page]",
  "[data-me-dashboard]",
  "[data-my-activities-page]",
  "[data-review-tasks-root]",
  "[data-registrations-page]",
  "[data-activity-editor-page]",
];

document.body.classList.add(
  mainSurface && productSurfaceSelectors.some((selector) => mainSurface.matches(selector))
    ? "product-surface"
    : "public-surface"
);

const ykIconDefinitions = {
  activity: {
    motion: "draw",
    paths: [
      '<path class="yk-motion-draw" d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"></path>',
    ],
  },
  "arrow-right": {
    motion: "slide",
    paths: [
      '<path class="yk-motion-draw" d="M5 12h14"></path>',
      '<path class="yk-motion-slide" d="m12 5 7 7-7 7"></path>',
    ],
  },
  "badge-alert": {
    motion: "alert",
    paths: [
      '<path class="yk-motion-pop" d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.78 4 4 0 0 1 0-6.75Z"></path>',
      '<path class="yk-motion-line" d="M12 8v4"></path>',
      '<path class="yk-motion-dot" d="M12 16h.01"></path>',
    ],
  },
  bell: {
    motion: "ring",
    paths: [
      '<path class="yk-motion-pop" d="M10.268 21a2 2 0 0 0 3.464 0"></path>',
      '<path class="yk-motion-ring" d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.674C19.42 13.895 18 12.499 18 8a6 6 0 0 0-12 0c0 4.499-1.42 5.895-2.738 7.326"></path>',
    ],
  },
  "book-text": {
    motion: "draw",
    paths: [
      '<path class="yk-motion-pop" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>',
      '<path class="yk-motion-pop" d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"></path>',
      '<path class="yk-motion-draw" d="M8 7h8"></path>',
      '<path class="yk-motion-draw" d="M8 11h8"></path>',
      '<path class="yk-motion-draw" d="M8 15h5"></path>',
    ],
  },
  bookmark: {
    motion: "pop",
    paths: [
      '<path class="yk-motion-pop" d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>',
    ],
  },
  bot: {
    motion: "bot",
    paths: [
      '<path class="yk-motion-pop" d="M12 8V4H8"></path>',
      '<rect class="yk-motion-pop" x="4" y="8" width="16" height="12" rx="2"></rect>',
      '<path class="yk-motion-line" d="M2 14h2"></path>',
      '<path class="yk-motion-line" d="M20 14h2"></path>',
      '<path class="yk-motion-eye" d="M9 13v2"></path>',
      '<path class="yk-motion-eye" d="M15 13v2"></path>',
    ],
  },
  "calendar-check": {
    motion: "check",
    paths: [
      '<path d="M8 2v4"></path>',
      '<path d="M16 2v4"></path>',
      '<rect x="3" y="4" width="18" height="18" rx="2"></rect>',
      '<path d="M3 10h18"></path>',
      '<path class="yk-motion-draw" d="m9 16 2 2 4-4"></path>',
    ],
  },
  "calendar-days": {
    motion: "calendar",
    paths: [
      '<path d="M8 2v4"></path>',
      '<path d="M16 2v4"></path>',
      '<rect x="3" y="4" width="18" height="18" rx="2"></rect>',
      '<path d="M3 10h18"></path>',
      '<path class="yk-motion-dot" d="M8 14h.01"></path>',
      '<path class="yk-motion-dot" d="M12 14h.01"></path>',
      '<path class="yk-motion-dot" d="M16 14h.01"></path>',
      '<path class="yk-motion-dot" d="M8 18h.01"></path>',
      '<path class="yk-motion-dot" d="M12 18h.01"></path>',
    ],
  },
  bold: {
    motion: "pop",
    paths: [
      '<path d="M7 4h5a3.5 3.5 0 0 1 0 7H7z"></path>',
      '<path d="M7 11h6a3.5 3.5 0 0 1 0 7H7z"></path>',
    ],
  },
  "chart-line": {
    motion: "draw",
    paths: [
      '<path d="M3 3v16a2 2 0 0 0 2 2h16"></path>',
      '<path class="yk-motion-draw" d="m7 13 3-3 4 4 5-5"></path>',
    ],
  },
  "chart-pie": {
    motion: "pop",
    paths: [
      '<path class="yk-motion-pop" d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"></path>',
      '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>',
    ],
  },
  check: {
    motion: "check",
    paths: ['<path class="yk-motion-draw" d="M20 6 9 17l-5-5"></path>'],
  },
  "chevron-right": {
    motion: "slide",
    paths: ['<path class="yk-motion-slide" d="m9 18 6-6-6-6"></path>'],
  },
  minus: {
    motion: "draw",
    paths: ['<path class="yk-motion-draw" d="M5 12h14"></path>'],
  },
  "circle-check": {
    motion: "check",
    paths: [
      '<circle class="yk-motion-pop" cx="12" cy="12" r="10"></circle>',
      '<path class="yk-motion-draw" d="m9 12 2 2 4-4"></path>',
    ],
  },
  clock: {
    motion: "clock",
    paths: [
      '<circle cx="12" cy="12" r="10"></circle>',
      '<path class="yk-motion-hand" d="M12 12V6"></path>',
      '<path class="yk-motion-minute" d="M12 12h4"></path>',
    ],
  },
  coffee: {
    motion: "steam",
    paths: [
      '<path class="yk-motion-steam" d="M6 2v2"></path>',
      '<path class="yk-motion-steam" d="M10 2v2"></path>',
      '<path class="yk-motion-steam" d="M14 2v2"></path>',
      '<path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"></path>',
    ],
  },
  copy: {
    motion: "copy",
    paths: [
      '<rect class="yk-motion-copy-front" x="8" y="8" width="14" height="14" rx="2"></rect>',
      '<path class="yk-motion-copy-back" d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>',
    ],
  },
  "clipboard-check": {
    motion: "check",
    paths: [
      '<rect x="8" y="2" width="8" height="4" rx="1"></rect>',
      '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>',
      '<path class="yk-motion-draw" d="m9 14 2 2 4-4"></path>',
    ],
  },
  download: {
    motion: "download",
    paths: [
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>',
      '<path class="yk-motion-upload" d="M7 10l5 5 5-5"></path>',
      '<path class="yk-motion-upload" d="M12 15V3"></path>',
    ],
  },
  eye: {
    motion: "eye",
    paths: [
      '<path class="yk-motion-eye" d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path>',
      '<circle class="yk-motion-eye" cx="12" cy="12" r="3"></circle>',
    ],
  },
  "file-pen-line": {
    motion: "pen",
    paths: [
      '<path d="m18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2"></path>',
      '<path class="yk-motion-pen" d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"></path>',
      '<path class="yk-motion-line" d="M8 18h5"></path>',
    ],
  },
  heading: {
    motion: "draw",
    paths: [
      '<path d="M6 5v14"></path>',
      '<path d="M18 5v14"></path>',
      '<path d="M6 12h12"></path>',
    ],
  },
  flag: {
    motion: "wave",
    paths: [
      '<path class="yk-motion-wave" d="M4 22V4"></path>',
      '<path class="yk-motion-wave" d="M4 4s2-1 4-1 4 2 6 2 4-1 4-1v10s-2 1-4 1-4-2-6-2-4 1-4 1V4z"></path>',
    ],
  },
  "folder-open": {
    motion: "pop",
    paths: [
      '<path class="yk-motion-pop" d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.8 2.9l-2.2 4.4A2 2 0 0 1 17.8 18H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2A2 2 0 0 0 12.07 6H20a2 2 0 0 1 2 2v2"></path>',
    ],
  },
  "folder-sync": {
    motion: "spin",
    paths: [
      '<path d="M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v.5"></path>',
      '<path class="yk-motion-spin" d="M12 10v4h4"></path>',
      '<path class="yk-motion-spin" d="m12 14 1.535-1.605a5 5 0 0 1 8 1.5"></path>',
      '<path class="yk-motion-spin" d="M22 22v-4h-4"></path>',
      '<path class="yk-motion-spin" d="m22 18-1.535 1.605a5 5 0 0 1-8-1.5"></path>',
    ],
  },
  gavel: {
    motion: "alert",
    paths: [
      '<path class="yk-motion-pop" d="m14 13-8.5 8.5"></path>',
      '<path class="yk-motion-alert" d="m18 16 4-4"></path>',
      '<path class="yk-motion-alert" d="m6 8 4-4"></path>',
      '<path class="yk-motion-alert" d="m14.5 4.5 5 5"></path>',
      '<path class="yk-motion-alert" d="m4.5 14.5 5 5"></path>',
    ],
  },
  heart: {
    motion: "heart",
    paths: [
      '<path class="yk-motion-pop" d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"></path>',
    ],
  },
  "heart-filled": {
    motion: "heart",
    paths: [
      '<path class="yk-motion-pop" d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" fill="currentColor"></path>',
    ],
  },
  home: {
    motion: "home",
    paths: [
      '<path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>',
      '<path class="yk-motion-door" d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path>',
    ],
  },
  image: {
    motion: "pop",
    paths: [
      '<rect x="3" y="3" width="18" height="18" rx="2"></rect>',
      '<circle class="yk-motion-pop" cx="9" cy="9" r="2"></circle>',
      '<path class="yk-motion-slide" d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>',
    ],
  },
  key: {
    motion: "slide",
    paths: [
      '<circle class="yk-motion-pop" cx="7.5" cy="15.5" r="5.5"></circle>',
      '<path class="yk-motion-slide" d="m21 2-9.6 9.6"></path>',
      '<path class="yk-motion-slide" d="m15.5 7.5 3 3L22 7l-3-3"></path>',
    ],
  },
  "loader-circle": {
    motion: "loader",
    paths: ['<path class="yk-motion-loader" d="M21 12a9 9 0 1 1-6.219-8.56"></path>'],
  },
  "lock-open": {
    motion: "unlock",
    paths: [
      '<rect x="3" y="11" width="18" height="11" rx="2"></rect>',
      '<path class="yk-motion-unlock" d="M7 11V7a5 5 0 0 1 9.9-1"></path>',
    ],
  },
  "message-square": {
    motion: "message",
    paths: [
      '<path class="yk-motion-pop" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
      '<path class="yk-motion-line" d="M8 9h8"></path>',
      '<path class="yk-motion-line" d="M8 13h5"></path>',
    ],
  },
  list: {
    motion: "draw",
    paths: [
      '<path d="M8 6h12"></path>',
      '<path d="M8 12h12"></path>',
      '<path d="M8 18h12"></path>',
      '<path d="M4 6h.01"></path>',
      '<path d="M4 12h.01"></path>',
      '<path d="M4 18h.01"></path>',
    ],
  },
  plus: {
    motion: "pop",
    paths: [
      '<path class="yk-motion-pop" d="M5 12h14"></path>',
      '<path class="yk-motion-pop" d="M12 5v14"></path>',
    ],
  },
  "refresh-cw": {
    motion: "spin",
    paths: [
      '<path class="yk-motion-spin" d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>',
      '<path class="yk-motion-spin" d="M3 3v5h5"></path>',
      '<path class="yk-motion-spin" d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>',
      '<path class="yk-motion-spin" d="M16 16h5v5"></path>',
    ],
  },
  scan: {
    motion: "scan",
    paths: [
      '<path class="yk-motion-pop" d="M3 7V5a2 2 0 0 1 2-2h2"></path>',
      '<path class="yk-motion-pop" d="M17 3h2a2 2 0 0 1 2 2v2"></path>',
      '<path class="yk-motion-pop" d="M21 17v2a2 2 0 0 1-2 2h-2"></path>',
      '<path class="yk-motion-pop" d="M7 21H5a2 2 0 0 1-2-2v-2"></path>',
      '<path class="yk-motion-scan" d="M7 8h10"></path>',
      '<path class="yk-motion-line" d="M7 12h8"></path>',
      '<path class="yk-motion-line" d="M7 16h6"></path>',
    ],
  },
  send: {
    motion: "send",
    paths: [
      '<g class="yk-motion-send"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path></g>',
      '<path class="yk-motion-trail" d="M3 21c2-1 3.2-2.5 4.2-4.4"></path>',
    ],
  },
  settings: {
    motion: "spin",
    paths: [
      '<path class="yk-motion-spin" d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>',
      '<circle cx="12" cy="12" r="3"></circle>',
    ],
  },
  "shield-check": {
    motion: "check",
    paths: [
      '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path>',
      '<path class="yk-motion-draw" d="m9 12 2 2 4-4"></path>',
    ],
  },
  sparkles: {
    motion: "spark",
    paths: [
      '<path class="yk-motion-spark" d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>',
      '<path class="yk-motion-dot" d="M20 3v4"></path>',
      '<path class="yk-motion-dot" d="M22 5h-4"></path>',
      '<path class="yk-motion-dot" d="M4 17v2"></path>',
      '<path class="yk-motion-dot" d="M5 18H3"></path>',
    ],
  },
  ticket: {
    motion: "split",
    paths: [
      '<path class="yk-motion-ticket-left" d="M13 5H4a2 2 0 0 0-2 2v2a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h9"></path>',
      '<path class="yk-motion-ticket-left" d="M13 5v2"></path>',
      '<path class="yk-motion-ticket-left" d="M13 11v2"></path>',
      '<path class="yk-motion-ticket-left" d="M13 17v2"></path>',
      '<path class="yk-motion-ticket-right" d="M13 5h7a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2h-7"></path>',
    ],
  },
  trash: {
    motion: "trash",
    paths: [
      '<path class="yk-motion-lid" d="M3 6h18"></path>',
      '<path class="yk-motion-lid" d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>',
      '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>',
      '<path class="yk-motion-line" d="M10 11v6"></path>',
      '<path class="yk-motion-line" d="M14 11v6"></path>',
    ],
  },
  undo: {
    motion: "undo",
    paths: [
      '<path class="yk-motion-undo" d="M3 7v6h6"></path>',
      '<path class="yk-motion-draw" d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>',
    ],
  },
  upload: {
    motion: "upload",
    paths: [
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>',
      '<path class="yk-motion-upload" d="M17 8 12 3 7 8"></path>',
      '<path class="yk-motion-upload" d="M12 3v12"></path>',
    ],
  },
  user: {
    motion: "user",
    paths: [
      '<circle class="yk-motion-pop" cx="12" cy="8" r="5"></circle>',
      '<path class="yk-motion-draw" d="M20 21a8 8 0 0 0-16 0"></path>',
    ],
  },
  "user-round-cog": {
    motion: "spin",
    paths: [
      '<path d="M2 21a8 8 0 0 1 10.434-7.62"></path>',
      '<circle cx="10" cy="8" r="5"></circle>',
      '<g class="yk-motion-spin"><circle cx="18" cy="18" r="3"></circle><path d="m14.305 19.53.923-.382"></path><path d="m15.228 16.852-.923-.383"></path><path d="m16.852 15.228-.383-.923"></path><path d="m16.852 20.772-.383.924"></path><path d="m19.148 15.228.383-.923"></path><path d="m19.53 21.696-.382-.924"></path><path d="m20.772 16.852.924-.383"></path><path d="m20.772 19.148.924.383"></path></g>',
    ],
  },
  users: {
    motion: "user",
    paths: [
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>',
      '<circle cx="9" cy="7" r="4"></circle>',
      '<path class="yk-motion-draw" d="M22 21v-2a4 4 0 0 0-3-3.87"></path>',
      '<path class="yk-motion-draw" d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    ],
  },
  "wifi-sync": {
    motion: "sync",
    paths: [
      '<path class="yk-motion-draw" d="M5 13a10 10 0 0 1 14 0"></path>',
      '<path class="yk-motion-draw" d="M8.5 16.5a5 5 0 0 1 7 0"></path>',
      '<path class="yk-motion-pop" d="M12 20h.01"></path>',
      '<path class="yk-motion-spin" d="M17 3v4h4"></path>',
      '<path class="yk-motion-spin" d="M21 7a7 7 0 0 0-12.2-4.1"></path>',
    ],
  },
  x: {
    motion: "x",
    paths: [
      '<path class="yk-motion-draw" d="M18 6 6 18"></path>',
      '<path class="yk-motion-draw" d="m6 6 12 12"></path>',
    ],
  },
};

const ykIconAliases = {
  admin: "shield-check",
  alert: "badge-alert",
  ai: "bot",
  approve: "circle-check",
  archive: "folder-open",
  back: "undo",
  badge: "badge-alert",
  calendar: "calendar-days",
  cancel: "x",
  close: "x",
  create: "send",
  delete: "trash",
  door: "lock-open",
  download: "download",
  edit: "file-pen-line",
  feedback: "message-square",
  friend: "home",
  governance: "gavel",
  grid: "settings",
  image: "image",
  logs: "clock",
  mine: "user",
  model: "bot",
  people: "users",
  policy: "clipboard-check",
  registration: "ticket",
  report: "badge-alert",
  room: "coffee",
  rules: "shield-check",
  save: "circle-check",
  scan: "scan",
  share: "send",
  submit: "send",
  sync: "wifi-sync",
  text: "file-pen-line",
  template: "file-pen-line",
  todo: "clipboard-check",
  trust: "heart",
  user: "user",
  view: "eye",
  warning: "badge-alert",
  "1": "list",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  bold: "bold",
  blockquote: "message-square",
  quote: "message-square",
  ul: "list",
  ol: "list",
  hr: "minus",
};

function ykIconSvg(name = "arrow-right", options = {}) {
  const requestedName = String(name || "arrow-right");
  const iconName = ykIconAliases[requestedName] || requestedName;
  const definition = ykIconDefinitions[iconName] || ykIconDefinitions["arrow-right"];
  const className = options.className ? ` ${options.className}` : "";
  const label = options.label ? ` aria-label="${String(options.label).replace(/"/g, "&quot;")}"` : ' aria-hidden="true"';
  return `<svg class="yk-animated-icon yk-icon-${iconName} yk-motion-${definition.motion}${className}" data-yki-icon="${iconName}" data-yki-motion="${definition.motion}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${label}>${definition.paths.join("")}</svg>`;
}

function normalizeButtonText(element) {
  const clone = element.cloneNode(true);
  clone.querySelectorAll(".yk-button-icon, svg, .sr-only").forEach((node) => node.remove());
  return clone.textContent.replace(/\s+/g, " ").trim();
}

function inferYkButtonIcon(element) {
  const explicit = element.getAttribute("data-yki-name") || element.getAttribute("data-icon");
  if (explicit) return explicit;
  const text = normalizeButtonText(element);
  const href = element.getAttribute("href") || "";
  const attrs = Array.from(element.attributes || []).map((attr) => attr.name).join(" ");
  const haystack = `${text} ${href} ${attrs}`.toLowerCase();
  const rules = [
    [/生成中|处理中|提交中|保存中|读取中|loading|load-more|加载|刷新|重新分析|重新|重试/, "refresh-cw"],
    [/保存|存草稿|草稿|启用|通过|恢复|展示|确认|完成|绑定微信|接受|同意/, "circle-check"],
    [/新增|新建|添加|创建/, "plus"],
    [/提交|发布|发送|邀请|发起协作|发起活动/, "send"],
    [/编辑|修改|资料|prompt|模板|策略|写|发起|预约|开门|活动想法|申请/, "file-pen-line"],
    [/报名|报名表|注册|参与/, "ticket"],
    [/反馈|感受|评论|留言|夜记|复盘/, "message-square"],
    [/删除|移除|隐藏|不展示|拒绝|驳回|撤回|取消|关闭|关门|danger|reject|delete|remove|cancel/, "trash"],
    [/下载|导出|海报|邀请函|公示|csv|export|download/, "download"],
    [/上传|封面|图片|头像|upload/, "upload"],
    [/复制|链接|copy/, "copy"],
    [/二维码|扫码|scan|qr/, "scan"],
    [/分享|share|小程序链接/, "send"],
    [/提醒|订阅|通知|calendar|日历/, "bell"],
    [/感兴趣|支持|捐赠|喜欢|心愿/, "heart"],
    [/同步|设备|身份网络|合并|微信|sync/, "wifi-sync"],
    [/ai|模型|用量|连通|prompt/, "bot"],
    [/安全|审核|规则|权限|管理员|后台|治理|复核|角色|成员|用户|协作员/, "shield-check"],
    [/角色|成员|用户|协作员|朋友们|共同发起人|客厅的朋友/, "users"],
    [/用量|统计|分析|置信度|trust|信用/, "chart-line"],
    [/白皮书|notion|文档|说明|共识/, "book-text"],
    [/活动|近期|历史|日历|列表|全部/, "calendar-days"],
    [/首页|客厅|有空|开门|坐坐|home/, "home"],
    [/查看|进入|打开|管理|前往|联系|回到|返回|回我的|回身份|回|about|index|href/, "arrow-right"],
  ];
  const match = rules.find(([pattern]) => pattern.test(haystack));
  return match ? match[1] : "arrow-right";
}

function playYkIconMotion(icon) {
  if (!icon || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  icon.classList.remove("is-animating");
  void icon.getBoundingClientRect();
  icon.classList.add("is-animating");
  clearTimeout(icon.ykMotionTimer);
  icon.ykMotionTimer = setTimeout(() => icon.classList.remove("is-animating"), 720);
}

function enhanceYkButtonIcons(root = document) {
  const selector = ".button, .nav-button, .interest-button, .table-action, .editor-stepper button, .rich-tool";
  const targets = root.matches?.(selector) ? [root] : Array.from(root.querySelectorAll?.(selector) || []);
  targets.forEach((element) => {
    if (element.dataset.ykiEnhanced === "true" && element.querySelector(":scope > .yk-button-icon")) return;
    if (element.dataset.ykiEnhanced === "true") element.dataset.ykiEnhanced = "";
    if (element.matches(".theme-switch, .menu-toggle")) return;
    if (element.querySelector(":scope > .yk-button-icon")) {
      element.dataset.ykiEnhanced = "true";
      return;
    }
    const text = normalizeButtonText(element);
    const ariaLabel = element.getAttribute("aria-label") || "";
    if (!text && !ariaLabel) return;
    const iconName = inferYkButtonIcon(element);
    const icon = document.createElement("span");
    icon.className = "yk-button-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = ykIconSvg(iconName);
    element.prepend(icon);
    element.classList.add("has-yki-icon");
    element.dataset.ykiEnhanced = "true";
    requestAnimationFrame(() => playYkIconMotion(icon.querySelector("[data-yki-icon]")));
  });
}

function mountYkAnimatedIcons() {
  enhanceYkButtonIcons(document);
  const playFromTarget = (event) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest(".button, .nav-button, .interest-button, .table-action, .editor-stepper button, .workspace-card, .quick-home");
    if (!target || target.matches(":disabled, [aria-disabled='true']")) return;
    target.querySelectorAll("[data-yki-icon]").forEach(playYkIconMotion);
  };
  document.addEventListener("pointerenter", playFromTarget, true);
  document.addEventListener("focusin", playFromTarget);
  document.addEventListener("click", playFromTarget);
  if ("MutationObserver" in window) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target instanceof Element) enhanceYkButtonIcons(mutation.target);
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) enhanceYkButtonIcons(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }
}

window.YoukongIcons = {
  aliases: ykIconAliases,
  definitions: ykIconDefinitions,
  enhance: enhanceYkButtonIcons,
  play: playYkIconMotion,
  svg: ykIconSvg,
};

function mountThemeSwitch() {
  if (!navWrap || !window.youkongTheme || document.querySelector("[data-theme-switch]")) return;
  const switcher = document.createElement("button");
  switcher.className = "theme-switch";
  switcher.type = "button";
  switcher.setAttribute("data-theme-switch", "");
  switcher.innerHTML = [
    '<span class="theme-switch-ring" aria-hidden="true">',
    '<span class="theme-switch-icon moon">',
    '<svg viewBox="0 0 24 24" focusable="false">',
    '<path d="M20.2 14.1A7.9 7.9 0 0 1 9.9 3.8a8.5 8.5 0 1 0 10.3 10.3Z"></path>',
    "</svg>",
    "</span>",
    '<span class="theme-switch-icon sun">',
    '<svg viewBox="0 0 24 24" focusable="false">',
    '<circle cx="12" cy="12" r="4.1"></circle>',
    '<path d="M12 2.8v2.1M12 19.1v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"></path>',
    "</svg>",
    "</span>",
    '<span class="theme-switch-icon system">',
    '<svg viewBox="0 0 24 24" focusable="false">',
    '<rect x="4.1" y="5.2" width="15.8" height="10.7" rx="2.2"></rect>',
    '<path d="M9 20h6M12 15.9V20"></path>',
    "</svg>",
    "</span>",
    "</span>",
    '<span class="sr-only" data-theme-switch-label>切换主题模式</span>',
  ].join("");

  switcher.addEventListener("click", () => {
    const mode = window.youkongTheme.getMode ? window.youkongTheme.getMode() : "system";
    const nextMode = mode === "dark" ? "light" : mode === "light" ? "system" : "dark";
    switcher.classList.remove("is-cycling");
    void switcher.offsetWidth;
    switcher.classList.add("is-cycling");
    clearTimeout(switcher.motionTimer);
    switcher.motionTimer = setTimeout(() => switcher.classList.remove("is-cycling"), 900);
    window.youkongTheme.setMode(nextMode);
  });

  const brand = navWrap.querySelector(".brand");
  if (brand && brand.nextSibling) {
    navWrap.insertBefore(switcher, brand.nextSibling);
  } else {
    navWrap.prepend(switcher);
  }

  const syncThemeButton = () => {
    const mode = window.youkongTheme.getMode ? window.youkongTheme.getMode() : "system";
    const resolved = window.youkongTheme.resolveMode();
    const isDark = mode === "dark";
    const isLight = mode === "light";
    const isSystem = mode === "system";
    const nextLabel = isDark ? "白天模式" : isLight ? "跟随系统" : "黑夜模式";
    const currentLabel = isSystem ? `跟随系统（当前${resolved === "dark" ? "黑夜" : "白天"}）` : isDark ? "黑夜模式" : "白天模式";
    const label = `当前${currentLabel}，点击切换到${nextLabel}`;
    switcher.dataset.themeMode = mode;
    switcher.dataset.themeState = resolved;
    switcher.classList.toggle("is-dark", isDark);
    switcher.classList.toggle("is-light", isLight);
    switcher.classList.toggle("is-system", isSystem);
    switcher.setAttribute("aria-label", label);
    switcher.setAttribute("title", label);
    switcher.querySelector("[data-theme-switch-label]").textContent = label;
  };
  window.addEventListener("youkong-theme-change", syncThemeButton);
  syncThemeButton();
}

function mountQuickHome() {
  if (document.querySelector("[data-quick-home]")) return;
  const home = document.createElement("a");
  home.className = "quick-home";
  home.href = location.pathname.endsWith("/index.html") || location.pathname === "/" ? "#main" : "index.html";
  home.setAttribute("data-quick-home", "");
  home.setAttribute("aria-label", "一键回到首页");
  home.innerHTML = '<span class="quick-home-icon" aria-hidden="true"></span><span>首页</span>';
  document.body.append(home);

  const syncQuickHome = () => {
    home.classList.toggle("is-visible", window.scrollY > Math.min(window.innerHeight * 0.55, 520));
  };
  window.addEventListener("scroll", syncQuickHome, { passive: true });
  syncQuickHome();
}

window.addEventListener("youkong-theme-change", mountThemeSwitch);
mountThemeSwitch();
setTimeout(mountThemeSwitch, 0);
setTimeout(mountThemeSwitch, 160);
mountQuickHome();

function mountAdminLoginFooterLink() {
  document.querySelectorAll(".site-footer .footer-links").forEach((links) => {
    if (links.querySelector('[href="login.html"]')) return;
    const link = document.createElement("a");
    link.href = "login.html";
    link.textContent = "管理员登录";
    links.append(link);
  });
}

mountAdminLoginFooterLink();

function mountMotionFeedback() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const pressableSelector = ".button, .nav-button, .theme-switch, .quick-home, .workspace-card, .event-card, .interest-button, .table-action, .editor-stepper button";
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest(pressableSelector);
      if (!target || target.matches(":disabled, [aria-disabled='true']")) return;
      target.classList.remove("motion-press");
      void target.offsetWidth;
      target.classList.add("motion-press");
      clearTimeout(target.motionPressTimer);
      target.motionPressTimer = setTimeout(() => target.classList.remove("motion-press"), 220);
    },
    { passive: true }
  );
}

mountMotionFeedback();
mountYkAnimatedIcons();

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    document.body.classList.toggle("menu-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) {
      navLinks.classList.remove("open");
      document.body.classList.remove("menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const text = button.getAttribute("data-copy");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const old = button.textContent;
      button.textContent = "已复制";
      button.dataset.ykiEnhanced = "";
      enhanceYkButtonIcons(button);
      setTimeout(() => {
        button.textContent = old;
        button.dataset.ykiEnhanced = "";
        enhanceYkButtonIcons(button);
      }, 1400);
    } catch {
      button.textContent = text;
      button.dataset.ykiEnhanced = "";
      enhanceYkButtonIcons(button);
    }
  });
});

const revealTargets = [
  ".section-head",
  ".split",
  ".stats",
  ".grid",
  ".belief",
  ".notice-board",
  ".governance-list",
  ".gallery",
  ".process",
  ".donation-options",
  ".qr-grid",
  ".timeline",
  ".contact-panel",
  ".faq",
  ".quote-strip",
  ".form-note",
].join(",");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
  let pointerFrame = 0;
  let spotlightFrame = 0;
  let lastPointerEvent = null;

  document.addEventListener(
    "pointermove",
    (event) => {
      lastPointerEvent = event;
      if (!pointerFrame) {
        pointerFrame = requestAnimationFrame(() => {
          document.documentElement.style.setProperty("--pointer-x", `${lastPointerEvent.clientX}px`);
          document.documentElement.style.setProperty("--pointer-y", `${lastPointerEvent.clientY}px`);
          pointerFrame = 0;
        });
      }

      if (!(event.target instanceof Element)) return;
      const target = event.target.closest(".button, .photo-frame, .card, .event-card, .workspace-card, .form-note");
      if (!target) return;
      if (!spotlightFrame) {
        spotlightFrame = requestAnimationFrame(() => {
          const rect = target.getBoundingClientRect();
          target.style.setProperty("--local-x", `${lastPointerEvent.clientX - rect.left}px`);
          target.style.setProperty("--local-y", `${lastPointerEvent.clientY - rect.top}px`);
          spotlightFrame = 0;
        });
      }
    },
    { passive: true }
  );
}

if (!reduceMotion && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px 8% 0px", threshold: 0.04 }
  );

  document.querySelectorAll(revealTargets).forEach((element, index) => {
    element.setAttribute("data-reveal", "");
    element.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 55}ms`);
    observer.observe(element);
  });

  document
    .querySelectorAll(".grid, .process, .donation-options, .qr-grid, .governance-list, .stats, .timeline, .belief-list, .notice-list")
    .forEach((group) => {
      Array.from(group.children).forEach((child, index) => {
        child.style.setProperty("--item-delay", `${Math.min(index, 7) * 45}ms`);
      });
    });
} else {
  document.documentElement.classList.add("reduced-motion");
}
