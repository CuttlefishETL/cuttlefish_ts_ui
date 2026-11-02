import { apiClient } from "./http";

interface LoginResponse {
  session_id: string;
  token: string;
}

const TOKEN_KEY = "cuttlefish.token";

export async function login(
  baseUrl: string,
  username: string,
  password: string,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(
    `${baseUrl}/auth/login`,
    { username, password },
  );

  const { token } = response.data ?? {};
  if (!token) {
    throw new Error("Сервер не вернул токен");
  }

  localStorage.setItem(TOKEN_KEY, token);
  return response.data;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}