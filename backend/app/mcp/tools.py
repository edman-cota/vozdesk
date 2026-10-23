"""Herramientas de negocio de VozDesk utilizadas por el servidor MCP."""

import re
from typing import Any

from app.supabase_admin import get_admin


def parse_identifier(identifier: str) -> tuple[str, int]:
    """Parsea un identificador tipo 'WUD-5' en ('WUD', 5)."""
    clean = identifier.strip().upper()
    match = re.match(r"^([A-Z0-9]+)[-\s](\d+)$", clean)
    if not match:
        raise ValueError(
            f"Identificador inválido '{identifier}'. Debe tener formato 'TEAM-NUMERO' (ej: WUD-5)."
        )
    return match.group(1), int(match.group(2))


async def list_workspaces() -> list[dict[str, Any]]:
    """Lista todos los workspaces de VozDesk."""
    admin = get_admin()
    return await admin.select("workspaces", {"select": "id, name, slug, created_at", "order": "created_at"})


async def list_teams(workspace_id: str | None = None) -> list[dict[str, Any]]:
    """Lista los equipos registrados. Opcionalmente filtra por workspace."""
    admin = get_admin()
    params: dict[str, str] = {
        "select": "id, workspace_id, name, key, issue_counter, created_at",
        "order": "created_at",
    }
    if workspace_id:
        params["workspace_id"] = f"eq.{workspace_id}"
    return await admin.select("teams", params)


async def get_team_by_key(team_key: str) -> dict[str, Any]:
    """Busca un equipo por su clave única (ej: 'WUD')."""
    admin = get_admin()
    teams = await admin.select(
        "teams",
        {"select": "id, workspace_id, name, key, issue_counter", "key": f"eq.{team_key.upper().strip()}"},
    )
    if not teams:
        raise ValueError(f"Equipo con key '{team_key}' no encontrado.")
    return teams[0]


async def list_issues(
    team_key: str | None = None,
    status: str | None = None,
    priority: int | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Lista y filtra issues con su identificador secuencial (ej: WUD-5)."""
    admin = get_admin()
    params: dict[str, str] = {
        "select": "id, number, title, description, status, priority, due_date, source, created_at, team:teams!inner(id, key, name)",
        "order": "number.desc",
        "limit": str(limit),
    }

    if team_key:
        team = await get_team_by_key(team_key)
        params["team_id"] = f"eq.{team['id']}"

    if status:
        params["status"] = f"eq.{status.lower().strip()}"

    if priority is not None:
        params["priority"] = f"eq.{priority}"

    rows = await admin.select("issues", params)
    result = []
    for row in rows:
        t_key = row.get("team", {}).get("key") or (team_key or "").upper()
        result.append(
            {
                "identifier": f"{t_key}-{row['number']}",
                "number": row["number"],
                "title": row["title"],
                "status": row["status"],
                "priority": row["priority"],
                "description": row.get("description"),
                "due_date": row.get("due_date"),
                "source": row.get("source"),
                "created_at": row.get("created_at"),
            }
        )
    return result


async def get_issue(identifier: str) -> dict[str, Any]:
    """Obtiene el detalle completo de un issue por su identificador (ej: 'WUD-5')."""
    team_key, number = parse_identifier(identifier)
    team = await get_team_by_key(team_key)
    admin = get_admin()

    rows = await admin.select(
        "issues",
        {
            "select": "*, team:teams(id, key, name), assignee:profiles!issues_assignee_id_fkey(id, full_name, email), project:projects(id, name)",
            "team_id": f"eq.{team['id']}",
            "number": f"eq.{number}",
        },
    )
    if not rows:
        raise ValueError(f"Issue {identifier} no encontrado en el equipo {team_key}.")

    row = rows[0]
    return {
        "identifier": f"{team_key}-{row['number']}",
        "id": row["id"],
        "title": row["title"],
        "description": row.get("description"),
        "status": row["status"],
        "priority": row["priority"],
        "due_date": row.get("due_date"),
        "source": row.get("source"),
        "team": row.get("team"),
        "assignee": row.get("assignee"),
        "project": row.get("project"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


async def create_issue(
    team_key: str,
    title: str,
    description: str | None = None,
    status: str = "backlog",
    priority: int = 0,
    due_date: str | None = None,
    source: str = "voice",
) -> dict[str, Any]:
    """Crea un nuevo issue en el equipo especificado. El número secuencial lo asigna la base de datos."""
    team = await get_team_by_key(team_key)
    admin = get_admin()

    row: dict[str, Any] = {
        "team_id": team["id"],
        "title": title.strip(),
        "status": status.lower().strip(),
        "priority": int(priority),
        "source": source,
    }
    if description:
        row["description"] = description.strip()
    if due_date:
        row["due_date"] = due_date.strip()

    created = await admin.insert("issues", row)
    identifier = f"{team['key']}-{created['number']}"
    return {
        "identifier": identifier,
        "id": created["id"],
        "title": created["title"],
        "status": created["status"],
        "priority": created["priority"],
        "due_date": created.get("due_date"),
        "source": created.get("source"),
        "created_at": created.get("created_at"),
    }


async def update_issue(
    identifier: str,
    title: str | None = None,
    description: str | None = None,
    status: str | None = None,
    priority: int | None = None,
    due_date: str | None = None,
) -> dict[str, Any]:
    """Actualiza campos de un issue existente (estado, prioridad, título, etc.)."""
    team_key, number = parse_identifier(identifier)
    team = await get_team_by_key(team_key)
    admin = get_admin()

    updates: dict[str, Any] = {}
    if title is not None:
        updates["title"] = title.strip()
    if description is not None:
        updates["description"] = description.strip()
    if status is not None:
        valid_statuses = {"backlog", "todo", "in_progress", "in_review", "done", "canceled"}
        val = status.lower().strip()
        if val not in valid_statuses:
            raise ValueError(f"Estado '{status}' inválido. Opciones: {sorted(valid_statuses)}")
        updates["status"] = val
    if priority is not None:
        updates["priority"] = int(priority)
    if due_date is not None:
        updates["due_date"] = due_date.strip() if due_date else None

    if not updates:
        raise ValueError("No se proporcionó ningún campo para actualizar.")

    res = await admin.update(
        "issues",
        {"team_id": f"eq.{team['id']}", "number": f"eq.{number}"},
        updates,
    )
    if not res:
        raise ValueError(f"Issue {identifier} no encontrado para actualizar.")

    updated = res[0]
    return {
        "identifier": f"{team_key}-{updated['number']}",
        "id": updated["id"],
        "title": updated["title"],
        "status": updated["status"],
        "priority": updated["priority"],
        "due_date": updated.get("due_date"),
        "updated_at": updated.get("updated_at"),
    }


async def delete_issue(identifier: str) -> dict[str, str]:
    """Elimina permanentemente un issue por su identificador (ej: 'WUD-5')."""
    team_key, number = parse_identifier(identifier)
    team = await get_team_by_key(team_key)
    admin = get_admin()

    await admin.delete(
        "issues",
        {"team_id": f"eq.{team['id']}", "number": f"eq.{number}"},
    )
    return {"status": "deleted", "identifier": identifier}


async def list_projects(workspace_id: str | None = None) -> list[dict[str, Any]]:
    """Lista proyectos del workspace."""
    admin = get_admin()
    params: dict[str, str] = {
        "select": "id, workspace_id, name, description, status, start_date, target_date",
        "order": "created_at",
    }
    if workspace_id:
        params["workspace_id"] = f"eq.{workspace_id}"
    return await admin.select("projects", params)
