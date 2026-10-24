# 🤖 Servidor MCP de VozDesk (Model Context Protocol)

Este servidor permite a cualquier agente de Inteligencia Artificial (**Claude Desktop, Cursor, Custumu o asistentes por voz**) interactuar directamente con tu sistema de tareas y proyectos de **VozDesk**.

---

## 🛠️ Herramientas Disponibles (Tools)

| Herramienta | Parámetros | Descripción |
| :--- | :--- | :--- |
| **`get_my_context`** | *(ninguno)* | Retorna los workspaces y equipos disponibles para el usuario. |
| **`list_issues`** | `team_key` (opcional), `status` (opcional), `priority` (opcional), `limit` (default: 50) | Lista y filtra tareas por equipo, estado (`backlog`, `todo`, `in_progress`, `in_review`, `done`, `canceled`) o prioridad (0 a 4). |
| **`get_issue`** | `identifier` (ej: `"CUS-1"`) | Obtiene todos los detalles de un issue específico. |
| **`create_issue`** | `team_key` (ej: `"CUS"`), `title`, `description` (opcional), `status`, `priority`, `due_date`, `source` | Crea una nueva tarea asignándole automáticamente número secuencial en la base de datos. |
| **`update_issue`** | `identifier` (ej: `"CUS-1"`), `title`, `description`, `status`, `priority`, `due_date` | Modifica cualquier campo de una tarea existente. |
| **`close_issue`** | `identifier` (ej: `"CUS-1"`) | Marca rápidamente un issue como completado (`done`). |
| **`delete_issue`** | `identifier` (ej: `"CUS-1"`) | Elimina permanentemente un issue. |
| **`list_teams`** | `workspace_id` (opcional) | Lista todos los equipos y sus claves registradas en VozDesk. |
| **`list_projects`** | `workspace_id` (opcional) | Lista proyectos del workspace. |

---

## 📚 Recursos y Prompts Expuestos

* **Recurso `vozdesk://teams`:** Devuelve en markdown un resumen de los equipos y su cantidad de issues activos.
* **Prompt `triage_issue`:** Estructura notas de voz o mensajes libres en un issue profesional con severidad y pasos detallados.

---

## 💻 1. Conexión Local (Claude Desktop o Cursor)

Puedes conectar el servidor localmente a través de **Stdio** para usarlo en Claude Desktop o Cursor:

### Configuración en `claude_desktop_config.json`:
*(Ubicación en Windows: `%APPDATA%\Claude\claude_desktop_config.json`)*

```json
{
  "mcpServers": {
    "vozdesk": {
      "command": "python",
      "args": [
        "-m",
        "app.mcp.server"
      ],
      "cwd": "c:\\Users\\edman\\OneDrive\\Escritorio\\vozdesk\\backend",
      "env": {
        "SUPABASE_URL": "https://nwvlwvqlrtqdocqbdojw.supabase.co",
        "SUPABASE_SECRET_KEY": "sb_secret_TU_SECRET_KEY"
      }
    }
  }
}
```

---

## 🌐 2. Conexión Remota / HTTP (Para Custumu o Agentes en la Nube)

El servidor monta el protocolo MCP estándar mediante **HTTP Stateless / Streamable HTTP (JSON-RPC 2.0)**, idéntico a servidores como Cal.com y Wudlet:

* **En local:**
  👉 `http://localhost:8001/mcp`
* **En producción (Render):**
  👉 `https://vozdesk-api.onrender.com/mcp`

### Métodos JSON-RPC 2.0 Soportados en `POST /mcp`:
1. **`initialize`**: Retorna capacidades del servidor (`tools`, `resources`, `prompts`) y versión del protocolo.
2. **`tools/list`**: Devuelve todas las herramientas, sus esquemas (`inputSchema`) y descripciones para que el cliente (Custumu) las muestre y permita activarlas/desactivarlas.
3. **`tools/call`**: Ejecuta la herramienta solicitada con sus argumentos y retorna el resultado.
4. **`ping`** y **`notifications/initialized`**: Heartbeat y confirmación de inicio de sesión.

### Endpoints de Inspección Directa (GET):
* `GET /mcp`: Retorna estado del servidor y resumen de herramientas.
* `GET /mcp/tools`: Retorna directamente el listado de herramientas en formato JSON.
