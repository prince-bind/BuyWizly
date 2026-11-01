"""Vector store abstraction with two interchangeable backends.

* ChromaStore  - ChromaDB (local persistent or Chroma Cloud), cosine similarity, dense embeddings.
* MemoryStore  - dependency-free TF-IDF cosine search. Used for tests, CI and offline demos, and as an
                 automatic fallback if Chroma cannot start (e.g. embedding model download blocked).
"""
import logging
import math
import os
import re
import time
from collections import Counter
from dataclasses import dataclass, field

from ..config import settings

log = logging.getLogger(__name__)

STOP = set(
    "a an and are as at be by can do does for from how i if in is it my of on or our so that the "
    "their there this to was we what when where which who will with you your me us "
    "long many much take get have has had would could should also any some about need tell".split()
)


def tokenize(text: str) -> list[str]:
    out = []
    for w in re.findall(r"[a-z0-9]+", text.lower()):
        if w in STOP:
            continue
        if len(w) > 3 and w.endswith("ies"):
            w = w[:-3] + "y"
        elif len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        out.append(w)
    return out


@dataclass
class Hit:
    id: str
    text: str
    metadata: dict = field(default_factory=dict)
    score: float = 0.0  # similarity in [0, 1], higher is better
    coverage: float = 1.0  # share of question keywords found in this text (answerability signal)


class MemoryStore:
    kind = "memory"

    def __init__(self, name: str):
        self.name = name
        self.docs: dict[str, tuple[str, dict, Counter]] = {}

    def upsert(self, ids, documents, metadatas):
        for i, d, m in zip(ids, documents, metadatas):
            self.docs[i] = (d, m or {}, Counter(tokenize(d)))

    def query(self, text: str, k: int = 5, where: dict | None = None) -> list[Hit]:
        n = len(self.docs) or 1
        df = Counter(t for _, _, c in self.docs.values() for t in c)
        idf = lambda t: math.log((n + 1) / (df.get(t, 0) + 1)) + 1
        q = Counter(tokenize(text))
        qv = {t: c * idf(t) for t, c in q.items()}
        qn = math.sqrt(sum(v * v for v in qv.values())) or 1
        hits = []
        for id_, (doc, meta, tf) in self.docs.items():
            if where and any(meta.get(k_) != v for k_, v in where.items()):
                continue
            dv = {t: c * idf(t) for t, c in tf.items()}
            dn = math.sqrt(sum(v * v for v in dv.values())) or 1
            dot = sum(v * dv.get(t, 0) for t, v in qv.items())
            if dot > 0:
                hits.append(Hit(id_, doc, meta, dot / (qn * dn)))
        return sorted(hits, key=lambda h: -h.score)[:k]

    def delete(self, ids=None, where=None):
        for id_ in list(self.docs):
            meta = self.docs[id_][1]
            if (ids and id_ in ids) or (where and all(meta.get(k) == v for k, v in where.items())):
                del self.docs[id_]

    def count(self) -> int:
        return len(self.docs)

    def clear(self):
        self.docs.clear()


class ChromaStore:
    kind = "chroma"

    def __init__(self, name: str, client, embedding_function=None):
        self.name = name
        kw = {"embedding_function": embedding_function} if embedding_function is not None else {}
        self.col = client.get_or_create_collection(name, metadata={"hnsw:space": "cosine"}, **kw)

    def upsert(self, ids, documents, metadatas):
        for i in range(0, len(ids), 100):
            self.col.upsert(ids=ids[i : i + 100], documents=documents[i : i + 100], metadatas=metadatas[i : i + 100])

    def query(self, text: str, k: int = 5, where: dict | None = None) -> list[Hit]:
        if self.col.count() == 0:
            return []
        kw = {"where": where} if where else {}
        r = self.col.query(query_texts=[text], n_results=min(k, self.col.count()), **kw)
        return [
            Hit(i, d, m or {}, max(0.0, 1.0 - float(dist)))
            for i, d, m, dist in zip(r["ids"][0], r["documents"][0], r["metadatas"][0], r["distances"][0])
        ]

    def delete(self, ids=None, where=None):
        if ids:
            self.col.delete(ids=ids)
        elif where:
            self.col.delete(where=where)

    def count(self) -> int:
        return self.col.count()

    def clear(self):
        got = self.col.get()
        if got["ids"]:
            self.col.delete(ids=got["ids"])


