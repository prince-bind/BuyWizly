"""Shopping-assistant agent.

1. ROUTE   - classify intent (LLM JSON router with history; deterministic rules as fallback)
2. ACT     - call the right tool: product search | order lookup | policy RAG | compare
3. RESPOND - generate a grounded answer (LLM) or a deterministic/extractive one when no LLM is set

Every response carries structured metadata (products, orders, sources, confidence, steps) so the UI can
render rich cards and show *how* the answer was produced.
"""
import re
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Iterator

from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from ..models import Order, OrderItem, Product, User
from ..serializers import order_out, product_out
from . import llm, rag
from .search import search

INTENTS = {"product_search", "order_status", "policy", "compare", "smalltalk"}
POLICY_RE = re.compile(r"\b(return|refund|warranty|replace|exchange|shipping|delivery (?:charge|fee|cost|time)|how long|cancel|prime|"
                       r"coupon|promo|discount code|payment|upi|cod|cash on delivery|privacy|policy|invoice)\b", re.I)
ORDER_RE = re.compile(r"\b(track|tracking|my order|my orders|order status|order #?\d+|#\d+|parcel|package|shipment|where is my|delivered yet)\b", re.I)
PRODUCT_RE = re.compile(r"\b(buy|looking for|recommend|suggest|need|want|show|find|best|cheap|under|below|budget)\b", re.I)


@dataclass
class Prepared:
    intent: str
    meta: dict = field(default_factory=dict)
    final_text: str | None = None
    system: str | None = None
    prompt: str | None = None
    fallback: str = ""
    used_llm: bool = False


# ------------------------------------------------------------------ routing
def _rule_route(msg: str) -> str:
    if re.search(r"\bcompare\b|\bvs\.?\b|\bversus\b|\bdifference between\b", msg, re.I):
        return "compare"
    if ORDER_RE.search(msg) and not re.match(r"\s*(how|what|can|is|are|do)\b.*\b(cancel|return|policy)\b", msg, re.I):
        return "order_status"
    if POLICY_RE.search(msg):
        return "policy"
    if PRODUCT_RE.search(msg):
        return "product_search"
    if re.match(r"\s*(hi|hello|hey|thanks|thank you|help|who are you)\b", msg, re.I):
        return "smalltalk"
    return "general"


def _llm_route(msg: str, history: list[dict]) -> tuple[str, str] | None:
    if not llm.available():
        return None
    hist = "\n".join(f"{m['role']}: {m['content'][:200]}" for m in history[-6:])
    r = llm.complete_json(
        "Classify the latest customer message for an e-commerce assistant. intent must be one of: "
        "product_search (finding/recommending products), order_status (tracking the customer's own orders), "
        "policy (returns, refunds, shipping, warranty, payments, coupons, membership), compare (comparing products), "
        'smalltalk. Also rewrite the message as a standalone query using the conversation. '
        'Format: {"intent": "...", "standalone_query": "..."}',
        f"Conversation:\n{hist}\nLatest message: {msg}")
    if r and r.get("intent") in INTENTS:
        return r["intent"], (r.get("standalone_query") or msg)
    return None


def _rewrite_followup(db: Session, msg: str, history: list[dict]) -> str:
    """Cheap follow-up resolution: 'what about under 50000?' inherits the previous product request."""
    prev = next((m["content"] for m in reversed(history) if m["role"] == "user"), None)
    if prev and len(msg.split()) <= 7 and not re.search(r"laptop|phone|headphone|watch|book|camera|speaker", msg, re.I):
        return f"{prev} {msg}"
    return msg


