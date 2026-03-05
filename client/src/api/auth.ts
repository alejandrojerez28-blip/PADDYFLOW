/**
 * API auth helper — centraliza lectura/escritura del token.
 * Usa sessionStorage (mitigación XSS vs localStorage).
 * Migración a cookie HttpOnly planificada.
 */
const TOKEN_KEY = 'paddyflow_token';

export function getAuthToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthHeaders(): { Authorization?: string } {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
