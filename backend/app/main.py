from contextlib import asynccontextmanager
from datetime import date
from typing import Literal

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.auth import CurrentUser, get_current_user
from app.config import get_settings
from app.supabase_admin import SupabaseAdmin, close_admin, get_admin

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await close_admin()


app = FastAPI(title="VozDesk API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Monta el servidor MCP en /mcp (acceso vía SSE en /mcp/sse para Custumu y clientes remotos)
from mcp.server.transport_security import TransportSecuritySettings
from app.mcp.server import mcp as mcp_server

_mcp_security = TransportSecuritySettings(enable_dns_rebinding_protection=False)
app.mount("/mcp", mcp_server.sse_app(message_path="/mcp/messages/", transport_security=_mcp_security))


# ---------------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------------
IssueStatus = Literal["backlog", "todo", "in_progress", "in_review", "done", "canceled"]


class IssueCreate(BaseModel):
    team_id: str
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    status: IssueStatus = "backlog"
    priority: int = Field(0, ge=0, le=4)
    assignee_id: str | None = None
    project_id: str | None = None
    due_date: date | None = None
    # Por defecto 'voice': este endpoint es el que usará Custumu
    source: Literal["manual", "voice"] = "voice"


# ---------------------------------------------------------------------------
# Helpers de autorización (la secret key bypassa RLS)
# ---------------------------------------------------------------------------
async def ensure_workspace_member(admin: SupabaseAdmin, workspace_id: str, user_id: str) -> None:
    rows = await admin.select(
        "workspace_members",
        {"select": "role", "workspace_id": f"eq.{workspace_id}", "user_id": f"eq.{user_id}"},
    )
    if not rows:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No perteneces a este workspace")


# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------
@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "vozdesk-api"}


@app.get("/me")
async def me(
    user: CurrentUser = Depends(get_current_user),
    admin: SupabaseAdmin = Depends(get_admin),
):
    profile = await admin.select("profiles", {"select": "*", "id": f"eq.{user.id}"})
    workspaces = await admin.select(
        "workspace_members",
        {"select": "role, workspace:workspaces(id, name, slug)", "user_id": f"eq.{user.id}"},
    )
    return {
        "user": {"id": user.id, "email": user.email, "role": user.role},
        "profile": profile[0] if profile else None,
        "workspaces": workspaces,
    }


@app.get("/workspaces/{workspace_id}/teams")
async def list_teams(
    workspace_id: str,
    user: CurrentUser = Depends(get_current_user),
    admin: SupabaseAdmin = Depends(get_admin),
):
    await ensure_workspace_member(admin, workspace_id, user.id)
    return await admin.select(
        "teams",
        {"select": "id, name, key, issue_counter", "workspace_id": f"eq.{workspace_id}", "order": "created_at"},
    )


@app.post("/issues", status_code=status.HTTP_201_CREATED)
async def create_issue(
    payload: IssueCreate,
    user: CurrentUser = Depends(get_current_user),
    admin: SupabaseAdmin = Depends(get_admin),
):
    teams = await admin.select("teams", {"select": "id, key, workspace_id", "id": f"eq.{payload.team_id}"})
    if not teams:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team no encontrado")
    team = teams[0]
    await ensure_workspace_member(admin, team["workspace_id"], user.id)

    if payload.assignee_id:
        await ensure_workspace_member(admin, team["workspace_id"], payload.assignee_id)

    row = payload.model_dump(mode="json", exclude_none=True)
    row["creator_id"] = user.id  # con la secret key auth.uid() es null: lo fijamos explícitamente

    # number y workspace_id los asigna el trigger assign_issue_number
    issue = await admin.insert("issues", row)
    return {**issue, "identifier": f"{team['key']}-{issue['number']}"}


def run() -> None:
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=False)


if __name__ == "__main__":
    run()