# ------------------------------------------------------------------ tools
def _tool_products(db: Session, query: str) -> Prepared:
    r = search(db, query)
    c = r["constraints"]
    items = r["results"][:4]
    steps = [f"Parsed constraints: {c.as_dict() or 'none'}", f"{r['total_candidates']} products passed hard filters (SQL)",
             "Ranked with hybrid semantic + keyword + rating score"]
    meta = {"products": [dict(product_out(i["product"]), reason=i["reason"]) for i in items], "steps": steps,
            "applied_filters": {k: v for k, v in c.as_dict().items() if k != "keywords"},
            "suggestions": ["Only show in-stock items", "Which has the best rating?", "Compare the top two"]}
    if not items:
        alt = r["alternatives"][:3]
        meta["products"] = [dict(product_out(i["product"]), reason="slightly above your budget") for i in alt]
        txt = ("I couldn't find a match within that budget." + (" Here are close options a little above it — want me to widen the budget?" if alt
               else " Could you share a category or relax the budget?"))
        return Prepared("product_search", meta, final_text=txt)
    listing = "\n".join(f"- {i['product'].name} ({i['product'].brand}) ₹{int(i['product'].price):,}, {i['product'].rating}★, "
                        f"stock {i['product'].stock}: {i['product'].specs.get('details', '')}" for i in items)
    top = items[0]["product"]
    fb = (f"I found {len(r['results'])} good match{'es' if len(r['results']) != 1 else ''}. "
          f"Top pick: {top.name} at ₹{int(top.price):,} ({top.rating}★) — {items[0]['reason']}.")
    return Prepared("product_search", meta, system=(
        "You are a helpful shopping assistant. Recommend ONLY from the listed products. Mention the top 1-2 by name and "
        "price (₹) and why they fit the request. Never invent specs. Max 4 sentences."),
        prompt=f"Customer request: {query}\nProducts:\n{listing}", fallback=fb)


def _order_eta(o: Order) -> str:
    if o.status == "Delivered":
        return f"delivered on {o.events[-1].timestamp:%d %b %Y}" if o.events else "delivered"
    if o.status in ("Cancelled", "Return requested"):
        return o.status.lower()
    return f"expected by {(o.created_at + timedelta(days=5)):%d %b %Y}"


def _tool_orders(db: Session, user: User, msg: str) -> Prepared:
    q = db.query(Order).options(joinedload(Order.items).joinedload(OrderItem.product), joinedload(Order.events),
                                joinedload(Order.returns)).filter_by(user_id=user.id)
    m = re.search(r"(?:order\s*#?\s*|#)(\d+)", msg, re.I)
    if m:
        orders = q.filter(Order.id == int(m.group(1))).all()  # scoped to the user: no cross-account leakage
        if not orders:
            return Prepared("order_status", {"steps": ["Looked up order by id"], "orders": []},
                            final_text=f"I couldn't find order #{m.group(1)} on your account. Please check the number on the Orders page.")
    else:
        orders = q.order_by(desc(Order.created_at)).limit(3).all()
    if not orders:
        return Prepared("order_status", {"steps": ["Looked up your orders"], "orders": []},
                        final_text="You don't have any orders yet. Once you check out I can track them for you here.")
    lines = []
    for o in orders:
        last = o.events[-1] if o.events else None
        lines.append(f"Order #{o.id} ({', '.join(i.product.name for i in o.items)}) is **{o.status}**"
                     + (f", last update '{last.status}' on {last.timestamp:%d %b}" if last else "")
                     + f"; {_order_eta(o)}.")
    return Prepared("order_status", {"orders": [order_out(o) for o in orders], "steps": ["Identified you from your session",
                    f"Fetched {len(orders)} order(s) from the database", "Built status summary from shipment events"],
                    "suggestions": ["How do I return an item?", "Can I cancel an order?"]}, final_text="\n".join(lines))


def _tool_policy(question: str, user: User) -> Prepared:
    p = rag.prepare(question, user.membership_tier)
    steps = ["Hybrid retrieval over policy knowledge base", f"Top relevance {p['hits'][0].score:.2f}" if p["hits"] else "No passages found",
             f"Confidence: {p['confidence']}"]
    meta = {"sources": p["sources"], "confidence": p["confidence"], "steps": steps,
            "suggestions": ["What is the refund timeline?", "Is delivery free for Prime?"]}
    return Prepared("policy", meta, final_text=p["final_text"], system=p["system"], prompt=p["prompt"], fallback=p["fallback"])


