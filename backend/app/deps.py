"""FastAPI dependencies — auth verification used to gate every data route."""
from __future__ import annotations

import os
from fastapi import Depends, Header, HTTPException, status

from .routes.auth import verify_token

# Set REACH_AUTH_OPTIONAL=1 to bypass auth (dev only).
_OPTIONAL = os.environ.get("REACH_AUTH_OPTIONAL", "0") == "1"


async def current_user(authorization: str = Header(default="")) -> str:
    """Returns the username from a valid Bearer token, or 401."""
    if _OPTIONAL:
        return "dev"
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Missing bearer token.")
    user = verify_token(authorization.split(" ", 1)[1])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or expired token.")
    return user
