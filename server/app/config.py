from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    app_name: str = "AskCart"
    env: str = "dev"  # dev | prod
    secret_key: str = "change-this-secret-before-deploying"
    token_days: int = 7
    database_url: str = "sqlite:///./shopsmart.db"

    # LLM (Groq via LangChain). Everything works without a key using extractive fallbacks.
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-20b"
    llm_provider: str = "groq"
    llm_timeout: float = 20.0

    # Vector store: auto -> Chroma Cloud if a key is set (local Chroma in dev), else in-memory TF-IDF. Falls back automatically on errors.
    vector_backend: str = "auto"  # auto | chroma | memory
    chroma_path: str = "./data/chroma"
    chroma_api_key: str = ""
    chroma_tenant: str = ""
    chroma_database: str = ""
    chroma_cloud_host: str = "api.trychroma.com"
    chroma_cloud_port: int = 443
    chroma_cloud_ssl: bool = True
    # auto = Chroma's hosted Qwen embeddings when a Chroma Cloud key is set (no local model, tiny RAM), else local ONNX
    chroma_embedding: str = "auto"  # auto | cloud | local

    # RAG tuning
    rag_top_k: int = 4
    rag_min_score: float = 0.2
    rag_chunk_size: int = 700
    rag_chunk_overlap: int = 120

    rate_limit_per_min: int = 30
    admin_emails: str = ""
    seed_demo: bool = True  # SEED_DEMO=false skips the shared demo account + sample orders
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    policies_dir: str = str(BASE_DIR / "data" / "policies")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def clean_database_url(self) -> str:
        url = (self.database_url or "").strip().strip("'\"")
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
