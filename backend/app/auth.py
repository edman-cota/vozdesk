"""Validación de JWT de Supabase mediante JWKS (claves asimétricas ES256/RS256)."""

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.config import get_settings

ALLOWED_ALGORITHMS = ["ES256", "RS256", "EdDSA"]

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None
    role: str
    claims: dict[str, Any]
    token: str


@lru_cache
def get_jwks_client() -> PyJWKClient:
    settings = get_settings()
    # Las claves públicas se cachean en memoria; se vuelven a pedir si llega un `kid` desconocido
    return PyJWKClient(
        settings.jwks_url,
        cache_keys=True,
        lifespan=600,
        headers={"apikey": settings.supabase_secret_key},
    )


def verify_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        signing_key = get_jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=ALLOWED_ALGORITHMS,
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "sub", "iat"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expirado") from exc
    except jwt.PyJWKClientError as exc:
        # Típico si el proyecto aún firma con el JWT secret legacy (HS256) y no hay JWKS
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"No se pudo obtener la clave de firma: {exc}") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Token inválido: {exc}") from exc


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> CurrentUser:
    """Dependencia FastAPI (síncrona → se ejecuta en threadpool, PyJWKClient usa I/O bloqueante)."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Falta el header Authorization: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = verify_token(credentials.credentials)
    if claims.get("role") != "authenticated":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Rol no permitido")

    return CurrentUser(
        id=claims["sub"],
        email=claims.get("email"),
        role=claims["role"],
        claims=claims,
        token=credentials.credentials,
    )
