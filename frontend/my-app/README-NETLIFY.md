# Configuración para Deploy en Netlify

## Variables de Entorno

Para que el frontend apunte al backend en Railway cuando esté deployado en Netlify, necesitas configurar la variable de entorno `NEXT_PUBLIC_API_URL`.

### Configuración en Netlify

1. Ve a tu sitio en Netlify
2. Navega a **Site settings** > **Environment variables**
3. Agrega la siguiente variable:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://guapotrajes-production.up.railway.app`

### Configuración de Build en Netlify

Asegúrate de que en **Site settings** > **Build & deploy** > **Build settings** tengas:

- **Base directory**: `frontend/my-app` (si tu repo tiene la estructura completa) o deja vacío si ya estás en el directorio correcto
- **Build command**: `npm run build` (o deja que use el netlify.toml)
- **Publish directory**: `.next` (el plugin de Next.js lo maneja automáticamente)

### Instalación del Plugin de Next.js

El archivo `netlify.toml` ya está configurado con el plugin `@netlify/plugin-nextjs`. Este plugin se instalará automáticamente durante el build, pero si tienes problemas, puedes instalarlo manualmente:

```bash
npm install --save-dev @netlify/plugin-nextjs
```

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

## Solución de Problemas

### Error "Page Not Found"

Si ves "Page Not Found" después del deploy:

1. Verifica que el plugin `@netlify/plugin-nextjs` esté instalado (se instala automáticamente)
2. Asegúrate de que el **Base directory** en Netlify esté configurado correctamente
3. Verifica que el archivo `netlify.toml` esté en la raíz del directorio de build
4. Revisa los logs de build en Netlify para ver si hay errores

### El sitio redirige a /login

Esto es normal. La página principal (`/`) redirige automáticamente a `/login` para autenticación.
