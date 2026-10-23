# 🚀 Guía de Despliegue en Producción: VozDesk

Frontend alojado en **Cloudflare Pages** (100% gratuito, CDN global) y Backend alojado en **Render** (100% gratuito, Python/FastAPI), conectados a tu base de datos **Supabase**.

---

## 📑 Índice de Pasos

1. [Paso 1: Subir el código a GitHub](#paso-1-subir-el-código-a-github)
2. [Paso 2: Desplegar el Backend en Render](#paso-2-desplegar-el-backend-en-render)
3. [Paso 3: Desplegar el Frontend en Cloudflare Pages](#paso-3-desplegar-el-frontend-en-cloudflare-pages)
4. [Paso 4: Conectar Supabase Auth y CORS (2 minutos)](#paso-4-conectar-supabase-auth-y-cors-2-minutos)

---

## Paso 1: Subir el código a GitHub

El archivo `.gitignore` raíz ya está configurado para **proteger tus archivos `.env`**, `node_modules` y `.venv`, de modo que ninguna clave privada se suba a GitHub.

Abre PowerShell en la raíz del proyecto (`c:\Users\edman\OneDrive\Escritorio\vozdesk`):

```powershell
cd c:\Users\edman\OneDrive\Escritorio\vozdesk

# 1. Inicializar git
git init

# 2. Agregar todos los archivos (tus .env están protegidos por .gitignore)
git add .

# 3. Confirmar que .env NO esté en el staging
git status
# Verás que frontend/.env y backend/.env NO aparecen en verde

# 4. Crear el commit
git commit -m "feat: setup VozDesk with Cloudflare Pages and Render support"

# 5. Crear la rama principal
git branch -M main
```

Ahora crea un repositorio en tu cuenta de [GitHub](https://github.com/new) (por ejemplo `vozdesk`), y enlázalo:

```powershell
# Reemplaza con la URL de tu repositorio en GitHub
git remote add origin https://github.com/TU_USUARIO/vozdesk.git
git push -u origin main
```

---

## Paso 2: Desplegar el Backend en Render

Render ejecutará tu API de FastAPI en Python. Ya dejamos listo un archivo [`render.yaml`](file:///c:/Users/edman/OneDrive/Escritorio/vozdesk/render.yaml) para configurar todo automáticamente.

### Opción A (Recomendada - Con `render.yaml`):
1. Inicia sesión en [render.com](https://dashboard.render.com/).
2. Haz clic en **New +** y selecciona **Blueprint**.
3. Conecta tu repositorio de GitHub `vozdesk`.
4. Render detectará automáticamente el archivo `render.yaml` con toda la configuración:
   - Root directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Healthcheck: `/health`
5. Introduce las dos variables que te solicitará:
   - `SUPABASE_URL`: `https://TU_PROYECTO.supabase.co`
   - `SUPABASE_SECRET_KEY`: `sb_secret_TU_SECRET_KEY`
6. Haz clic en **Apply**.

### Opción B (Manual si no usas Blueprint):
1. En Render Dashboard, haz clic en **New +** -> **Web Service**.
2. Selecciona tu repositorio `vozdesk`.
3. Completa los campos:
   * **Name:** `vozdesk-api`
   * **Root Directory:** `backend`
   * **Runtime:** `Python 3`
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   * **Instance Type:** `Free`
4. En la sección **Environment Variables**, añade:
   * `SUPABASE_URL` = `https://TU_PROYECTO.supabase.co`
   * `SUPABASE_SECRET_KEY` = `sb_secret_TU_SECRET_KEY`
   * `CORS_ORIGINS` = `http://localhost:5174`
5. Haz clic en **Create Web Service**.

> ⏳ Una vez desplegado, Render te dará una URL (ejemplo: `https://vozdesk-api.onrender.com`).
> Puedes probar que funcione entrando a `https://vozdesk-api.onrender.com/health` (debe responder `{"status":"ok","service":"vozdesk-api"}`).

---

## Paso 3: Desplegar el Frontend en Cloudflare Pages

Cloudflare Pages ofrece hosting estático ultrarrápido con CDN ilimitado. Ya creamos el archivo `frontend/public/_redirects` para que al recargar la página en rutas como `/team/WUD/issues` o `/login` no dé error 404.

1. Inicia sesión en [dash.cloudflare.com](https://dash.cloudflare.com/).
2. En el menú lateral izquierdo ve a **Workers & Pages** -> **Create application** -> Pestaña **Pages** -> **Connect to Git**.
3. Selecciona tu repositorio de GitHub `vozdesk` y pulsa **Begin setup**.
4. Configura los parámetros de build:
   * **Project name:** `vozdesk`
   * **Production branch:** `main`
   * **Framework preset:** `Vite` (o déjalo en blanco)
   * **Root directory:** `frontend` *(¡Muy importante poner `frontend`!)*
   * **Build command:** `npm run build`
   * **Build output directory:** `dist`
5. Despliega la sección **Environment variables** y añade:
   * `NODE_VERSION` = `20`
   * `VITE_SUPABASE_URL` = `https://TU_PROYECTO.supabase.co`
   * `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_TU_PUBLISHABLE_KEY`
   * `VITE_API_URL` = `https://vozdesk-api.onrender.com` *(La URL que obtuviste en el Paso 2)*
6. Haz clic en **Save and Deploy**.

> 🌐 En menos de 1 minuto tendrás tu frontend publicado en una URL como:
> `https://vozdesk.pages.dev`

---

## Paso 4: Conectar Supabase Auth y CORS (2 minutos)

Para que el login con Google/Email y las llamadas a la API funcionen al 100% en producción:

### 1. Configurar Supabase Auth
1. Ve a tu Supabase Dashboard -> **Authentication** -> **URL Configuration**.
2. Entra a **Authentication** -> **URL Configuration**.
3. En **Site URL**, coloca la URL de tu frontend de Cloudflare Pages:
   ```
   https://vozdesk.pages.dev
   ```
4. En **Redirect URLs**, añade:
   ```
   https://vozdesk.pages.dev/**
   ```
5. Guarda los cambios.

### 2. Verificar CORS en Render
En el código de `backend/app/config.py` ya dejamos configurado el regex:
```python
cors_origin_regex = r"^https://.*\.pages\.dev$"
```
Por lo tanto, **cualquier dominio `.pages.dev` (incluyendo vistas previas de ramas) está automáticamente autorizado**.
Si en el futuro compras un dominio personalizado (ej. `app.vozdesk.com`), simplemente añade en las variables de Render:
```ini
CORS_ORIGINS=https://app.vozdesk.com,http://localhost:5174
```

---

## 🎯 Resumen de Arquitectura en Producción

```
           [ Usuario en el Navegador ]
                        │
                        ▼
       [ Cloudflare Pages: https://vozdesk.pages.dev ]
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
[ Supabase Auth & DB ]      [ Render: https://vozdesk-api.onrender.com ]
  - Postgres RLS              - FastAPI (Python 3.12)
  - Realtime WebSocket        - Valida JWT asimétrico vía JWKS
  - Login Google / Email      - POST /issues con source 'voice'
```
