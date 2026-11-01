"""Thin LLM wrapper (Groq via LangChain). Returns None / falls back cleanly when no key is set."""
import json
import logging
import re
from functools import lru_cache
from typing import Iterator

from ..config import settings

log = logging.getLogger(__name__)


@lru_cache
def _client():
    if not settings.groq_api_key:
        return None
    try:
        from langchain_groq import ChatGroq

        return ChatGroq(
            model=settings.groq_model,
            api_key=settings.groq_api_key,
            temperature=0.2,
            max_retries=1,
            timeout=settings.llm_timeout,
        )
    except Exception as e:  # noqa: BLE001
        log.warning("LLM init failed: %s", e)
        return None


def available() -> bool:
    return _client() is not None


def _messages(system: str, user: str):
    return [("system", system), ("human", user)]


def complete(system: str, user: str) -> str | None:
    c = _client()
    if not c:
        return None
    try:
        return str(c.invoke(_messages(system, user)).content).strip()
    except Exception as e:  # noqa: BLE001
        log.warning("LLM call failed: %s", e)
        return None


def stream(system: str, user: str) -> Iterator[str] | None:
    """Yield text tokens, or return None if the LLM is not usable."""
    c = _client()
    if not c:
        return None

    def gen():
        for chunk in c.stream(_messages(system, user)):
            if chunk.content:
                yield str(chunk.content)

    return gen()


def complete_json(system: str, user: str) -> dict | None:
    raw = complete(system + "\nReturn ONLY a JSON object, no prose.", user)
    if not raw:
        return None
    m = re.search(r"\{.*\}", raw, re.S)
    try:
        return json.loads(m.group()) if m else None
    except Exception:  # noqa: BLE001
        return None
