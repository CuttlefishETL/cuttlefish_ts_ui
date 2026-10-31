import axios from "axios";

let configured = false;

export function setupAxios() {
  if (configured) return;
  configured = true;

  axios.interceptors.request.use((config) => {
    const token = localStorage.getItem("cuttlefish.token");
    if (token) {
      config.headers = config.headers ?? {};
      // AxiosHeaders позволяет присваивать через set, но и обычное свойство работает
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        console.warn("Токен истёк или недействителен");
        // опционально: logout(), показать AuthDialog и т.д.
      }
      return Promise.reject(error);
    }
  );
}