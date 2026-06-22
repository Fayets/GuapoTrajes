# Configuración para Deploy en Netlify

## Variables de Entorno

Por defecto el frontend apunta al backend en **Render** (`https://guapotrajes.onrender.com`). Si quieres usar otra URL, configura la variable de entorno `NEXT_PUBLIC_API_URL`.

### Configuración en Netlify

1. Ve a tu sitio en Netlify
2. Navega a **Site settings** > **Environment variables**
3. Opcional: si quieres cambiar la URL del API, agrega:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://guapotrajes.onrender.com` (o la URL de tu backend)

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

Por defecto el frontend apunta a `https://guapotrajes.onrender.com`. Para usar tu backend local, crea un archivo `.env.local` en la raíz del proyecto `frontend/my-app/` con:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

## Cómo Funciona

El sistema usa un archivo centralizado de configuración (`src/lib/api-config.ts`) que:
- Por defecto usa `https://guapotrajes.onrender.com` (backend en Render)
- Si defines `NEXT_PUBLIC_API_URL` (en Netlify o en `.env.local`), usa esa URL

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