class ResilientStore:
    """Chroma as primary index with an always-in-sync in-memory mirror.

    If Chroma (or its hosted embedding API) errors or times out, queries transparently use the mirror and a
    circuit breaker keeps the primary out of the request path for a couple of minutes. A failed write marks the
    primary stale until the next restart, which re-syncs everything.
    """

    COOLDOWN = 120

    def __init__(self, primary: ChromaStore, fallback: MemoryStore):
        self.primary, self.fallback = primary, fallback
        self.stale = False

    @property
    def kind(self) -> str:
        return self.primary.kind if self._usable() else "memory (chroma unavailable)"

    def _usable(self) -> bool:
        return not self.stale and time.time() >= _breaker["until"]

    def _call(self, fn, *a, **kw):
        """Run a primary operation; returns (result, ok)."""
        if time.time() < _breaker["until"]:
            return None, False
        try:
            return fn(*a, **kw), True
        except Exception as e:  # noqa: BLE001
            _breaker["until"] = time.time() + self.COOLDOWN
            log.warning("Chroma call failed (%s) - serving from in-memory mirror for %ss", e, self.COOLDOWN)
            return None, False

    def upsert(self, ids, documents, metadatas):
        self.fallback.upsert(ids, documents, metadatas)
        if not self._call(self.primary.upsert, ids, documents, metadatas)[1]:
            self.stale = True

    def query(self, text: str, k: int = 5, where: dict | None = None) -> list[Hit]:
        if self._usable():
            res, ok = self._call(self.primary.query, text, k, where)
            if ok:
                return res
        return self.fallback.query(text, k, where)

    def delete(self, ids=None, where=None):
        self.fallback.delete(ids, where)
        if not self._call(self.primary.delete, ids, where)[1]:
            self.stale = True

    def count(self) -> int:
        return self.fallback.count()  # what this process has indexed; a restart re-syncs both

    def clear(self):
        self.fallback.clear()
        if not self._call(self.primary.clear)[1]:
            self.stale = True


_stores: dict[str, object] = {}
_chroma_client = None
_chroma_failed = False
_breaker = {"until": 0.0}


def _chroma():
    global _chroma_client
    import chromadb

    if _chroma_client is None:
        if settings.chroma_api_key.strip():
            os.environ.setdefault("CHROMA_API_KEY", settings.chroma_api_key.strip())
            kw = dict(
                api_key=settings.chroma_api_key.strip(),
                cloud_host=settings.chroma_cloud_host.strip() or "api.trychroma.com",
                cloud_port=settings.chroma_cloud_port,
                enable_ssl=settings.chroma_cloud_ssl,
            )
            if settings.chroma_tenant.strip():
                kw["tenant"] = settings.chroma_tenant.strip()
            if settings.chroma_database.strip():
                kw["database"] = settings.chroma_database.strip()
            _chroma_client = chromadb.CloudClient(**kw)
        else:
            _chroma_client = chromadb.PersistentClient(path=settings.chroma_path)
    return _chroma_client


def _cloud_embeddings() -> bool:
    return bool(settings.chroma_api_key.strip()) and settings.chroma_embedding in ("auto", "cloud")


def _embedding_function():
    """Hosted embeddings run on Chroma's servers, so the web process needs no local model (small RAM)."""
    if not _cloud_embeddings():
        return None  # chromadb's default local ONNX MiniLM
    from chromadb.utils.embedding_functions import ChromaCloudQwenEmbeddingFunction
    from chromadb.utils.embedding_functions.chroma_cloud_qwen_embedding_function import (
        ChromaCloudQwenEmbeddingModel,
    )

    return ChromaCloudQwenEmbeddingFunction(model=ChromaCloudQwenEmbeddingModel.QWEN3_EMBEDDING_0p6B, task=None)


def _chroma_allowed() -> bool:
    if settings.vector_backend == "chroma":
        return True
    # auto: Chroma Cloud when configured; local Chroma only in dev (never on a small prod instance)
    return settings.vector_backend == "auto" and bool(settings.chroma_api_key.strip() or settings.env != "prod")


def get_store(name: str):
    """Return a cached store for a logical collection ('policies' | 'products')."""
    global _chroma_failed
    if name in _stores:
        return _stores[name]
    mirror = MemoryStore(name)
    store = mirror
    if _chroma_allowed() and not _chroma_failed:
        try:
            suffix = "qwen" if _cloud_embeddings() else "v2"  # separate collections: embedding dims differ
            primary = ChromaStore(f"shopsmart_{name}_{suffix}", _chroma(), _embedding_function())
            primary.count()  # force a round-trip so connection/auth errors surface now
            store = ResilientStore(primary, mirror)
        except Exception as e:  # noqa: BLE001
            _chroma_failed = True
            log.warning("Chroma unavailable (%s) - using in-memory TF-IDF store", e)
            if settings.vector_backend == "chroma":
                raise
    _stores[name] = store
    return store


def reset_stores():
    """Test helper."""
    global _chroma_failed
    _stores.clear()
    _chroma_failed = False
    _breaker["until"] = 0.0
