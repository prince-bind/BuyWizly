# AskCart 🛍️✨

A full-stack e-commerce app with a **RAG-powered shopping assistant**. Customers describe what they want in plain English, track orders, compare products, and ask policy questions — answers are **grounded in your documents and cite their sources**.

> FastAPI · React · ChromaDB · Groq (gpt-oss-20b) · LangChain · PostgreSQL/SQLite · SSE streaming

## What makes it more than a chatbot demo

| Capability | How it works |
|---|---|
| **RAG over policy docs** | Heading-aware chunking → embeddings in ChromaDB (cosine) → hybrid retrieval (dense + keyword re-rank) → numbered citations |
| **Hallucination guard** | Answerability gate: refuses when top score < threshold *or* the passage covers < 34 % of the question's keywords — no LLM call, an honest "I don't know" |
| **Agent with tool routing** | LLM JSON router (uses chat history for follow-ups) + deterministic rule fallback → tools: product search, order lookup, policy RAG, compare |
| **Constraint-safe product search** | Budget / category / brand / rating parsed from text and enforced **in SQL**; embeddings only *rank* inside the safe set |
| **Streaming UX** | Server-Sent Events: `meta` (cards, sources, reasoning steps) → `token`s → `done`; abortable |
| **Transparent AI** | "How I answered" trace, source snippets with relevance scores, confidence badge, 👍/👎 feedback logged per answer |
| **Works with no API key** | Extractive answer fallback + in-memory TF-IDF vector store → tests, CI and demos run offline |
| **Evaluation harness** | `python -m eval.run_eval` → Hit@k, MRR, answer match, out-of-scope refusal over a golden set |
| **Admin console** | Upload PDF/MD/TXT/JSON (auto-chunk + index), delete (removes vectors), rebuild index, RAG playground, analytics, **knowledge-gap list** of unanswered questions |
| **Real commerce flows** | Cart, coupons, checkout with stock locking, order **cancel (restores stock)**, **returns with 7/30-day rules**, shipment timeline, reviews, wishlist, compare, similar products |
| **Security** | bcrypt, JWT, role-based admin (no hardcoded emails), per-user order scoping (tested), rate limiting, input validation, prompt-injection-aware prompts |

## Architecture

```
React (Vite, Router)  ──REST/SSE──▶  FastAPI
                                      ├─ routers/    auth · catalog · shop · assistant · admin
                                      ├─ services/
                                      │    agent.py        route → act → respond
                                      │    rag.py          ingest · hybrid retrieve · gate · cite
                                      │    search.py       constraint parser + hybrid ranking
                                      │    chunking.py     heading-aware splitter
                                      │    vectorstore.py  Chroma Cloud (+ auto-fallback) ⇄ in-memory TF-IDF
                                      │    llm.py          Groq via LangChain (optional)
                                      └─ SQLAlchemy ─▶ PostgreSQL / SQLite   |   ChromaDB
```

## Quick start

```bash
# Backend
cd server && python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt   # runtime deps + pytest
cp .env.example .env            # add GROQ_API_KEY (free at console.groq.com) – optional
uvicorn app.main:app --reload   # http://localhost:8000/docs

# Frontend
cd client && cp .env.example .env && npm install && npm run dev   # http://localhost:5173
```
Demo login: `demo@shopsmart.ai` / `ShopSmart123!` (standard user; seeded with orders in different states).

**Try in the chat:** “laptop under ₹60,000 for coding” → “what about under 40000?” · “where is my order?” · “how many days to return a laptop?” · “compare AeroBook Pro 14 vs EverydayBook 15” · upload a PDF in Admin, then ask about it.

## Tests & evaluation

```bash
cd server
python -m pytest -q                         # 26 tests: auth, checkout/cancel, returns, data privacy, RAG, SSE, admin upload→answerable
VECTOR_BACKEND=memory python -m eval.run_eval
```
Offline result (no LLM, TF-IDF store): **Hit@4 100 % · MRR 0.94 · answer match 88 % · out-of-scope refusal 4/4**. Run the same script with Chroma embeddings + Groq to get a before/after comparison.

