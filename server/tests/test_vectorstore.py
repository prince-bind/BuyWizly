"""Vector-store selection and fallback behaviour (no network needed)."""
from app.config import settings
from app.services import vectorstore as vs


class FlakyPrimary:
    """Stands in for ChromaStore / Chroma Cloud."""
    kind = "chroma"

    def __init__(self):
        self.fail, self.calls, self.data = False, 0, {}

    def _maybe_fail(self):
        self.calls += 1
        if self.fail:
            raise RuntimeError("embedding API down")

    def upsert(self, ids, documents, metadatas):
        self._maybe_fail(); self.data.update(zip(ids, documents))

    def query(self, text, k=5, where=None):
        self._maybe_fail(); return [vs.Hit("dense", "from chroma", {}, 0.9)]

    def delete(self, ids=None, where=None):
        self._maybe_fail()

    def clear(self):
        self._maybe_fail(); self.data.clear()

    def count(self):
        return len(self.data)


def _store():
    vs.reset_stores()
    p = FlakyPrimary()
    return vs.ResilientStore(p, vs.MemoryStore("t")), p


def test_uses_chroma_when_healthy():
    s, p = _store()
    s.upsert(["a"], ["refunds take five days"], [{}])
    assert p.data and s.query("refund")[0].id == "dense" and s.kind == "chroma"


def test_falls_back_to_memory_and_breaker_skips_primary():
    s, p = _store()
    s.upsert(["a"], ["refunds take five to seven business days"], [{}])
    p.fail = True
    hits = s.query("how long do refunds take")
    assert hits and hits[0].id == "a"                 # served from the in-memory mirror
    assert s.kind.startswith("memory")
    calls = p.calls
    s.query("refunds again")
    assert p.calls == calls                            # circuit breaker: primary not retried during cooldown


def test_failed_write_marks_primary_stale_but_search_still_works():
    s, p = _store()
    p.fail = True
    s.upsert(["a"], ["warranty covers manufacturing defects"], [{}])
    assert s.stale and s.query("warranty")[0].id == "a"
    vs._breaker["until"] = 0.0; p.fail = False        # Chroma recovers, but its index is incomplete
    assert s.query("warranty")[0].id == "a"            # stale primary is never trusted until restart


def test_backend_selection_rules(monkeypatch):
    vs.reset_stores()
    monkeypatch.setattr(settings, "env", "prod")
    monkeypatch.setattr(settings, "chroma_api_key", "")
    monkeypatch.setattr(settings, "vector_backend", "auto")
    assert vs._chroma_allowed() is False               # prod without a Chroma Cloud key -> memory, never local Chroma
    assert vs.get_store("policies").kind == "memory"
    monkeypatch.setattr(settings, "chroma_api_key", "ck-test")
    assert vs._chroma_allowed() is True and vs._cloud_embeddings() is True
    monkeypatch.setattr(settings, "chroma_embedding", "local")
    assert vs._cloud_embeddings() is False
    monkeypatch.setattr(settings, "vector_backend", "memory")
    assert vs._chroma_allowed() is False
    vs.reset_stores()
