import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User

oauth = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(v: str) -> str:
    return bcrypt.hashpw(v.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode()[:72], hashed.encode())
    except Exception:
        return False


def create_token(user: User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=settings.token_days)
    return jwt.encode({"sub": str(user.id), "exp": exp}, settings.secret_key, algorithm="HS256")


def current_user(token: str = Depends(oauth), db: Session = Depends(get_db)) -> User:
    try:
        uid = int(jwt.decode(token, settings.secret_key, algorithms=["HS256"])["sub"])
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    user = db.get(User, uid)
    if not user:
        raise HTTPException(401, "User not found")
    return user


def require_admin(u: User = Depends(current_user)) -> User:
    if not u.is_admin:
        raise HTTPException(403, "Admin access required")
    return u


_hits: dict[int, deque] = defaultdict(deque)


def rate_limit(u: User = Depends(current_user)) -> User:
    """Sliding-window limiter (in-memory; swap for Redis when running >1 worker)."""
    window, q, t = 60, _hits[u.id], time.time()
    while q and t - q[0] > window:
        q.popleft()
    if len(q) >= settings.rate_limit_per_min:
        raise HTTPException(429, "Too many assistant requests. Please wait a moment.")
    q.append(t)
    return u
