Component({
  externalClasses: ["custom-class"],
  properties: {
    name: {
      type: String,
      value: "circle"
    },
    size: {
      type: Number,
      value: 32
    },
    frame: {
      type: String,
      value: "none"
    },
    tone: {
      type: String,
      value: "default"
    }
  },
  data: {
    iconSrc: "/assets/lucide-animated/activity.svg"
  },
  lifetimes: {
    attached() {
      this.syncIcon();
    }
  },
  observers: {
    name() {
      this.syncIcon();
    },
    tone() {
      this.syncIcon();
    }
  },
  methods: {
    syncIcon() {
      const name = String(this.data.name || "activity");
      const safeName = /^[a-z0-9-]+$/.test(name) ? name : "activity";
      const baseDir = this.data.tone === "light" ? "lucide-animated-light" : "lucide-animated";
      this.setData({
        iconSrc: `/assets/${baseDir}/${safeName}.svg`
      });
    }
  }
});
