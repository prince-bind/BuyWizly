import io
import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AILog, Document, Order, Product, User
from ..security import require_admin
from ..services import llm, rag
from ..services.vectorstore import get_store

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])
ALLOWED = {".pdf", ".md", ".markdown", ".txt", ".json"}


def _doc(d: Document) -> dict:
    return {"id": d.id, "title": d.title, "category": d.category, "version": d.version, "region": d.region,
            "chunk_count": d.chunk_count, "source_file": d.source_file, "uploaded_at": d.uploaded_at.isoformat()}


@router.get("/documents")
def documents(db: Session = Depends(get_db)):
    return [_doc(d) for d in db.query(Document).order_by(desc(Document.uploaded_at)).all()]


@router.post("/documents", status_code=201)
def upload(file: UploadFile = File(...), title: str = Form(""), category: str = Form("General"),
           version: str = Form("2026.1"), region: str = Form("India"), db: Session = Depends(get_db)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(400, "Upload PDF, Markdown, TXT or JSON files")
    data = file.file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, "File must be under 8 MB")
    try:
        if ext == ".pdf":
            from pypdf import PdfReader
            text = "\n\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(data)).pages)
        elif ext == ".json":
            text = json.dumps(json.loads(data.decode("utf-8")), ensure_ascii=False, indent=1)
        else:
            text = data.decode("utf-8")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Could not read document: {e}")
    if not text.strip():
        raise HTTPException(400, "No readable text found")
    title = title or Path(file.filename).stem.replace("_", " ").title()
    try:
        doc = rag.ingest_text(db, title=title, text=text, category=category, version=version, region=region,
                              source_file=file.filename or "")
    except Exception as e:  # noqa: BLE001
        db.rollback()
        raise HTTPException(503, f"Vector indexing failed: {e}")
    return {**_doc(doc), "status": "indexed"}


@router.delete("/documents/{doc_id}")
def delete(doc_id: int, db: Session = Depends(get_db)):
    d = db.get(Document, doc_id)
    if not d:
        raise HTTPException(404, "Document not found")
    rag.delete_document(db, d)
    return {"ok": True}


@router.post("/documents/reindex")
def reindex(db: Session = Depends(get_db)):
    return {"chunks": rag.sync_index(db, force=True)}


@router.get("/rag/test")
def rag_test(q: str, db: Session = Depends(get_db)):
    """Debug view of retrieval: lets an admin see exactly which chunks and scores back an answer."""
    hits = rag.retrieve(q)
    return {"confidence": rag._confidence(hits), "threshold": rag.settings.rag_min_score,
            "hits": [{"id": h.id, "score": h.score, "title": h.metadata.get("title"),
                      "section": h.metadata.get("section"), "text": h.text} for h in hits]}


@router.get("/analytics")
def analytics(db: Session = Depends(get_db)):
    total = db.query(func.count(AILog.id)).scalar()
    by_intent = dict(db.query(AILog.intent, func.count()).group_by(AILog.intent).all())
    by_conf = dict(db.query(AILog.confidence, func.count()).filter(AILog.confidence != "").group_by(AILog.confidence).all())
    up = db.query(func.count()).filter(AILog.feedback == 1).scalar()
    down = db.query(func.count()).filter(AILog.feedback == -1).scalar()
    recent = db.query(AILog).order_by(desc(AILog.id)).limit(15).all()
    low = db.query(AILog).filter(AILog.confidence == "LOW").order_by(desc(AILog.id)).limit(10).all()
    return {
        "totals": {"queries": total, "avg_latency_ms": int(db.query(func.avg(AILog.latency_ms)).scalar() or 0),
                   "thumbs_up": up, "thumbs_down": down, "users": db.query(func.count(User.id)).scalar(),
                   "orders": db.query(func.count(Order.id)).scalar(), "products": db.query(func.count(Product.id)).scalar(),
                   "documents": db.query(func.count(Document.id)).scalar()},
        "by_intent": by_intent, "by_confidence": by_conf,
        "recent": [{"id": r.id, "query": r.query, "intent": r.intent, "confidence": r.confidence, "latency_ms": r.latency_ms,
                    "used_llm": r.used_llm, "feedback": r.feedback, "created_at": r.created_at.isoformat()} for r in recent],
        "unanswered": [{"id": r.id, "query": r.query} for r in low],  # knowledge gaps to write docs for
        "system": {"llm_configured": llm.available(), "vector_backend": get_store("policies").kind},
    }
