"""Offline RAG evaluation.  Usage:  python -m eval.run_eval [--k 4]

Metrics (over eval/golden_set.json + adversarial out-of-scope questions):
  * Hit@k        - was the expected source document in the top-k retrieved chunks?
  * MRR          - mean reciprocal rank of the expected document
  * Answer match - does the generated answer contain a required fact?
  * Refusal rate - out-of-scope questions that are correctly refused (no hallucination)
Works with or without an LLM key; run it before/after changing chunk size or the retriever.
"""
import argparse
import json
import os
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite:///./eval.db")

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.services import rag  # noqa: E402

OUT_OF_SCOPE = ["What is the capital of Mongolia?", "Write me a poem about the ocean",
                "Do you sell spacecraft engines and quantum toasters?", "What is the weather in Delhi today?"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=4)
    k = ap.parse_args().k
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        rag.sync_index(db)
    gold = json.loads((Path(__file__).parent / "golden_set.json").read_text())
    hit = rr = ans = 0
    for g in gold:
        hits = rag.retrieve(g["q"], k=k)
        titles = [h.metadata.get("title") for h in hits]
        if g["doc"] in titles:
            hit += 1
            rr += 1 / (titles.index(g["doc"]) + 1)
        text = rag.answer(g["q"])["answer"].lower()
        ok = any(m.lower() in text for m in g["must"])
        ans += ok
        print(f"{'✓' if g['doc'] in titles else '✗'} retrieval | {'✓' if ok else '✗'} answer | {g['q']}")
    refused = sum(rag.answer(q)["confidence"] == "LOW" for q in OUT_OF_SCOPE)
    n = len(gold)
    print(f"\nHit@{k}: {hit / n:.0%}   MRR: {rr / n:.2f}   Answer match: {ans / n:.0%}   "
          f"Out-of-scope refusal: {refused}/{len(OUT_OF_SCOPE)}")


if __name__ == "__main__":
    main()
