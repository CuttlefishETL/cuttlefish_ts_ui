import axios, { type AxiosRequestConfig } from "axios";

export const AXIOS_INSTANCE = axios.create({
  headers: { "Content-Type": "application/json" },
});

AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = localStorage.getItem("cuttlefish.token");
  if (token) {
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<T> => {
  return AXIOS_INSTANCE({ ...config, ...options }).then(({ data }) => data);
};