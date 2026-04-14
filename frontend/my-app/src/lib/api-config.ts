/**
 * Configuración centralizada para la URL base de la API
 *
 * - En desarrollo (next dev): siempre http://127.0.0.1:8000 salvo NEXT_PUBLIC_API_URL.
 * - Build producción: localhost/127.0.0.1 → API local; otro host → URL de producción.
 * - En producción o si definís NEXT_PUBLIC_API_URL: usa esa URL (ej. https://guapotrajes.onrender.com).
 *
 * Para forzar otro backend: define NEXT_PUBLIC_API_URL en .env.local (ej. http://127.0.0.1:8000).
 */

const API_BASE_PRODUCTION = 'https://guapotrajes.onrender.com';
const API_BASE_LOCAL = 'http://127.0.0.1:8000';

export const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }
  // next dev: siempre API local aunque abras el front por IP/LAN (0.0.0.0),
  // si no el front apuntaba a producción y el login parecía "colgado".
  if (process.env.NODE_ENV === 'development') {
    return API_BASE_LOCAL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location?.hostname ?? '';
    if (host === 'localhost' || host === '127.0.0.1') {
      return API_BASE_LOCAL;
    }
  }
  return API_BASE_PRODUCTION;
};

// Exporta la URL base directamente para uso en componentes
export const API_BASE = getApiBaseUrl();

