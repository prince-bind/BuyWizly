from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User
from ..schemas import Login, Register
from ..security import create_token, current_user, hash_password, verify_password
from ..serializers import user_out

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _session(u: User) -> dict:
    return {"access_token": create_token(u), "token_type": "bearer", "user": user_out(u)}


@router.post("/register", status_code=201)
def register(p: Register, db: Session = Depends(get_db)):
    email = p.email.lower()
    u = User(name=p.name.strip(), email=email, password_hash=hash_password(p.password),
             is_admin=email in settings.admin_email_set)
    db.add(u)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email already registered")
    return _session(u)


@router.post("/login")
def login(p: Login, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(email=p.email.lower()).first()
    if not u or not verify_password(p.password, u.password_hash):
        raise HTTPException(401, "Email or password is incorrect")
    return _session(u)


@router.get("/me")
def me(u: User = Depends(current_user)):
    return user_out(u)
