export interface AppSettings {
  /** Автоматически отправлять скрипт на сервер при запуске отладки */
  autoSendScriptOnRun: boolean;
  /** Период опроса health серверов, секунды */
  healthPollIntervalSec: number;
}

const KEY = "app-settings";

export const MIN_HEALTH_INTERVAL = 1;
export const MAX_HEALTH_INTERVAL = 3600;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  autoSendScriptOnRun: false,
  healthPollIntervalSec: 30,
};

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    const parsed = JSON.parse(raw);
    const n = Number(parsed.healthPollIntervalSec);
    return {
      autoSendScriptOnRun: !!parsed.autoSendScriptOnRun,
      healthPollIntervalSec: Number.isFinite(n)
        ? Math.min(
            MAX_HEALTH_INTERVAL,
            Math.max(MIN_HEALTH_INTERVAL, Math.floor(n))
          )
        : DEFAULT_APP_SETTINGS.healthPollIntervalSec,
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export function saveAppSettings(s: AppSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}