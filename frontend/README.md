# VozDesk · Frontend 💻

Aplicación web desarrollada en **React 19 + Vite**, estilizada con **Tailwind CSS v4** y componentes **shadcn**, diseñada en modo oscuro al estilo Linear.

---

## 🚀 Cómo correr el Frontend (Paso a Paso)

### 1. Variables de Entorno (`.env`)
Asegúrate de que exista el archivo `frontend/.env` con tus claves de Supabase y la URL del backend:

```ini
# frontend/.env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
VITE_API_URL=http://localhost:8001
```

> **Nota:** Se utiliza la nueva **Publishable key** (`sb_publishable_...`), no la anon key antigua.

### 2. Instalar Dependencias (si no lo has hecho)
Abre una terminal en la carpeta `frontend`:
```powershell
cd c:\Users\edman\OneDrive\Escritorio\vozdesk\frontend
npm install
```

### 3. Iniciar el Servidor de Desarrollo
```powershell
npm run dev
```

El frontend iniciará en:
👉 **`http://localhost:5174`**
*(Configurado en el puerto `5174` para evitar conflictos con Custumu en el puerto `5173`)*

---

## 🛠️ Cómo correr el Backend (para que se comuniquen)

Abre **otra terminal** y ejecuta:

```powershell
cd c:\Users\edman\OneDrive\Escritorio\vozdesk\backend
# Crear entorno virtual (solo la primera vez)
python -m venv .venv
.venv\Scripts\activate

# Instalar dependencias (solo la primera vez)
pip install -r requirements.txt

# Iniciar backend en puerto 8001
uvicorn app.main:app --reload --port 8001
```

El backend responderá en:
👉 **`http://localhost:8001`** (Healthcheck: `http://localhost:8001/health`)

---

## 📋 Comandos Disponibles en Frontend

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo Vite en el puerto `5174` con Hot Module Replacement (HMR). |
| `npm run build` | Compila los assets de producción optimizados en la carpeta `dist/`. |
| `npm run preview` | Previsualiza el build de producción localmente. |
| `npm run lint` | Ejecuta Oxlint para validar la sintaxis y reglas de React. |

---

## 🎨 Características de la Interfaz

* **Sidebar interactivo:** Selector de workspace, buscador rápido, navegación principal (`Inbox`, `My issues`, `Agent`), secciones colapsables (`Workspace`, `Your teams`, `Try`) y tarjeta *"What's new"*.
* **Panel Principal Flotante:** Panel central elevado con margen exterior, esquinas redondeadas (`rounded-xl`) y sombra suave.
* **Vistas de Issues:** Pestañas `Active`, `Backlog`, `All issues` con agrupación visual por estado, cambio de estado inline y soporte de Supabase Realtime.
* **Barra Inferior Flotante:** Accesos directos externos a `Agent` e `Historial`.
* **Login completo:** Soporta Email + Contraseña y Google OAuth con flujo PKCE.
