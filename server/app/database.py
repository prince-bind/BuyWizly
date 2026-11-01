from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


db_url = settings.clean_database_url
engine_kwargs: dict = {}
if db_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:  # Neon / serverless Postgres friendly pool settings
    engine_kwargs.update(pool_pre_ping=True, pool_recycle=300, pool_size=5, max_overflow=5,
                         # no server-side prepared statements: required behind Neon's pgbouncer pooler
                         connect_args={"prepare_threshold": None})

engine = create_engine(db_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
