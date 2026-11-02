import { createApiClient } from "./http";
import { getToken, setToken, clearToken } from "./tokenStore";

export interface LoginResponse {
  session_id: string;
  token: string;
}

export async function login(
  baseUrl: string,
  username: string,
  password: string,
): Promise<LoginResponse> {
  const client = createApiClient(baseUrl);
  const response = await client.post<LoginResponse>("/auth/login", {
    username,
    password,
  });

  const token = response.data?.token;
  if (!token) throw new Error("Сервер не вернул токен");

  setToken(baseUrl, token);
  return response.data;
}

export function logout(baseUrl: string): void {
  clearToken(baseUrl);
}

export function isAuthenticated(baseUrl: string): boolean {
  return getToken(baseUrl) !== null;
}

export { getToken };