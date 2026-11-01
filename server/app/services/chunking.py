"""Structure-aware text chunking for RAG.

Markdown is split on headings first so every chunk keeps its section title; long sections are
packed paragraph-by-paragraph up to `size` characters with a small sentence overlap, which keeps
answers that span a chunk boundary retrievable.
"""
import re
from dataclasses import dataclass


@dataclass
class Chunk:
    text: str
    section: str


_HEADING = re.compile(r"^(#{1,4})\s+(.+?)\s*$", re.M)


def _split_sections(text: str, default: str) -> list[tuple[str, str]]:
    marks = list(_HEADING.finditer(text))
    if not marks:
        return [(default, text)]
    out = []
    if text[: marks[0].start()].strip():
        out.append((default, text[: marks[0].start()]))
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        out.append((m.group(2), text[m.end() : end]))
    return out


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def chunk_text(text: str, default_section: str = "General", size: int = 700, overlap: int = 120) -> list[Chunk]:
    text = re.sub(r"\r\n?", "\n", text).strip()
    chunks: list[Chunk] = []
    for section, body in _split_sections(text, default_section):
        body = re.sub(r"[ \t]+", " ", body).strip()
        if not body:
            continue
        paras = [p.strip() for p in re.split(r"\n\s*\n|\n(?=[-*\d]+[.)]?\s)", body) if p.strip()]
        buf = ""
        for para in paras:
            pieces = [para] if len(para) <= size else _sentences(para)
            for piece in pieces:
                if buf and len(buf) + len(piece) + 1 > size:
                    chunks.append(Chunk(buf.strip(), section))
                    tail = _sentences(buf)
                    buf = (tail[-1] if tail and len(tail[-1]) <= overlap else "") + " "
                buf += piece + " "
        if buf.strip():
            chunks.append(Chunk(buf.strip(), section))
    # Prefix the heading so the embedding "knows" which topic the chunk belongs to
    return [Chunk(f"{c.section}: {c.text}", c.section) for c in chunks]
