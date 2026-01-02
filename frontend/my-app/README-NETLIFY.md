# Configuración para Deploy en Netlify

## Variables de Entorno

Para que el frontend apunte al backend en Railway cuando esté deployado en Netlify, necesitas configurar la variable de entorno `NEXT_PUBLIC_API_URL`.

### Configuración en Netlify

1. Ve a tu sitio en Netlify
2. Navega a **Site settings** > **Environment variables**
3. Agrega la siguiente variable:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://guapotrajes-production.up.railway.app`

### Desarrollo Local

Para desarrollo local, el sistema usará automáticamente `http://127.0.0.1:8000` si no se define la variable `NEXT_PUBLIC_API_URL`.

Si quieres usar el backend de Railway en local también, puedes crear un archivo `.env.local` en la raíz del proyecto `frontend/my-app/` con:

```
NEXT_PUBLIC_API_URL=https://guapotrajes-production.up.railway.app
```

## Cómo Funciona

El sistema usa un archivo centralizado de configuración (`src/lib/api-config.ts`) que:
- En producción (Netlify): usa la variable de entorno `NEXT_PUBLIC_API_URL` si está definida
- En desarrollo: usa `http://127.0.0.1:8000` por defecto si no hay variable de entorno

Todos los endpoints del frontend ahora usan esta configuración centralizada, por lo que solo necesitas configurar la variable de entorno una vez en Netlify.