## Configuration
All settings are environment variables — see `server/.env.example`. Key ones:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | SQLite locally; Neon/Postgres in production (`postgresql://…` works as-is, including Neon's pooler) |
| `GROQ_API_KEY`, `GROQ_MODEL` | Optional — without a key the assistant uses extractive answers |
| `VECTOR_BACKEND` | `auto` (default) → Chroma Cloud when `CHROMA_API_KEY` is set, otherwise in-memory search. `memory` forces the built-in search |
| `CHROMA_API_KEY` / `CHROMA_TENANT` / `CHROMA_DATABASE` | Chroma Cloud. Embeddings are computed by Chroma's hosted model, so the API needs no local model or extra RAM |
| `ADMIN_EMAILS` | Comma-separated; these users become admins (existing users are promoted on startup) |
| `SEED_DEMO` | `true` creates the shared **non-admin** demo account with sample orders |

If Chroma is unreachable or errors at runtime, retrieval transparently falls back to an in-memory mirror, so the assistant keeps answering.

## Deploy backend on Render and frontend on Vercel (Neon + Chroma Cloud, no Docker)

`render.yaml` defines the **`shopsmart-api`** FastAPI web service. Deploy the `client` directory separately as a Vercel Vite project.

1. **Neon:** create a project and copy the connection string.
2. **Push** this repo to GitHub.
3. **Render → New → Blueprint** → select the repo. When prompted, fill in:
   `DATABASE_URL` (Neon), `GROQ_API_KEY`, `CHROMA_API_KEY` / `CHROMA_TENANT` / `CHROMA_DATABASE` (leave blank to use in-memory search), and `ADMIN_EMAILS` (your email).
4. **Deploy the frontend on Vercel.** Import the repository, set the project root to `client`, and use the default Vite build settings (`npm run build`, output directory `dist`).
5. Add `VITE_API_URL=https://<your-api-service>.onrender.com` to the Vercel project environment variables, then redeploy because Vite embeds this value at build time.
6. Set `CORS_ORIGINS=https://<your-vercel-domain>` in the Render API environment variables, without a trailing slash. Add a comma-separated list if you use multiple frontend domains.
7. **Verify:** open `<api-url>/api/health` → `database_connected: true`, then open the Vercel site and sign up with your `ADMIN_EMAILS` address to get the **Admin** console.

Notes: the free API instance sleeps after ~15 min idle (first request then takes about a minute). After enabling Chroma, re-run `python -m eval.run_eval` and re-tune `RAG_MIN_SCORE`, because dense similarity scores differ from the TF-IDF baseline. CI: `.github/workflows/ci.yml`.

---

## 📄 Resume bullets (pick 3–4)

**AskCart — RAG-powered shopping assistant** · *FastAPI, React, ChromaDB, LangChain, Groq (gpt-oss-20b), PostgreSQL*
- Built an end-to-end **RAG pipeline** (heading-aware chunking, ChromaDB embeddings, hybrid dense+keyword retrieval, cited answers) over policy documents, with an **answerability gate** that refuses low-confidence queries instead of hallucinating.
- Designed a **tool-routing agent** (LLM intent router + rule fallback, conversation memory) dispatching to product search, order tracking, policy RAG and comparison; enforced budget/category constraints in SQL so the model can rank but never violate user constraints.
- Implemented **token streaming (SSE)** with rich UI cards, source citations, reasoning traces and thumbs feedback; logged every query for analytics and a *knowledge-gap* report.
- Created an **offline evaluation harness** (Hit@k, MRR, answer match, refusal rate), a 19-test pytest suite and CI; the app degrades gracefully without an LLM key.
- Shipped full commerce flows (cart, coupons, stock-safe checkout, cancel/return rules, order tracking), an admin knowledge-base console, and JWT/RBAC security with per-user data isolation.

## 🎤 Interview talking points
- **Why hybrid retrieval?** Dense embeddings miss exact terms like “SAVE10” or “7 days”; keyword overlap fixes that (0.7 dense / 0.3 keyword).
- **How do you stop hallucination?** Score + keyword-coverage gate, context-only prompt with citations, order data templated from the DB (never LLM-generated), injection-aware system prompt.
- **Why filter in SQL, not the LLM?** LLMs sometimes ignore constraints; SQL can't.
- **How would you scale it?** Redis rate-limit/cache, async LLM calls, Chroma Cloud, background ingestion queue, Alembic, a cross-encoder reranker.
- **How do you evaluate?** Golden set + `eval/run_eval.py`; experiment with chunk size / top-k; next step: LLM-as-judge faithfulness.
