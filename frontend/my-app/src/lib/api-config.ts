/**
 * Configuración centralizada para la URL base de la API
 * 
 * En desarrollo: usa http://127.0.0.1:8000 (localhost)
 * En producción: usa la URL de Railway desde NEXT_PUBLIC_API_URL
 * 
 * Para configurar en Netlify:
 * - Ve a Site settings > Environment variables
 * - Agrega: NEXT_PUBLIC_API_URL = https://guapotrajes-production.up.railway.app
 */

export const getApiBaseUrl = (): string => {
  // En producción, usa la variable de entorno
  if (typeof window !== 'undefined') {
    // Cliente: usa la variable de entorno o localhost por defecto
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl) {
      return envUrl.replace(/\/$/, ''); // Remueve trailing slash
    }
    return 'http://127.0.0.1:8000';
  }
  
  // Servidor: usa la variable de entorno o localhost por defecto
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }
  return 'http://127.0.0.1:8000';
};

// Exporta la URL base directamente para uso en componentes
export const API_BASE = getApiBaseUrl();

