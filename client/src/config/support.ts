/**
 * Soporte configurable vía variables de entorno (Vite).
 * Ejemplo en .env: VITE_SUPPORT_EMAIL=soporte@ejemplo.com
 */
export const supportConfig = {
  email: import.meta.env.VITE_SUPPORT_EMAIL as string | undefined,
  whatsapp: import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined,
  url: import.meta.env.VITE_SUPPORT_URL as string | undefined,
};

export function hasSupport(): boolean {
  return !!(supportConfig.email || supportConfig.whatsapp || supportConfig.url);
}
