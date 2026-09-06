"""FastAPI dependencies: token validation + role-based authorization.

Every sensitive endpoint validates authentication AND authorization server-side;
frontend role hints or URLs are never trusted.
"""

from typing import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..database.mongodb import get_db
from .security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required.", {"WWW-Authenticate": "Bearer"})
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token.", {"WWW-Authenticate": "Bearer"})
    user = await db.users.find_one({"_id": payload.get("sub")})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account no longer exists.")
    if not user.get("active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")
    return user


def require_roles(*roles: str) -> Callable:
    """Dependency factory: require_roles("ADMIN") etc."""

    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Forbidden: requires {' or '.join(roles)} role.",
            )
        return user

    return checker
