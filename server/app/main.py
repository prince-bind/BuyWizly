import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .routers import admin, assistant, auth, catalog, shop
from .seed import seed
from .services import llm, rag
from .services.search import index_products
from .services.vectorstore import get_store

log = logging.getLogger("shopsmart")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.env == "prod" and settings.secret_key.startswith("change-this"):
        raise RuntimeError("Set a strong SECRET_KEY before running in production")
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db)
        log.info("policy chunks indexed: %s", rag.sync_index(db))
        log.info("products indexed: %s", index_products(db))
    log.info("LLM configured: %s (model=%s)", llm.available(), settings.groq_model)
    yield


app = FastAPI(title="AskCart API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list or ["*"],
                   allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
for r in (auth.router, catalog.router, shop.router, assistant.router, admin.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    ok = True
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        ok = False
    return {"status": "ok" if ok else "degraded", "database_connected": ok,
            "vector_backend": get_store("policies").kind, "llm_configured": llm.available(),
            "llm_model": settings.groq_model if llm.available() else None, "version": app.version}
