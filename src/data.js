export const STORAGE_KEY = "prayer-times-state-v0.200";

export const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const todayString = () => formatDateLocal(new Date());

export const safeJsonParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

function nextMinuteDate(date = new Date()) {
  const next = new Date(date.getTime() + 60 * 1000);
  next.setSeconds(0, 0);
  return next;
}

export const defaultAlertDraft = () => ({
  id: "",
  name: "",
  date: formatDateLocal(nextMinuteDate()),
  time: (() => {
    const next = nextMinuteDate();
    return `${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}`;
  })(),
  repeat: "once",
  weekdays: [],
  enabled: true
});

export const defaultPrayerSettings = () => ({
  lat: "24.7136",
  lon: "46.6753",
  gmt: "180",
  method: "4",
  beforeAudio: "",
  beforeAudioName: "",
  onTimeAudio: "",
  onTimeAudioName: "",
  afterAudio: "",
  afterAudioName: "",
  normalAlertAudio: "",
  normalAlertAudioName: "",
  browserNotificationsEnabled: true,
  language: "en",
  alarms: {
    before: { enabled: true, minutes: "10" },
    onTime: { enabled: true },
    after: { enabled: false, minutes: "10" }
  }
});

export const defaultState = () => ({
  meta: {
    version: "0.200",
    lastUpdatedAt: Date.now()
  },
  settings: defaultPrayerSettings(),
  prayers: {
    forDate: "",
    fetchedAt: "",
    sourceUrl: "",
    status: "idle",
    items: {
      fajr: "",
      sunrise: "",
      dhuhr: "",
      asr: "",
      maghrib: "",
      isha: ""
    }
  },
  alerts: [],
  countdown: {
    durationMs: 5 * 60 * 1000,
    remainingMs: 5 * 60 * 1000,
    runningSince: null,
    startedRemainingMs: 5 * 60 * 1000,
    finishedAt: null
  }
});
