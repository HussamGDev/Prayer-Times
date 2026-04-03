import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultAlertDraft,
  defaultPrayerSettings,
  defaultState,
  formatDateLocal,
  safeJsonParse,
  STORAGE_KEY,
  todayString
} from "./data";
import { defaultLocale, languageList, locales, translate } from "./i18n";

const PRAYER_KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
const APP_TABS = ["prayers", "alerts", "countdown"];
const WEEKDAY_OPTIONS = [
  { value: 0, key: "days.sun" },
  { value: 1, key: "days.mon" },
  { value: 2, key: "days.tue" },
  { value: 3, key: "days.wed" },
  { value: 4, key: "days.thu" },
  { value: 5, key: "days.fri" },
  { value: 6, key: "days.sat" }
];

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getPrayerSourceUrl(settings, dateString) {
  const [year, month, day] = dateString.split("-");
  const params = new URLSearchParams({
    latitude: settings.lat || "",
    longitude: settings.lon || "",
    method: settings.method || "4"
  });
  return `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?${params.toString()}`;
}

function parsePrayerTimesFromApi(payload) {
  const timings = payload?.data?.timings;
  if (!timings) return null;
  const clean = (value) => (value || "").toString().split(" ")[0].trim();
  return {
    fajr: clean(timings.Fajr),
    sunrise: clean(timings.Sunrise),
    dhuhr: clean(timings.Dhuhr),
    asr: clean(timings.Asr),
    maghrib: clean(timings.Maghrib),
    isha: clean(timings.Isha)
  };
}

function normalizeState(parsed) {
  const base = defaultState();
  const savedSettings = parsed.settings || {};

  return {
    ...base,
    ...parsed,
    settings: {
      ...defaultPrayerSettings(),
      ...savedSettings,
      alarms: {
        ...defaultPrayerSettings().alarms,
        ...(savedSettings.alarms || {})
      }
    },
    prayers: {
      ...base.prayers,
      ...(parsed.prayers || {}),
      items: {
        ...base.prayers.items,
        ...(parsed.prayers?.items || {})
      }
    },
    alerts: Array.isArray(parsed.alerts)
      ? parsed.alerts.map((alert, index) => ({
          ...defaultAlertDraft(),
          ...alert,
          id: alert.id || createId(`alert-${index}`),
          weekdays: Array.isArray(alert.weekdays) ? alert.weekdays : []
        }))
      : [],
    countdown: {
      ...base.countdown,
      ...(parsed.countdown || {}),
      durationMs: Number(parsed.countdown?.durationMs ?? base.countdown.durationMs),
      remainingMs: Number(parsed.countdown?.remainingMs ?? base.countdown.remainingMs),
      startedRemainingMs: Number(parsed.countdown?.startedRemainingMs ?? base.countdown.startedRemainingMs),
      runningSince: parsed.countdown?.runningSince ?? null,
      finishedAt: parsed.countdown?.finishedAt ?? null
    }
  };
}

function usePersistentState() {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? safeJsonParse(saved, {}) : {};
    return normalizeState(parsed);
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return [state, setState];
}

