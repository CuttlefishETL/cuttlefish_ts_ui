import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { getToken, clearToken } from "./tokenStore";

function resolveServerKey(
  config: InternalAxiosRequestConfig | undefined,
): string {
  if (!config) return "";
  if (config.baseURL) return config.baseURL;
  const url = config.url ?? "";
  if (/^https?:\/\//i.test(url)) {
    try {
      return new URL(url).origin;
    } catch {
      return "";
    }
  }
  return "";
}

export function createApiClient(baseURL = ""): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
  });

  client.interceptors.request.use((config) => {
    const key = resolveServerKey(config);
    const token = key ? getToken(key) : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (r) => r,
    (error) => {
      const key = resolveServerKey(error.config);
      if (!key) return Promise.reject(error);

      // 401 — токен невалиден
      if (error.response?.status === 401) {
        clearToken(key);
        window.dispatchEvent(
          new CustomEvent("auth:expired", { detail: { baseUrl: key } }),
        );
        return Promise.reject(error);
      }

      // Сетевая ошибка: сервер не ответил, отказ соединения, таймаут.
      // Отмена через AbortController — это НЕ потеря связи (UI сам её вызвал).
      const isCancel =
        error.code === "ERR_CANCELED" || error.name === "CanceledError";

      if (!error.response && !isCancel) {
        clearToken(key);
        window.dispatchEvent(
          new CustomEvent("auth:expired", {
            detail: {
              baseUrl: key,
              reason: error.code === "ECONNABORTED" ? "timeout" : "network",
            },
          }),
        );
      }

      return Promise.reject(error);
    },
  );

  return client;
}

/** Дефолтный клиент для запросов с абсолютным URL в config.url. */
export const apiClient = createApiClient();