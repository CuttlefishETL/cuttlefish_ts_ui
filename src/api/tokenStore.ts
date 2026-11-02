const PREFIX = "cuttlefish.tokens.";
const LEGACY_KEY = "cuttlefish.token";

export function getToken(baseUrl: string): string | null {
  return localStorage.getItem(PREFIX + baseUrl);
}

export function setToken(baseUrl: string, token: string): void {
  localStorage.setItem(PREFIX + baseUrl, token);
}

export function clearToken(baseUrl: string): void {
  localStorage.removeItem(PREFIX + baseUrl);
}

export function clearAllTokens(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

/**
 * Удаляет старый единый ключ. Мигрировать нечего — из него нельзя понять,
 * какому серверу принадлежал токен, поэтому просто чистим.
 */
export function migrateLegacyToken(): void {
  if (localStorage.getItem(LEGACY_KEY)) {
    localStorage.removeItem(LEGACY_KEY);
  }
}