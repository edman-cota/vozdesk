"""Servidor MCP para VozDesk.

Permite a agentes de IA (Claude Desktop, Cursor, Custumu) gestionar tareas e issues.
Compatible con mcp v1 y v2 (MCPServer / FastMCP).
"""

from typing import Any

try:
    from mcp.server.mcpserver import MCPServer as FastMCP
except ImportError:
    from mcp.server.fastmcp import FastMCP  # type: ignore

from app.mcp import tools

# Instancia del servidor MCP
mcp = FastMCP("VozDesk")


@mcp.tool()
async def get_my_context() -> dict[str, Any]:
    """Obtiene el contexto actual del usuario: sus workspaces y equipos (teams)."""
    workspaces = await tools.list_workspaces()
    teams = await tools.list_teams()
    return {"workspaces": workspaces, "teams": teams}


@mcp.tool()
async def list_issues(
    team_key: str | None = None,
    status: str | None = None,
    priority: int | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Lista y busca issues en VozDesk.

    Opciones de filtro:
    - team_key: Clave del equipo (ej: 'WUD').
    - status: 'backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled'.
    - priority: 0 (ninguna), 1 (urgente), 2 (alta), 3 (media), 4 (baja).
    - limit: Máximo número de resultados (default: 50).
    """
    return await tools.list_issues(team_key=team_key, status=status, priority=priority, limit=limit)


@mcp.tool()
async def get_issue(identifier: str) -> dict[str, Any]:
    """Obtiene la información completa de un issue mediante su identificador único (ej: 'WUD-5')."""
    return await tools.get_issue(identifier=identifier)


@mcp.tool()
async def create_issue(
    team_key: str,
    title: str,
    description: str | None = None,
    status: str = "backlog",
    priority: int = 0,
    due_date: str | None = None,
    source: str = "voice",
) -> dict[str, Any]:
    """Crea una nueva tarea o issue en el equipo indicado.

    - team_key: Clave del equipo (ej: 'WUD').
    - title: Título del issue.
    - description: Descripción detallada o contexto.
    - status: 'backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled'.
    - priority: 0 (ninguna), 1 (urgente), 2 (alta), 3 (media), 4 (baja).
    - due_date: Fecha de vencimiento formato 'YYYY-MM-DD' (opcional).
    - source: 'voice' si proviene de un comando de voz, o 'manual'.
    """
    return await tools.create_issue(
        team_key=team_key,
        title=title,
        description=description,
        status=status,
        priority=priority,
        due_date=due_date,
        source=source,
    )


@mcp.tool()
async def update_issue(
    identifier: str,
    title: str | None = None,
    description: str | None = None,
    status: str | None = None,
    priority: int | None = None,
    due_date: str | None = None,
) -> dict[str, Any]:
    """Actualiza uno o varios campos de un issue existente (ej: identifier='WUD-5')."""
    return await tools.update_issue(
        identifier=identifier,
        title=title,
        description=description,
        status=status,
        priority=priority,
        due_date=due_date,
    )


@mcp.tool()
async def close_issue(identifier: str) -> dict[str, Any]:
    """Marca un issue como completado ('done') dado su identificador (ej: 'WUD-5')."""
    return await tools.update_issue(identifier=identifier, status="done")


@mcp.tool()
async def delete_issue(identifier: str) -> dict[str, str]:
    """Elimina permanentemente un issue dado su identificador (ej: 'WUD-5')."""
    return await tools.delete_issue(identifier=identifier)


@mcp.tool()
async def list_teams(workspace_id: str | None = None) -> list[dict[str, Any]]:
    """Lista todos los equipos registrados en VozDesk."""
    return await tools.list_teams(workspace_id=workspace_id)


@mcp.tool()
async def list_projects(workspace_id: str | None = None) -> list[dict[str, Any]]:
    """Lista todos los proyectos registrados en VozDesk."""
    return await tools.list_projects(workspace_id=workspace_id)


# ---------------------------------------------------------------------------
# Resources (Lectura directa para agentes)
# ---------------------------------------------------------------------------
@mcp.resource("vozdesk://teams")
async def resource_teams() -> str:
    """Documento de texto con la lista de equipos disponibles."""
    teams = await tools.list_teams()
    lines = ["# Equipos en VozDesk", ""]
    for t in teams:
        lines.append(f"- **{t['name']}** (Clave: `{t['key']}`, Total issues: {t['issue_counter']})")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Prompts (Flujos prediseñados para el LLM)
# ---------------------------------------------------------------------------
@mcp.prompt()
def triage_issue(raw_text: str) -> str:
    """Guía al LLM para transformar una nota de voz o mensaje libre en un issue bien estructurado."""
    return f"""Analiza la siguiente solicitud y usa la herramienta `create_issue` para guardarla en VozDesk:

Texto recibido:
\"\"\"{raw_text}\"\"\"

Instrucciones:
1. Extrae un título claro y conciso.
2. Identifica el equipo destino (ej: WUD).
3. Determina la urgencia o prioridad (1=Urgente, 2=Alta, 3=Media, 4=Baja).
4. Ejecuta `create_issue` con source='voice'.
"""


def run_stdio() -> None:
    """Ejecuta el servidor en modo Stdio (para Claude Desktop, Cursor, etc.)."""
    import asyncio
    import sys

    # En Windows, ProactorEventLoop es el predeterminado
    try:
        asyncio.run(mcp.run_stdio_async())
    except (KeyboardInterrupt, SystemExit):
        sys.exit(0)


if __name__ == "__main__":
    run_stdio()
