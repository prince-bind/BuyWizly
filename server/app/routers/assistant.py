import json
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import SessionLocal, get_db
from ..models import AILog, ChatMessage, ChatSession, User, now
from ..schemas import Ask, Feedback
from ..security import current_user, rate_limit
from ..services import agent

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


def _history(db: Session, sid: str, n=8) -> list[dict]:
    rows = db.query(ChatMessage).filter_by(session_id=sid).order_by(desc(ChatMessage.id)).limit(n).all()
    return [{"role": r.role, "content": r.content} for r in reversed(rows)]


def _session(db: Session, user: User, sid: str | None, first_msg: str) -> ChatSession:
    if sid:
        s = db.get(ChatSession, sid)
        if not s or s.user_id != user.id:
            raise HTTPException(404, "Chat session not found")
        return s
    s = ChatSession(id=str(uuid.uuid4()), user_id=user.id, title=first_msg[:60])
    db.add(s)
    db.commit()
    return s


def _persist(sid: str, uid: int, msg: str, prep, text: str, started: float) -> int:
    """Own DB session: safe to call after a streaming response has started."""
    with SessionLocal() as db:
        log = AILog(user_id=uid, session_id=sid, endpoint="chat", intent=prep.intent, query=msg, answer=text,
                    confidence=prep.meta.get("confidence", ""), sources_json=prep.meta.get("sources", []),
                    used_llm=prep.used_llm, latency_ms=int((time.time() - started) * 1000))
        db.add(log)
        db.flush()
        meta = {**prep.meta, "log_id": log.id}
        db.add(ChatMessage(session_id=sid, role="user", content=msg))
        db.add(ChatMessage(session_id=sid, role="assistant", content=text, meta=meta))
        s = db.get(ChatSession, sid)
        s.updated_at = now()
        db.commit()
        return log.id


@router.post("/chat")
def chat(body: Ask, db: Session = Depends(get_db), u: User = Depends(rate_limit)):
    started = time.time()
    s = _session(db, u, body.session_id, body.message)
    prep = agent.prepare(db, u, body.message, _history(db, s.id))
    text, _ = agent.generate(prep)
    log_id = _persist(s.id, u.id, body.message, prep, text, started)
    return {"session_id": s.id, "log_id": log_id, "answer": text, "used_llm": prep.used_llm, **prep.meta}


@router.post("/chat/stream")
def chat_stream(body: Ask, db: Session = Depends(get_db), u: User = Depends(rate_limit)):
    """Server-Sent Events: `meta` (cards, sources, steps) -> many `token` -> `done`."""
    started = time.time()
    s = _session(db, u, body.session_id, body.message)
    prep = agent.prepare(db, u, body.message, _history(db, s.id))
    uid, sid, msg = u.id, s.id, body.message

    def sse(event: str, data) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"

    def gen():
        yield sse("meta", {"session_id": sid, **prep.meta})
        parts = []
        try:
            for tok in agent.iter_text(prep):
                parts.append(tok)
                yield sse("token", tok)
        except Exception as e:  # noqa: BLE001
            yield sse("error", str(e))
        text = "".join(parts)
        yield sse("done", {"log_id": _persist(sid, uid, msg, prep, text, started), "used_llm": prep.used_llm})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/feedback")
def feedback(body: Feedback, db: Session = Depends(get_db), u: User = Depends(current_user)):
    log = db.get(AILog, body.log_id)
    if not log or log.user_id != u.id:
        raise HTTPException(404, "Log not found")
    log.feedback = body.rating or None
    db.commit()
    return {"ok": True}


@router.get("/sessions")
def sessions(db: Session = Depends(get_db), u: User = Depends(current_user)):
    rows = db.query(ChatSession).filter_by(user_id=u.id).order_by(desc(ChatSession.updated_at)).limit(30).all()
    return [{"id": s.id, "title": s.title, "updated_at": s.updated_at.isoformat()} for s in rows]


@router.get("/sessions/{sid}")
def session_messages(sid: str, db: Session = Depends(get_db), u: User = Depends(current_user)):
    s = db.get(ChatSession, sid)
    if not s or s.user_id != u.id:
        raise HTTPException(404, "Chat session not found")
    return [{"role": m.role, "content": m.content, "meta": m.meta} for m in s.messages]


@router.delete("/sessions/{sid}")
def delete_session(sid: str, db: Session = Depends(get_db), u: User = Depends(current_user)):
    s = db.get(ChatSession, sid)
    if s and s.user_id == u.id:
        db.delete(s)
        db.commit()
    return {"ok": True}