def _tool_compare(db: Session, msg: str) -> Prepared:
    segs = [s for s in re.split(r"\bvs\.?\b|\bversus\b|\band\b|,|\bcompare\b|\bwith\b|\bdifference between\b|\bor\b", msg, flags=re.I) if len(s.strip()) > 2]
    found: list[Product] = []
    for s in segs:
        r = search(db, s.strip(), limit=1)["results"]
        if r and r[0]["product"].id not in {p.id for p in found}:
            found.append(r[0]["product"])
    found = found[:3]
    if len(found) < 2:
        return Prepared("compare", {"steps": ["Tried to resolve product names"]},
                        final_text="Tell me which two or three products to compare, e.g. “compare AeroBook Pro 14 vs EverydayBook 15”.")
    facts = "\n".join(f"- {p.name}: ₹{int(p.price):,}, {p.rating}★ ({p.review_count} reviews), stock {p.stock}, {p.specs.get('details', '')}" for p in found)
    cheapest, best = min(found, key=lambda p: p.price), max(found, key=lambda p: p.rating)
    fb = f"{cheapest.name} is the most affordable (₹{int(cheapest.price):,}); {best.name} is the highest rated ({best.rating}★)."
    return Prepared("compare", {"products": [product_out(p) for p in found], "compare": True,
                    "steps": ["Resolved product names to catalog items", "Compared specs, price and ratings"]},
                    system="Compare the products using ONLY the facts given. Give a one-line verdict per use-case (budget, performance, value). Max 6 sentences.",
                    prompt=facts, fallback=fb)


SMALLTALK = ("Hi! I'm ShopSmart's assistant. I can **find products** by need and budget, **track your orders**, "
             "**compare items**, and answer **return, shipping, warranty and payment** questions from our policies.")


# ------------------------------------------------------------------ entry points
def prepare(db: Session, user: User, message: str, history: list[dict]) -> Prepared:
    msg = message.strip()
    routed = _llm_route(msg, history)
    intent, standalone = routed if routed else (_rule_route(msg), None)
    if intent == "product_search":
        prep = _tool_products(db, standalone or _rewrite_followup(db, msg, history))
    elif intent == "order_status":
        prep = _tool_orders(db, user, msg)
    elif intent == "policy":
        prep = _tool_policy(standalone or msg, user)
    elif intent == "compare":
        prep = _tool_compare(db, msg)
    elif intent == "general":  # unknown: only answer if the knowledge base is confident, else offer help
        prep = _tool_policy(msg, user)
        if prep.meta["confidence"] == "LOW":
            prep = Prepared("smalltalk", {"suggestions": ["Find a laptop under ₹60000", "Track my order", "What is the return policy?"]},
                            final_text="I'm not sure I can help with that one. " + SMALLTALK)
    else:
        prep = Prepared("smalltalk", {"suggestions": ["Find a laptop under ₹60000", "Track my order", "What is the return policy?"]}, final_text=SMALLTALK)
    prep.meta.setdefault("steps", [])
    prep.meta["steps"].insert(0, f"Intent: {prep.intent} ({'LLM router' if routed else 'rule router'})")
    prep.meta["intent"] = prep.intent
    return prep


def generate(prep: Prepared) -> tuple[str, bool]:
    if prep.final_text is not None:
        return prep.final_text, False
    out = llm.complete(prep.system, prep.prompt)
    prep.used_llm = bool(out)
    return (out, True) if out else (prep.fallback, False)


def iter_text(prep: Prepared) -> Iterator[str]:
    """Token stream for SSE. Falls back to word-chunking deterministic text."""
    if prep.final_text is None:
        try:
            gen = llm.stream(prep.system, prep.prompt)
            if gen:
                got = False
                for tok in gen:
                    got = True
                    prep.used_llm = True
                    yield tok
                if got:
                    return
        except Exception:  # noqa: BLE001
            pass
    text = prep.final_text if prep.final_text is not None else prep.fallback
    for w in re.findall(r"\S+\s*", text):
        yield w