function formatClockTime(value) {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return value || "--";
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

function formatDateReadable(value) {
  if (!value) return "--";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function getNextPrayer(prayerItems, nowTick) {
  const now = new Date(nowTick);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const key of PRAYER_KEYS) {
    const value = prayerItems[key];
    if (!/^\d{1,2}:\d{2}$/.test(value || "")) continue;
    const [hours, minutes] = value.split(":").map(Number);
    const prayerMinutes = hours * 60 + minutes;
    if (prayerMinutes >= currentMinutes) return { key, time: value };
  }

  return null;
}

function getAlertWeekdayLabel(alert, t) {
  if (alert.repeat !== "custom") return t(`repeat.${alert.repeat}`);
  if (!alert.weekdays?.length) return t("repeat.custom");
  return alert.weekdays
    .slice()
    .sort((left, right) => left - right)
    .map((day) => t(WEEKDAY_OPTIONS.find((option) => option.value === day)?.key || "repeat.custom"))
    .join(" • ");
}

function getAlertOccurrenceKey(alert, now) {
  if (!alert.enabled || !alert.time) return null;
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (alert.time !== currentTime) return null;

  const today = formatDateLocal(now);
  const day = now.getDay();

  switch (alert.repeat) {
    case "once":
      return alert.date === today ? `once-${alert.id}-${today}-${currentTime}` : null;
    case "daily":
      return `daily-${alert.id}-${today}-${currentTime}`;
    case "custom":
      return alert.weekdays?.includes(day) ? `custom-${alert.id}-${today}-${currentTime}` : null;
    default:
      return null;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result?.toString() || "");
    reader.onerror = () => reject(new Error("file-read-failed"));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [state, setState] = usePersistentState();
  const [nowTick, setNowTick] = useState(Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("prayers");
  const [alertDraft, setAlertDraft] = useState(defaultAlertDraft);
  const [editingAlertId, setEditingAlertId] = useState("");
  const [alarmModalOpen, setAlarmModalOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const [audioStatus, setAudioStatus] = useState({
    prayer: "audioReady",
    normal: "audioReady"
  });

  const prayerMinuteRef = useRef("");
  const normalAlertMinuteRef = useRef("");
  const audioUnlockedRef = useRef(false);

  const locale = state.settings.language || defaultLocale;
  const dir = locales[locale]?.dir || locales[defaultLocale]?.dir || "ltr";
  const t = (key) => translate(locale, key);
  const prayerSettings = state.settings;
  const prayerItems = state.prayers?.items || {};
  const alerts = state.alerts || [];

  const mutateState = (producer) => {
    setState((current) => ({
      ...producer(current),
      meta: {
        ...(current.meta || {}),
        lastUpdatedAt: Date.now()
      }
    }));
  };

  const nextPrayer = useMemo(() => getNextPrayer(prayerItems, nowTick), [nowTick, prayerItems]);

  const activeCountdownRemaining = useMemo(() => {
    const runningSince = state.countdown?.runningSince;
    const startedRemainingMs = Number(state.countdown?.startedRemainingMs ?? state.countdown?.remainingMs ?? 0);
    if (!runningSince) return Number(state.countdown?.remainingMs || 0);
    return Math.max(0, startedRemainingMs - Math.max(0, nowTick - runningSince));
  }, [nowTick, state.countdown?.remainingMs, state.countdown?.runningSince, state.countdown?.startedRemainingMs]);

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((left, right) => {
      const leftDate = `${left.date || ""}-${left.time || ""}`;
      const rightDate = `${right.date || ""}-${right.time || ""}`;
      return leftDate.localeCompare(rightDate);
    });
  }, [alerts]);

  const formatPrayerCountdown = (timeValue) => {
    if (!timeValue || !/^\d{1,2}:\d{2}$/.test(timeValue)) return "--";
    const target = new Date(`${todayString()}T${timeValue}:00`).getTime();
    const diff = target - nowTick;
    if (diff < 0) return t("labels.passed");
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${Math.max(0, totalSeconds)}s`;
  };

  const playAudioSource = async (source, bucket, fromUserGesture = false) => {
    if (!source) {
      setAudioStatus((current) => ({ ...current, [bucket]: "audioMissing" }));
      return;
    }

    try {
      const audio = new Audio(source);
      audio.currentTime = 0;
      await audio.play();
      if (fromUserGesture) audioUnlockedRef.current = true;
      setAudioStatus((current) => ({
        ...current,
        [bucket]: fromUserGesture ? "audioUnlocked" : "audioReady"
      }));
    } catch (error) {
      setAudioStatus((current) => ({
        ...current,
        [bucket]: error?.name === "NotAllowedError" ? "audioBlocked" : "audioFailed"
      }));
    }
  };

  const getPrayerAudioForSlot = (slotKey) => {
    if (slotKey === "before") return prayerSettings.beforeAudio || prayerSettings.onTimeAudio || "";
    if (slotKey === "onTime") return prayerSettings.onTimeAudio || "";
    if (slotKey === "after") return prayerSettings.afterAudio || prayerSettings.onTimeAudio || "";
    return prayerSettings.onTimeAudio || "";
  };

  const refreshPrayerTimes = async () => {
    const today = todayString();
    const directUrl = getPrayerSourceUrl(prayerSettings, today);

    mutateState((current) => ({
      ...current,
      prayers: {
        ...current.prayers,
        status: "loading"
      }
    }));

    try {
      const response = await fetch(directUrl);
      const payload = await response.json();
      const parsed = parsePrayerTimesFromApi(payload);
      if (!parsed) throw new Error("Prayer parsing failed");

      mutateState((current) => ({
        ...current,
        prayers: {
          ...current.prayers,
          forDate: today,
          fetchedAt: new Date().toISOString(),
          sourceUrl: directUrl,
          status: "ready",
          items: parsed
        }
      }));
    } catch {
      mutateState((current) => ({
        ...current,
        prayers: {
          ...current.prayers,
          forDate: today,
          fetchedAt: new Date().toISOString(),
          sourceUrl: directUrl,
          status: "error"
        }
      }));
    }
  };

  const updateSetting = (field, value) => {
    mutateState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [field]: value
      }
    }));
  };

  const updateAlarmSetting = (slot, field, value) => {
    mutateState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        alarms: {
          ...current.settings.alarms,
          [slot]: {
            ...current.settings.alarms[slot],
            [field]: value
          }
        }
      }
    }));
  };

  const handleAudioPick = async (field, nameField, bucket, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      mutateState((current) => ({
        ...current,
        settings: {
          ...current.settings,
          [field]: dataUrl,
          [nameField]: file.name
        }
      }));
      setAudioStatus((current) => ({ ...current, [bucket]: "audioReady" }));
    } catch {
      setAudioStatus((current) => ({ ...current, [bucket]: "audioFailed" }));
    }
  };

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  const resetAlertForm = () => {
    setAlertDraft(defaultAlertDraft());
    setEditingAlertId("");
    setAlarmModalOpen(false);
  };

  const saveAlert = () => {
    const trimmedName = alertDraft.name.trim();
    if (!trimmedName || !alertDraft.time) return;

    const normalized = {
      ...alertDraft,
      id: editingAlertId || createId("alert"),
      name: trimmedName,
      weekdays: alertDraft.repeat === "custom" ? alertDraft.weekdays : []
    };

    mutateState((current) => ({
      ...current,
      alerts: editingAlertId
        ? current.alerts.map((alert) => (alert.id === editingAlertId ? normalized : alert))
        : [...current.alerts, normalized]
    }));

    resetAlertForm();
  };

  const editAlert = (alert) => {
    setAlertDraft({
      ...defaultAlertDraft(),
      ...alert,
      weekdays: Array.isArray(alert.weekdays) ? alert.weekdays : []
    });
    setEditingAlertId(alert.id);
    setActiveTab("alerts");
    setAlarmModalOpen(true);
  };

  const removeAlert = (alertId) => {
    mutateState((current) => ({
      ...current,
      alerts: current.alerts.filter((alert) => alert.id !== alertId)
    }));
    if (editingAlertId === alertId) resetAlertForm();
  };

  const toggleAlertEnabled = (alertId) => {
    mutateState((current) => ({
      ...current,
      alerts: current.alerts.map((alert) =>
        alert.id === alertId ? { ...alert, enabled: !alert.enabled } : alert
      )
    }));
  };

  const toggleAlertWeekday = (weekday) => {
    setAlertDraft((current) => ({
      ...current,
      weekdays: current.weekdays.includes(weekday)
        ? current.weekdays.filter((value) => value !== weekday)
        : [...current.weekdays, weekday].sort((left, right) => left - right)
    }));
  };

  const openNewAlarmModal = () => {
    setAlertDraft(defaultAlertDraft());
    setEditingAlertId("");
    setAlarmModalOpen(true);
    setActiveTab("alerts");
  };

  const updateCountdownDurationPart = (part, rawValue) => {
    const numeric = Math.max(0, Number(rawValue || 0));
    const currentDuration = Number(state.countdown?.durationMs || 0);
    const currentHours = Math.floor(currentDuration / 3600000);
    const currentMinutes = Math.floor((currentDuration % 3600000) / 60000);
    const currentSeconds = Math.floor((currentDuration % 60000) / 1000);
    const nextHours = part === "hours" ? numeric : currentHours;
    const nextMinutes = part === "minutes" ? Math.min(59, numeric) : currentMinutes;
    const nextSeconds = part === "seconds" ? Math.min(59, numeric) : currentSeconds;
    const nextDurationMs = ((nextHours * 3600) + (nextMinutes * 60) + nextSeconds) * 1000;

    mutateState((current) => ({
      ...current,
      countdown: {
        ...current.countdown,
        durationMs: nextDurationMs,
        remainingMs: current.countdown?.runningSince ? current.countdown.remainingMs : nextDurationMs,
        startedRemainingMs: current.countdown?.runningSince ? current.countdown.startedRemainingMs : nextDurationMs,
        finishedAt: null
      }
    }));
  };

  const startCountdown = () => {
    if (state.countdown?.runningSince) return;
    const remainingMs = Number(state.countdown?.remainingMs || 0) || Number(state.countdown?.durationMs || 0);
    if (remainingMs <= 0) return;
    mutateState((current) => ({
      ...current,
      countdown: {
        ...current.countdown,
        runningSince: Date.now(),
        startedRemainingMs: remainingMs,
        remainingMs,
        finishedAt: null
      }
    }));
  };

  const pauseCountdown = () => {
    if (!state.countdown?.runningSince) return;
    mutateState((current) => ({
      ...current,
      countdown: {
        ...current.countdown,
        remainingMs: activeCountdownRemaining,
        startedRemainingMs: activeCountdownRemaining,
        runningSince: null
      }
    }));
  };

  const resetCountdown = () => {
    const durationMs = Number(state.countdown?.durationMs || 0);
    mutateState((current) => ({
      ...current,
      countdown: {
        ...current.countdown,
        remainingMs: durationMs,
        startedRemainingMs: durationMs,
        runningSince: null,
        finishedAt: null
      }
    }));
  };

  const countdownDisplayParts = useMemo(() => {
    const sourceMs = state.countdown?.runningSince ? activeCountdownRemaining : Number(state.countdown?.durationMs || 0);
    const totalSeconds = Math.floor(sourceMs / 1000);
    return {
      hours: String(Math.floor(totalSeconds / 3600)).padStart(2, "0"),
      minutes: String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0"),
      seconds: String(totalSeconds % 60).padStart(2, "0")
    };
  }, [activeCountdownRemaining, state.countdown?.durationMs, state.countdown?.runningSince]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return undefined;
    const mountNode = buyMeCoffeeRef.current;
    if (!mountNode) return undefined;

    mountNode.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js";
    script.async = true;
    script.setAttribute("data-name", "bmc-button");
    script.setAttribute("data-slug", "hussamgdev");
    script.setAttribute("data-color", "#FFDD00");
    script.setAttribute("data-emoji", "☕");
    script.setAttribute("data-font", "Comic");
    script.setAttribute("data-text", "Buy me a coffee");
    script.setAttribute("data-outline-color", "#000000");
    script.setAttribute("data-font-color", "#000000");
    script.setAttribute("data-coffee-color", "#ffffff");

    mountNode.appendChild(script);

    return () => {
      if (mountNode) mountNode.innerHTML = "";
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const today = formatDateLocal(now);
      if (now.getHours() < 1) return;
      if (state.prayers?.forDate !== today || state.prayers?.status === "idle") {
        void refreshPrayerTimes();
      }
    };
    tick();
    const timer = window.setInterval(tick, 60000);
    return () => window.clearInterval(timer);
  }, [prayerSettings.lat, prayerSettings.lon, prayerSettings.method, state.prayers?.forDate, state.prayers?.status]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    const tickPrayerAlarms = () => {
      const items = state.prayers?.items || {};
      if (state.prayers?.forDate !== todayString()) return;

      const slots = [
        {
          key: "before",
          enabled: Boolean(prayerSettings.alarms.before?.enabled),
          delta: -Number(prayerSettings.alarms.before?.minutes || 0),
          label: t("labels.beforePrayer")
        },
        {
          key: "onTime",
          enabled: Boolean(prayerSettings.alarms.onTime?.enabled),
          delta: 0,
          label: t("labels.onPrayer")
        },
        {
          key: "after",
          enabled: Boolean(prayerSettings.alarms.after?.enabled),
          delta: Number(prayerSettings.alarms.after?.minutes || 0),
          label: t("labels.afterPrayer")
        }
      ];

      const now = new Date();

      for (const prayerKey of PRAYER_KEYS) {
        const prayerTime = items[prayerKey];
        if (!/^\d{1,2}:\d{2}$/.test(prayerTime || "")) continue;
        const [hours, minutes] = prayerTime.split(":").map(Number);

        for (const slot of slots) {
          if (!slot.enabled) continue;
          const fire = new Date();
          fire.setHours(hours, minutes + slot.delta, 0, 0);
          const fireKey = `${prayerKey}-${slot.key}-${todayString()}-${fire.getHours()}-${fire.getMinutes()}`;

          if (
            fire.getHours() === now.getHours() &&
            fire.getMinutes() === now.getMinutes() &&
            prayerMinuteRef.current !== fireKey
          ) {
            prayerMinuteRef.current = fireKey;
            void playAudioSource(getPrayerAudioForSlot(slot.key), "prayer", false);

            if (
              prayerSettings.browserNotificationsEnabled &&
              typeof Notification !== "undefined" &&
              Notification.permission === "granted"
            ) {
              new Notification(t("appName"), {
                body: `${t(`prayers.${prayerKey}`)} - ${slot.label}`
              });
            }
          }
        }
      }
    };

    const timer = window.setInterval(tickPrayerAlarms, 15000);
    tickPrayerAlarms();
    return () => window.clearInterval(timer);
  }, [prayerSettings, state.prayers, t]);

  useEffect(() => {
    const tickNormalAlerts = () => {
      const now = new Date();
      const current = state.alerts || [];
      const changes = [];

      for (const alert of current) {
        const occurrenceKey = getAlertOccurrenceKey(alert, now);
        if (!occurrenceKey) continue;
        if (normalAlertMinuteRef.current === occurrenceKey || alert.lastFiredKey === occurrenceKey) continue;

        normalAlertMinuteRef.current = occurrenceKey;
        changes.push({
          id: alert.id,
          changes: {
            lastFiredKey: occurrenceKey,
            enabled: alert.repeat === "once" ? false : alert.enabled
          }
        });

        void playAudioSource(prayerSettings.normalAlertAudio, "normal", false);

        if (
          prayerSettings.browserNotificationsEnabled &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification(t("appName"), {
            body: `${t("labels.alarms")}: ${alert.name}`
          });
        }
      }

      if (changes.length) {
        mutateState((currentState) => ({
          ...currentState,
          alerts: currentState.alerts.map((alert) => {
            const match = changes.find((item) => item.id === alert.id);
            return match ? { ...alert, ...match.changes } : alert;
          })
        }));
      }
    };

    const timer = window.setInterval(tickNormalAlerts, 15000);
    tickNormalAlerts();
    return () => window.clearInterval(timer);
  }, [prayerSettings.browserNotificationsEnabled, prayerSettings.normalAlertAudio, state.alerts, t]);

  useEffect(() => {
    if (!state.countdown?.runningSince) return;
    if (activeCountdownRemaining > 0) return;
    if (state.countdown?.finishedAt) return;

    mutateState((current) => ({
      ...current,
      countdown: {
        ...current.countdown,
        remainingMs: 0,
        startedRemainingMs: 0,
        runningSince: null,
        finishedAt: Date.now()
      }
    }));

    void playAudioSource(prayerSettings.normalAlertAudio, "normal", false);

    if (
      prayerSettings.browserNotificationsEnabled &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      new Notification(t("appName"), {
        body: t("labels.countdownFinished")
      });
    }
  }, [activeCountdownRemaining, prayerSettings.browserNotificationsEnabled, prayerSettings.normalAlertAudio, state.countdown?.finishedAt, state.countdown?.runningSince, t]);

  return (
    <div className="app-shell app-compact" dir={dir}>
      <main className="main-content">
        <div className="dashboard-shell">
          <aside className="dashboard-sidebar">
            <section className="sidebar-card brand-card">
              <p className="eyebrow">{t("brandEyebrow")}</p>
              <h1>{t("appName")}</h1>
              <p className="hero-copy">{t("heroTitle")}</p>
            </section>

            <section className="sidebar-card nav-card">
              <div className="tab-row sidebar-tabs">
                {APP_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`tab-button${activeTab === tab ? " is-active" : ""}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {t(`tabs.${tab}`)}
                  </button>
                ))}
              </div>
            </section>

            <section className="sidebar-card utility-card">
              <button className="ghost-button utility-button" type="button" onClick={() => void refreshPrayerTimes()}>
                {t("actions.refresh")}
              </button>
              <button className="primary-button utility-button" type="button" onClick={() => setSettingsOpen((open) => !open)}>
                {settingsOpen ? t("actions.close") : t("actions.settings")}
              </button>
            </section>

            <section className="sidebar-card status-card">
              <small>{t("labels.prayerStatus")}</small>
              <strong>{t(`status.${state.prayers?.status || "idle"}`)}</strong>
              <span>{t("labels.updatedAt")}: {state.prayers?.fetchedAt ? new Date(state.prayers.fetchedAt).toLocaleTimeString() : t("labels.notFetched")}</span>
            </section>
          </aside>

          <div className="dashboard-stage">
        <section className="hero hero-compact">
          <div>
            <p className="eyebrow">{t("labels.today")}</p>
            <h2 className="stage-title">{new Date(`${todayString()}T12:00:00`).toLocaleDateString()}</h2>
          </div>
          <div className="hero-chip-group">
            <span className="hero-chip">{nextPrayer ? t(`prayers.${nextPrayer.key}`) : "--"}</span>
            <span className="hero-chip">{nextPrayer ? formatClockTime(nextPrayer.time) : "--"}</span>
            <span className="hero-chip">{nextPrayer ? formatPrayerCountdown(nextPrayer.time) : "--"}</span>
          </div>
        </section>

        <section className="summary-panel">
          <div className="summary-card">
            <small>{t("labels.today")}</small>
            <strong>{new Date(`${todayString()}T12:00:00`).toLocaleDateString()}</strong>
          </div>
          <div className="summary-card">
            <small>{t("labels.nextPrayer")}</small>
            <strong>{nextPrayer ? `${t(`prayers.${nextPrayer.key}`)} - ${formatClockTime(nextPrayer.time)}` : "--"}</strong>
          </div>
          <div className="summary-card">
            <small>{t("labels.timeLeft")}</small>
            <strong>{nextPrayer ? formatPrayerCountdown(nextPrayer.time) : "--"}</strong>
          </div>
          <div className="summary-card">
            <small>{t("labels.prayerStatus")}</small>
            <strong>{t(`status.${state.prayers?.status || "idle"}`)}</strong>
          </div>
        </section>

        {activeTab === "prayers" ? (
          <section className="panel prayer-list-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("labels.today")}</p>
                <h2>{t("labels.prayerList")}</h2>
              </div>
              <small>
                {t("labels.updatedAt")}:{" "}
                {state.prayers?.fetchedAt ? new Date(state.prayers.fetchedAt).toLocaleString() : t("labels.notFetched")}
              </small>
            </div>

            <div className="prayer-list">
              {PRAYER_KEYS.map((key) => (
                <article className={`prayer-card${nextPrayer?.key === key ? " is-next" : ""}`} key={key}>
                  <div className="prayer-card-top">
                    <strong>{t(`prayers.${key}`)}</strong>
                    <span>{formatClockTime(prayerItems[key])}</span>
                  </div>
                  <small>
                    {t("labels.timeLeft")}: {formatPrayerCountdown(prayerItems[key])}
                  </small>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "alerts" ? (
          <section className="panel alarms-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("labels.alarms")}</p>
                <h2>{t("labels.alarmsHeading")}</h2>
              </div>
              <button className="primary-button" type="button" onClick={openNewAlarmModal}>
                {t("actions.addNewAlarm")}
              </button>
            </div>

            <div className="alert-list">
              {sortedAlerts.length ? (
                sortedAlerts.map((alert) => (
                  <article className="alert-card" key={alert.id}>
                    <div className="alert-card-top">
                      <div className="alert-card-copy">
                        <strong>{alert.name}</strong>
                        <small className="alert-repeat">{getAlertWeekdayLabel(alert, t)}</small>
                      </div>
                      <strong className="alert-time-badge">{formatClockTime(alert.time)}</strong>
                    </div>
                    <small className="alert-date-line">
                      {alert.repeat === "once" ? formatDateReadable(alert.date) : t("labels.repeats")}
                    </small>
                    <div className="inline-actions alert-actions">
                      <button className="ghost-button" type="button" onClick={() => toggleAlertEnabled(alert.id)}>
                        {alert.enabled ? t("actions.disable") : t("actions.enable")}
                      </button>
                      <button className="ghost-button" type="button" onClick={() => editAlert(alert)}>
                        {t("actions.edit")}
                      </button>
                      <button className="ghost-button danger-button" type="button" onClick={() => removeAlert(alert.id)}>
                        {t("actions.remove")}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">{t("labels.noAlarms")}</div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "countdown" ? (
          <section className="panel stopwatch-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("labels.countdown")}</p>
                <h2>{t("labels.countdownHeading")}</h2>
              </div>
              <small>{t("labels.countdownHint")}</small>
            </div>

            <div className="stopwatch-display countdown-editor">
              <input
                className="countdown-part-input"
                type="number"
                min="0"
                value={countdownDisplayParts.hours}
                readOnly={Boolean(state.countdown?.runningSince)}
                onChange={(e) => updateCountdownDurationPart("hours", e.target.value)}
                aria-label={t("labels.hours")}
              />
              <span className="countdown-separator">:</span>
              <input
                className="countdown-part-input"
                type="number"
                min="0"
                max="59"
                value={countdownDisplayParts.minutes}
                readOnly={Boolean(state.countdown?.runningSince)}
                onChange={(e) => updateCountdownDurationPart("minutes", e.target.value)}
                aria-label={t("labels.minutes")}
              />
              <span className="countdown-separator">:</span>
              <input
                className="countdown-part-input"
                type="number"
                min="0"
                max="59"
                value={countdownDisplayParts.seconds}
                readOnly={Boolean(state.countdown?.runningSince)}
                onChange={(e) => updateCountdownDurationPart("seconds", e.target.value)}
                aria-label={t("labels.seconds")}
              />
            </div>

            <div className="inline-actions">
              {state.countdown?.runningSince ? (
                <button className="primary-button" type="button" onClick={pauseCountdown}>
                  {t("actions.pause")}
                </button>
              ) : (
                <button className="primary-button" type="button" onClick={startCountdown}>
                  {t("actions.start")}
                </button>
              )}
              <button className="ghost-button" type="button" onClick={resetCountdown}>
                {t("actions.reset")}
              </button>
            </div>

            <div className="lap-list">
              <div className="lap-row">
                <span>{t("labels.onFinish")}</span>
                <strong>{t("labels.normalAlarmAudio")}</strong>
              </div>
              <div className="lap-row">
                <span>{t("labels.countdownStatus")}</span>
                <strong>
                  {state.countdown?.runningSince
                    ? t("status.countdownRunning")
                    : activeCountdownRemaining === 0 && state.countdown?.finishedAt
                      ? t("status.countdownFinished")
                      : t("status.countdownReady")}
                </strong>
              </div>
            </div>
          </section>
        ) : null}

          </div>
        </div>

        {alarmModalOpen ? (
          <div className="modal-backdrop" onClick={resetAlertForm} role="presentation">
            <div className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
              <div className="section-heading modal-heading">
                <div>
                  <p className="eyebrow">{editingAlertId ? t("labels.editAlarm") : t("labels.newAlarm")}</p>
                  <h2>{editingAlertId ? t("labels.editAlarm") : t("labels.newAlarm")}</h2>
                </div>
              </div>

              <div className="form-grid">
                <input
                  value={alertDraft.name}
                  onChange={(e) => setAlertDraft((current) => ({ ...current, name: e.target.value }))}
                  placeholder={t("labels.alarmName")}
                />
                <div className="split-grid">
                  <input
                    type="date"
                    value={alertDraft.date}
                    onChange={(e) => setAlertDraft((current) => ({ ...current, date: e.target.value }))}
                  />
                  <input
                    type="time"
                    value={alertDraft.time}
                    onChange={(e) => setAlertDraft((current) => ({ ...current, time: e.target.value }))}
                  />
                </div>
                <select
                  value={alertDraft.repeat}
                  onChange={(e) =>
                    setAlertDraft((current) => ({
                      ...current,
                      repeat: e.target.value,
                      weekdays: e.target.value === "custom" ? current.weekdays : []
                    }))
                  }
                >
                  <option value="once">{t("repeat.once")}</option>
                  <option value="daily">{t("repeat.daily")}</option>
                  <option value="custom">{t("repeat.custom")}</option>
                </select>

                {alertDraft.repeat === "custom" ? (
                  <div className="weekday-grid">
                    {WEEKDAY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`weekday-pill${alertDraft.weekdays.includes(option.value) ? " is-active" : ""}`}
                        onClick={() => toggleAlertWeekday(option.value)}
                      >
                        {t(option.key)}
                      </button>
                    ))}
                  </div>
                ) : null}

                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={Boolean(alertDraft.enabled)}
                    onChange={(e) => setAlertDraft((current) => ({ ...current, enabled: e.target.checked }))}
                  />
                  {t("labels.alarmEnabled")}
                </label>

                <div className="inline-actions">
                  <button className="primary-button" type="button" onClick={saveAlert}>
                    {editingAlertId ? t("actions.saveChanges") : t("actions.addAlarm")}
                  </button>
                  <button className="ghost-button" type="button" onClick={resetAlertForm}>
                    {t("actions.cancel")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {settingsOpen ? (
          <div className="modal-backdrop" onClick={() => setSettingsOpen(false)} role="presentation">
            <div className="modal-card settings-modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
              <div className="section-heading modal-heading">
                <div>
                  <p className="eyebrow">{t("actions.settings")}</p>
                  <h2>{t("actions.settings")}</h2>
                </div>
              </div>

              <div className="settings-grid">
                <div className="settings-card settings-card-wide settings-top-card">
                  <div className="settings-top-grid">
                    <section className="settings-subpanel">
                      <p className="eyebrow">{t("labels.prayerSettings")}</p>
                      <div className="form-grid settings-form-two">
                        <input value={prayerSettings.lat} onChange={(e) => updateSetting("lat", e.target.value)} placeholder={t("labels.latitude")} />
                        <input value={prayerSettings.lon} onChange={(e) => updateSetting("lon", e.target.value)} placeholder={t("labels.longitude")} />
                        <input value={prayerSettings.gmt} onChange={(e) => updateSetting("gmt", e.target.value)} placeholder={t("labels.gmtMinutes")} />
                        <select value={prayerSettings.method} onChange={(e) => updateSetting("method", e.target.value)}>
                          <option value="1">{t("prayers.method_1")}</option>
                          <option value="2">{t("prayers.method_2")}</option>
                          <option value="3">{t("prayers.method_3")}</option>
                          <option value="4">{t("prayers.method_4")}</option>
                          <option value="5">{t("prayers.method_5")}</option>
                        </select>
                      </div>
                    </section>

                    <section className="settings-subpanel">
                      <p className="eyebrow">{t("labels.alertSettings")}</p>
                      <div className="form-grid">
                        <div className="setting-row-card">
                          <label className="checkline">
                            <input
                              type="checkbox"
                              checked={Boolean(prayerSettings.alarms.before?.enabled)}
                              onChange={(e) => updateAlarmSetting("before", "enabled", e.target.checked)}
                            />
                            {t("labels.beforePrayer")}
                          </label>
                          <input
                            value={prayerSettings.alarms.before?.minutes || ""}
                            onChange={(e) => updateAlarmSetting("before", "minutes", e.target.value)}
                            placeholder={t("labels.minutes")}
                          />
                        </div>
                        <div className="setting-row-card">
                          <label className="checkline">
                            <input
                              type="checkbox"
                              checked={Boolean(prayerSettings.alarms.onTime?.enabled)}
                              onChange={(e) => updateAlarmSetting("onTime", "enabled", e.target.checked)}
                            />
                            {t("labels.onPrayer")}
                          </label>
                        </div>
                        <div className="setting-row-card">
                          <label className="checkline">
                            <input
                              type="checkbox"
                              checked={Boolean(prayerSettings.alarms.after?.enabled)}
                              onChange={(e) => updateAlarmSetting("after", "enabled", e.target.checked)}
                            />
                            {t("labels.afterPrayer")}
                          </label>
                          <input
                            value={prayerSettings.alarms.after?.minutes || ""}
                            onChange={(e) => updateAlarmSetting("after", "minutes", e.target.value)}
                            placeholder={t("labels.minutes")}
                          />
                        </div>
                      </div>
                    </section>
                  </div>
                </div>

                <div className="settings-card settings-card-wide">
                  <p className="eyebrow">{t("labels.audioSettings")}</p>
                  <div className="form-grid audio-grid">
                    <div className="audio-block">
                      <div className="audio-row-head">
                        <span className="field-label">{t("labels.onPrayerAudio")}</span>
                        <button className="ghost-button small-button" type="button" onClick={() => void playAudioSource(prayerSettings.onTimeAudio, "prayer", true)}>
                          {t("actions.test")}
                        </button>
                      </div>
                      <input type="file" accept="audio/*" onChange={(e) => void handleAudioPick("onTimeAudio", "onTimeAudioName", "prayer", e)} />
                      <small>{t("labels.audioCurrent")}: {prayerSettings.onTimeAudioName || t("labels.noAudio")}</small>
                    </div>
                    <div className="audio-block">
                      <div className="audio-row-head">
                        <span className="field-label">{t("labels.beforePrayerAudio")}</span>
                        <button className="ghost-button small-button" type="button" onClick={() => void playAudioSource(prayerSettings.beforeAudio || prayerSettings.onTimeAudio, "prayer", true)}>
                          {t("actions.test")}
                        </button>
                      </div>
                      <input type="file" accept="audio/*" onChange={(e) => void handleAudioPick("beforeAudio", "beforeAudioName", "prayer", e)} />
                      <small>{t("labels.audioCurrent")}: {prayerSettings.beforeAudioName || t("labels.noAudio")}</small>
                    </div>
                    <div className="audio-block">
                      <div className="audio-row-head">
                        <span className="field-label">{t("labels.afterPrayerAudio")}</span>
                        <button className="ghost-button small-button" type="button" onClick={() => void playAudioSource(prayerSettings.afterAudio || prayerSettings.onTimeAudio, "prayer", true)}>
                          {t("actions.test")}
                        </button>
                      </div>
                      <input type="file" accept="audio/*" onChange={(e) => void handleAudioPick("afterAudio", "afterAudioName", "prayer", e)} />
                      <small>{t("labels.audioCurrent")}: {prayerSettings.afterAudioName || t("labels.noAudio")}</small>
                    </div>

                    <small className="settings-inline-note">{t("labels.audioStatus")}: {t(`status.${audioStatus.prayer}`)}</small>
                  </div>
                </div>

                <div className="settings-card settings-card-compact">
                  <p className="eyebrow">{t("labels.normalAlertAudio")}</p>
                  <div className="form-grid compact-audio-stack">
                    <div className="audio-block single-audio-block">
                      <div className="audio-row-head">
                        <span className="field-label">{t("labels.normalAlarmAudio")}</span>
                        <button className="ghost-button small-button" type="button" onClick={() => void playAudioSource(prayerSettings.normalAlertAudio, "normal", true)}>
                          {t("actions.test")}
                        </button>
                      </div>
                      <input type="file" accept="audio/*" onChange={(e) => void handleAudioPick("normalAlertAudio", "normalAlertAudioName", "normal", e)} />
                      <small>{t("labels.audioCurrent")}: {prayerSettings.normalAlertAudioName || t("labels.noAudio")}</small>
                      <small>{t("labels.audioStatus")}: {t(`status.${audioStatus.normal}`)}</small>
                    </div>
                  </div>
                </div>

                <div className="settings-card settings-card-compact">
                  <p className="eyebrow">{t("labels.layout")}</p>
                  <div className="form-grid compact-audio-stack">
                    <div className="setting-row-card setting-row-card-single">
                      <label className="checkline">
                        <input
                          type="checkbox"
                          checked={Boolean(prayerSettings.browserNotificationsEnabled)}
                          onChange={(e) => updateSetting("browserNotificationsEnabled", e.target.checked)}
                        />
                        {t("labels.notifications")}
                      </label>
                    </div>
                    <div className="setting-row-card setting-row-card-stack">
                      <button className="ghost-button" type="button" onClick={requestNotifications}>
                        {t("actions.enableNotifications")}
                      </button>
                      <small className="settings-inline-note settings-inline-note-plain">
                        {notificationPermission === "granted"
                          ? t("status.notificationReady")
                          : notificationPermission === "denied"
                            ? t("status.notificationBlocked")
                            : t("status.notificationUnsupported")}
                      </small>
                    </div>
                    <select value={locale} onChange={(e) => updateSetting("language", e.target.value)}>
                      {languageList.map((language) => (
                        <option key={language.code} value={language.code}>
                          {language.nativeName || language.name || language.code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <footer className="app-footer">
          <span className="app-footer-copy">© 2026 HussamGDev. All Rights Reserved. | v0.963</span>
          <a
            className="app-footer-support app-footer-coffee"
            href="https://www.buymeacoffee.com/hussamgdev"
            target="_blank"
            rel="noreferrer"
          >
            <span aria-hidden="true">☕</span>
            <span>Buy me a coffee</span>
          </a>
        </footer>
      </main>
    </div>
  );
}
