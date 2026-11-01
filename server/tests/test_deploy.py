"""Deployment-related seeding behaviour (fresh in-memory DB, no network)."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models import Product, User
from app.seed import DEMO_EMAIL, seed


def _db():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    return sessionmaker(bind=eng, expire_on_commit=False)()


def test_seed_demo_can_be_disabled(monkeypatch):
    monkeypatch.setattr(settings, "seed_demo", False)
    db = _db()
    seed(db)
    assert db.query(Product).count() > 0
    assert db.query(User).filter_by(email=DEMO_EMAIL).first() is None


def test_admin_emails_promotes_existing_user_but_never_the_demo(monkeypatch):
    monkeypatch.setattr(settings, "seed_demo", True)
    db = _db()
    seed(db)
    db.add(User(name="Me", email="me@example.com", password_hash="x"))
    db.commit()
    monkeypatch.setattr(settings, "admin_emails", f"me@example.com, {DEMO_EMAIL}")
    seed(db)  # simulates a restart after setting ADMIN_EMAILS
    assert db.query(User).filter_by(email="me@example.com").one().is_admin is True
    assert db.query(User).filter_by(email=DEMO_EMAIL).one().is_admin is False
