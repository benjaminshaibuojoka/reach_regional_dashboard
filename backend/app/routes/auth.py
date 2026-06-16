"""Auth — username/bcrypt-hash credentials from env, HMAC-signed bearer tokens.

Tokens are `username.expiry.signature`. Passwords come from
REACH_USERS_JSON (a JSON object of `{ "name": "<bcrypt_hash>" }`) or fall back
to a single REACH_USER/REACH_PASS pair so the container still boots locally.

A small in-memory sliding-window rate-limiter (B7) caps login attempts per
IP+username pair. The store is fine for a single replica; for multi-replica
use Redis (the helper is centralised so the swap is one function).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from collections import deque

import bcrypt
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

router = APIRouter()

# ---- Credentials --------------------------------------------------------
# Prefer REACH_USERS_JSON (bcrypt hashes). Fallback to single user/pass for
# dev — but log a clear warning when the fallback fires.
def _load_users() -> dict[str, str]:
    raw = os.environ.get("REACH_USERS_JSON", "")
    if raw:
        try:
            data = json.loads(raw)
            return {str(k).strip().lower(): str(v) for k, v in data.items()}
        except json.JSONDecodeError:
            print("[auth] REACH_USERS_JSON malformed — falling back to single-user")
    user = os.environ.get("REACH_USER", "admin").strip().lower()
    pw = os.environ.get("REACH_PASS", "reach2026")
    # If REACH_PASS is already a bcrypt hash (starts with $2), use as-is;
    # otherwise hash on the fly so the rest of the code path is uniform.
    if pw.startswith("$2"):
        return {user: pw}
    digest = bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode()
    return {user: digest}


USERS = _load_users()
SECRET = os.environ.get("REACH_SECRET", "reach-dashboard-default-secret").encode("utf-8")
TOKEN_TTL_SECONDS = int(os.environ.get("REACH_TOKEN_TTL", "28800"))      # 8h
REFRESH_GRACE_SECONDS = int(os.environ.get("REACH_REFRESH_GRACE", "3600"))  # 1h after expiry


# ---- Token helpers ------------------------------------------------------
def _sign(payload: str) -> str:
    digest = hmac.new(SECRET, payload.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


def _make_token(username: str) -> tuple[str, int]:
    exp = int(time.time()) + TOKEN_TTL_SECONDS
    payload = f"{username}.{exp}"
    sig = _sign(payload)
    return f"{payload}.{sig}", exp


def _parse_token(token: str) -> tuple[str, int, str] | None:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        username, exp, sig = parts
        expected = _sign(f"{username}.{exp}")
        if not hmac.compare_digest(expected, sig):
            return None
        return username, int(exp), sig
    except Exception:
        return None


def verify_token(token: str) -> str | None:
    parsed = _parse_token(token)
    if not parsed:
        return None
    username, exp, _ = parsed
    if exp < int(time.time()):
        return None
    return username


# ---- Sliding-window rate-limit (B7) -------------------------------------
# Keyed by (client_ip, username). Up to N failed attempts per WINDOW seconds.
_LOGIN_FAILS: dict[tuple[str, str], deque[float]] = {}
LOGIN_MAX_ATTEMPTS = int(os.environ.get("REACH_LOGIN_MAX", "8"))
LOGIN_WINDOW_SECONDS = int(os.environ.get("REACH_LOGIN_WINDOW", "600"))  # 10 min


def _is_rate_limited(ip: str, user: str) -> bool:
    now = time.time()
    key = (ip, user)
    bucket = _LOGIN_FAILS.get(key)
    if not bucket:
        return False
    cutoff = now - LOGIN_WINDOW_SECONDS
    while bucket and bucket[0] < cutoff:
        bucket.popleft()
    return len(bucket) >= LOGIN_MAX_ATTEMPTS


def _record_fail(ip: str, user: str) -> None:
    key = (ip, user)
    bucket = _LOGIN_FAILS.setdefault(key, deque())
    bucket.append(time.time())
    # Keep the deque from growing unboundedly for unique pairs.
    while len(bucket) > LOGIN_MAX_ATTEMPTS * 2:
        bucket.popleft()


def _clear_fails(ip: str, user: str) -> None:
    _LOGIN_FAILS.pop((ip, user), None)


# ---- Schemas ------------------------------------------------------------
class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=200)


class RefreshRequest(BaseModel):
    token: str = Field(min_length=10, max_length=400)


# ---- Routes -------------------------------------------------------------
def _check_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


@router.post("/login")
def login(req: LoginRequest, request: Request):
    ip = (request.client.host if request.client else "unknown") or "unknown"
    user = req.username.strip().lower()
    if _is_rate_limited(ip, user):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Try again later.",
        )
    expected = USERS.get(user)
    if not expected or not _check_password(req.password, expected):
        _record_fail(ip, user)
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    _clear_fails(ip, user)
    token, exp = _make_token(user)
    return {"token": token, "username": user, "expires_at": exp}


@router.post("/refresh")
def refresh(req: RefreshRequest):
    """Issue a new token from a still-valid OR recently expired token (grace)."""
    parsed = _parse_token(req.token)
    if not parsed:
        raise HTTPException(status_code=401, detail="Invalid token signature.")
    username, exp, _ = parsed
    # Allow refresh up to REFRESH_GRACE_SECONDS past expiry — but not forever.
    if exp + REFRESH_GRACE_SECONDS < int(time.time()):
        raise HTTPException(status_code=401, detail="Token expired beyond refresh window.")
    token, new_exp = _make_token(username)
    return {"token": token, "username": username, "expires_at": new_exp}


@router.get("/me")
def me(authorization: str = ""):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="No token.")
    user = verify_token(authorization.split(" ", 1)[1])
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return {"username": user}
