export type CheckStatus = "unknown" | "checking" | "ok" | "error";

export interface CheckResult {
  status: "ok" | "error";
  message: string;
}

/**
 * Симуляция проверки соединения.
 * Замените на invoke("test_connection", { url, port }) из Rust.
 */
export async function checkConnection(
  url: string,
  port: number
): Promise<CheckResult> {
  await new Promise((r) => setTimeout(r, 500));
  if (!url.trim()) return { status: "error", message: "URL не задан" };
  if (!/^https?:\/\//i.test(url)) {
    return { status: "error", message: "URL должен начинаться с http:// или https://" };
  }
  if (port < 1 || port > 65535) {
    return { status: "error", message: "Некорректный порт (1–65535)" };
  }
  return {
    status: "ok",
    message: `Соединение с ${url}:${port} успешно (симуляция)`,
  };
}