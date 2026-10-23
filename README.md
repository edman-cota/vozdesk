# VozDesk 🎙️📋

Sistema de gestión de tareas e issues con soporte de voz (integración futura con Custumu).

---

## ⚡ Guía Rápida: Cómo Correr Ambos Servidores

Necesitarás **dos terminales** abiertas simultáneamente (una para el frontend y otra para el backend):

### 🟢 Terminal 1: Frontend (React + Vite)
```powershell
cd c:\Users\edman\OneDrive\Escritorio\vozdesk\frontend

# 1. Instalar dependencias (solo la primera vez)
npm install

# 2. Iniciar servidor Vite
npm run dev
```
🌐 **URL Frontend:** [http://localhost:5174](http://localhost:5174) *(puerto 5174 para no chocar con Custumu en 5173)*

---

### 🟣 Terminal 2: Backend (Python + FastAPI)
```powershell
cd c:\Users\edman\OneDrive\Escritorio\vozdesk\backend

# 1. Crear entorno virtual (solo la primera vez)
python -m venv .venv

# 2. Activar entorno virtual
.venv\Scripts\activate

# 3. Instalar dependencias (solo la primera vez)
pip install -r requirements.txt

# 4. Iniciar servidor FastAPI
uvicorn app.main:app --reload --port 8001
```
⚡ **URL Backend:** [http://localhost:8001](http://localhost:8001)  
📖 **Documentación Swagger:** [http://localhost:8001/docs](http://localhost:8001/docs)  
🩺 **Healthcheck:** [http://localhost:8001/health](http://localhost:8001/health) *(puerto 8001 porque el 8000 lo usa Custumu-API)*

---

## 🔑 Variables de Entorno

Ambos servidores cuentan con sus archivos `.env` configurados:

* **Frontend:** `frontend/.env`
  ```ini
  VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
  VITE_API_URL=http://localhost:8001
  ```
* **Backend:** `backend/.env`
  ```ini
  SUPABASE_URL=https://TU_PROYECTO.supabase.co
  SUPABASE_SECRET_KEY=sb_secret_...
  CORS_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
  PORT=8001
  ```

---

## 🗄️ Base de Datos (Supabase)

Si aún no has corrido la migración en Supabase, copia y ejecuta en el **SQL Editor** de tu proyecto:
* Migración: [`supabase/migrations/20261023170000_initial_schema.sql`](file:///c:/Users/edman/OneDrive/Escritorio/vozdesk/supabase/migrations/20261023170000_initial_schema.sql)
* Referencia: [`supabase/tables.sql`](file:///c:/Users/edman/OneDrive/Escritorio/vozdesk/supabase/tables.sql)

Esto crea automáticamente las tablas (`profiles`, `workspaces`, `teams`, `issues`), las reglas de seguridad RLS, la numeración secuencial de issues por equipo y el trigger que da de alta el workspace y equipo por defecto al registrarte.

---

## 📂 Guías Específicas
* 📘 [Frontend README](file:///c:/Users/edman/OneDrive/Escritorio/vozdesk/frontend/README.md)
* 📙 [Backend README](file:///c:/Users/edman/OneDrive/Escritorio/vozdesk/backend/README.md)
