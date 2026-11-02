import axios, { type AxiosInstance } from "axios";

export const TOKEN_KEY = "cuttlefish.token";

/**
 * Создаёт axios-клиент, привязанный к конкретному серверу.
 * Интерсепторы (JWT + 401) навешиваются на каждый клиент.
 */
export function createApiClient(baseURL = ""): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
  });

  client.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        console.warn("Токен истёк или недействителен");
        // TODO: logout / redirect / показать диалог
      }
      return Promise.reject(error);
    },
  );

  return client;
}

/** Дефолтный клиент для случаев, когда baseURL подставляется в самом запросе. */
export const apiClient = createApiClient();