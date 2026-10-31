import { apiClient } from "./http";

interface LoginResponse {
  access_token: string;
  // возможно, другие поля
}

export async function login(
  baseUrl: string,
  username: string,
  password: string
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(
    `${baseUrl}/api/admin/login`,
    { username, password }
  );
  return response.data;
}

export function logout() {
  localStorage.removeItem("cuttlefish.token");
}

export function getToken(): string | null {
  return localStorage.getItem("cuttlefish.token");
}
