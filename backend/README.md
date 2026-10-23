# VozDesk · Backend (FastAPI) ⚡

Servidor backend desarrollado en **Python con FastAPI** para gestión de issues y autenticación con Supabase mediante verificación asimétrica **JWKS**.

---

## 🚀 Cómo correr el Backend (Paso a Paso)

### 1. Variables de Entorno (`.env`)
Verifica que exista el archivo `backend/.env` con tus claves de Supabase:

```ini
# backend/.env
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxx

CORS_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
PORT=8001
```

> **Importante:**
> - El puerto configurado es el **8001** (porque el 8000 lo utiliza Custumu-API).
> - Se usa la nueva **Secret key** de Supabase (`sb_secret_...`), que solo debe existir en el servidor.

### 2. Configurar Entorno Virtual e Instalar Dependencias
Abre una terminal en `backend`:

```powershell
cd c:\Users\edman\OneDrive\Escritorio\vozdesk\backend

# Crear el entorno virtual (solo la primera vez)
python -m venv .venv

# Activar el entorno virtual en Windows PowerShell
.venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
```

### 3. Iniciar el Servidor FastAPI
Con el entorno virtual activado (`(.venv)` en tu prompt):

```powershell
uvicorn app.main:app --reload --port 8001
```

O si prefieres ejecutar directamente el módulo:
```powershell
python -m app.main
```

El backend iniciará en:
👉 **`http://localhost:8001`**
* Documentación interactiva (Swagger UI): **`http://localhost:8001/docs`**
* Healthcheck: **`http://localhost:8001/health`**

---

## 💻 Cómo correr el Frontend (para conectar con el Backend)

Abre **otra terminal** y ejecuta:

```powershell
cd c:\Users\edman\OneDrive\Escritorio\vozdesk\frontend
npm install   # (solo la primera vez)
npm run dev
```

El frontend estará disponible en:
👉 **`http://localhost:5174`**

---

## 📡 Endpoints Disponibles en el Backend

| Método | Endpoint | Autenticación | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/health` | No | Estado del servicio (`{"status": "ok"}`). |
| `GET` | `/me` | **Bearer JWT** | Retorna el perfil y los workspaces del usuario actual. |
| `GET` | `/workspaces/{id}/teams` | **Bearer JWT** | Lista los equipos del workspace indicado. |
| `POST` | `/issues` | **Bearer JWT** | Crea un issue (por defecto `source='voice'`) asignando automáticamente número secuencial por equipo. |

---

## 🔒 Arquitectura de Seguridad
1. **Validación JWT con JWKS:** Los tokens de acceso se validan contra el endpoint público de claves de Supabase (`/auth/v1/.well-known/jwks.json`) usando claves asimétricas `ES256` y `RS256`, con caché en memoria.
2. **Cliente Admin PostgREST:** Para operaciones de backend se utiliza la secret key en el encabezado `apikey`, validando previamente la pertenencia del usuario al workspace antes de realizar inserciones o consultas.
