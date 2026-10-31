import axios from "axios";

export const apiClient = axios.create({
  // Базовый URL будет подставляться динамически для каждого сервера
  headers: { "Content-Type": "application/json" },
});

// Интерсептор запроса: добавляем JWT, если он есть
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("cuttlefish.token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Интерсептор ответа: обрабатываем 401 (например, редирект на логин)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Здесь можно инициировать разлогин или показать диалог
      console.warn("Токен истёк или недействителен");
    }
    return Promise.reject(error);
  }
);
