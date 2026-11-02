export type CheckStatus = "unknown" | "checking" | "ok" | "error";

export interface CheckResult {
  status: "ok" | "error";
  message: string;
}

const HEALTH_TIMEOUT_MS = 5000;

/**
 * Приводит пару (url, port) к виду http(s)://host:port.
 * Схема по умолчанию — http. Порт из url имеет приоритет над параметром port.
 * Бросает Error, если URL собрать не удалось.
 */
export function buildBaseUrl(url: string, port: number): string {
  const trimmed = url.trim().replace(/\/$/, "");
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  const u = new URL(withScheme);
  if (!u.port) u.port = String(port);
  return u.origin; // отбрасывает path/query, оставляет scheme://host:port
}

export async function checkConnection(
  url: string,
  port: number,
): Promise<CheckResult> {
  if (!url.trim()) {
    return { status: "error", message: "URL не задан" };
  }
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return { status: "error", message: "Некорректный порт (1–65535)" };
  }

  let base: string;
  try {
    base = buildBaseUrl(url, port);
  } catch {
    return { status: "error", message: `Некорректный URL: ${url}` };
  }

  const healthUrl = `${base}/health`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const res = await fetch(healthUrl, {
      method: "GET",
      signal: controller.signal,
      credentials: "omit",
    });

    if (!res.ok) {
      return {
        status: "error",
        message: `Сервер ответил HTTP ${res.status} на ${healthUrl}`,
      };
    }

    return { status: "ok", message: `Соединение с ${base} успешно` };
  } catch (e) {
    const err = e as Error;
    if (err.name === "AbortError") {
      return {
        status: "error",
        message: `Таймаут ${HEALTH_TIMEOUT_MS} мс: ${healthUrl}`,
      };
    }
    return {
      status: "error",
      message: `Не удалось подключиться: ${err.message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}