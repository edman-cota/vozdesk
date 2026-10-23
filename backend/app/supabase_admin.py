"""Cliente mínimo de PostgREST con la secret key de Supabase (bypassa RLS).

Toda comprobación de permisos debe hacerse explícitamente en el backend antes de usarlo.
"""

from typing import Any

import httpx
from fastapi import HTTPException, status

from app.config import get_settings


class SupabaseAdmin:
    def __init__(self) -> None:
        settings = get_settings()
        # Con las nuevas secret keys basta con el header `apikey` (no son JWT: no enviar Authorization)
        self._client = httpx.AsyncClient(
            base_url=f"{settings.base_url}/rest/v1",
            headers={"apikey": settings.supabase_secret_key, "Content-Type": "application/json"},
            timeout=10.0,
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def _request(self, method: str, table: str, **kwargs: Any) -> Any:
        res = await self._client.request(method, f"/{table}", **kwargs)
        if res.is_error:
            try:
                detail = res.json().get("message", res.text)
            except ValueError:
                detail = res.text
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Supabase: {detail}")
        return res.json() if res.content else None

    async def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        return await self._request("GET", table, params=params)

    async def insert(self, table: str, row: dict[str, Any], select: str = "*") -> dict[str, Any]:
        data = await self._request(
            "POST",
            table,
            params={"select": select},
            json=row,
            headers={"Prefer": "return=representation"},
        )
        return data[0]

    async def update(
        self, table: str, params: dict[str, str], row: dict[str, Any], select: str = "*"
    ) -> list[dict[str, Any]]:
        return await self._request(
            "PATCH",
            table,
            params={**params, "select": select},
            json=row,
            headers={"Prefer": "return=representation"},
        )

    async def delete(self, table: str, params: dict[str, str]) -> Any:
        return await self._request("DELETE", table, params=params)


_admin: SupabaseAdmin | None = None


def get_admin() -> SupabaseAdmin:
    global _admin
    if _admin is None:
        _admin = SupabaseAdmin()
    return _admin


async def close_admin() -> None:
    global _admin
    if _admin is not None:
        await _admin.close()
        _admin = None
