"""Product discovery: constraint parsing + hybrid (semantic + keyword + rating) ranking.

Hard constraints (budget, category, brand, stock) are applied in SQL and are never delegated to
the LLM or the embedding model - semantic similarity only ranks products inside that safe set.
"""
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from ..models import Category, Product
from .vectorstore import get_store, tokenize

SYNONYMS = {
    "Computers": ["laptop", "notebook", "computer", "macbook", "pc"],
    "Phones": ["phone", "smartphone", "mobile", "android", "iphone"],
    "Audio": ["headphone", "earbud", "earphone", "speaker", "audio", "soundbar", "airpod"],
    "Home": ["air purifier", "coffee maker", "desk lamp", "home"],
    "Wearables": ["smartwatch", "smart watch", "fitness band", "wearable", "watch"],
    "Books": ["book", "novel", "paperback"],
    "Fashion": ["backpack", "tote", "sneaker", "fashion", "bag", "shoe"],
    "Kitchen": ["air fryer", "kettle", "cookware", "mixer", "pan", "kitchen"],
    "Groceries": ["grocery", "coffee bean", "snack", "food"],
    "Health": ["massager", "massage gun", "skincare", "health"],
    "Gaming": ["gaming", "controller", "mechanical keyboard", "console"],
    "Furniture": ["furniture", "desk", "chair"],
    "Cameras": ["camera", "dslr", "mirrorless"],
}
WORD = lambda t: r"(?<![a-z0-9])" + re.escape(t) + r"s?(?![a-z0-9])"


@dataclass
class Constraints:
    category: str | None = None
    brand: str | None = None
    min_price: float | None = None
    max_price: float | None = None
    min_rating: float | None = None
    in_stock: bool = False
    sort: str | None = None  # cheapest | best_rated
    keywords: list[str] = field(default_factory=list)

    def as_dict(self):
        return {k: v for k, v in self.__dict__.items() if v not in (None, False, [])}


def _num(s: str) -> float:
    s = s.lower().replace(",", "").strip()
    mult = 1000 if s.endswith("k") else 100000 if s.endswith("l") else 1
    return float(s.rstrip("kl")) * mult


def parse_constraints(text: str, categories: list[str], brands: list[str]) -> Constraints:
    t = text.lower()
    c = Constraints()
    n = r"₹?\s*(?:rs\.?\s*)?(-?[\d,]+(?:\.\d+)?\s*[kl]?)"
    if m := re.search(rf"(?:between|from)\s+{n}\s*(?:and|to|-)\s*{n}", t):
        c.min_price, c.max_price = sorted((_num(m.group(1)), _num(m.group(2))))
    else:
        if m := re.search(rf"(?:under|below|less than|within|upto|up to|max(?:imum)?|budget(?: of)?|at most)\s*{n}", t):
            c.max_price = _num(m.group(1))
        elif m := re.search(rf"(?:₹|rs\.?|inr)\s*([\d,]+\s*[kl]?)", t):
            c.max_price = _num(m.group(1))
        if m := re.search(rf"(?:above|over|more than|at least|minimum|starting)\s*{n}", t):
            c.min_price = _num(m.group(1))
    if m := re.search(r"(\d(?:\.\d)?)\s*\+?\s*(?:stars?|rating)", t):
        c.min_rating = float(m.group(1))
    c.in_stock = bool(re.search(r"in stock|available|ready to ship", t))
    if re.search(r"cheap|lowest price|budget friendly|affordable", t):
        c.sort = "cheapest"
    elif re.search(r"best rated|top rated|highest rated|best", t):
        c.sort = "best_rated"
    for cat in categories:
        terms = SYNONYMS.get(cat, []) + [cat.lower()]
        if any(re.search(WORD(x), t) for x in sorted(terms, key=len, reverse=True)):
            c.category = cat
            break
    for b in brands:
        if re.search(WORD(b.lower()), t):
            c.brand = b
            break
    stop = {"under", "below", "with", "good", "best", "find", "show", "that", "this", "from", "have", "need",
            "want", "looking", "recommend", "suggest", "please", "something", "cheap", "affordable"}
    c.keywords = [w for w in tokenize(t) if len(w) > 2 and w not in stop and not w.isdigit()]
    return c


def lexical_score(product, terms: list[str]) -> float:
    specs = product.specs or {}
    name, brand = product.name.lower(), product.brand.lower()
    kind = str(specs.get("type", "")).lower()
    details = str(specs.get("details", "")).lower()
    desc_ = product.description.lower()
    words = set(tokenize(" ".join([name, brand, kind, details, desc_])))
    score = matched = 0.0
    for t in terms:
        if t in words:
            matched += 1
            score += 1 + (2.5 if t in name else 2 if t in kind else 1.5 if t in brand else 1 if t in desc_ else 0.8)
        elif len(t) >= 4:
            sim = max((SequenceMatcher(None, t, w).ratio() for w in words if len(w) >= 4), default=0)
            if sim >= 0.78:
                matched += 1
                score += sim * 0.7
    return score + (matched / len(terms)) * 1.5 if matched and terms else 0.0


def product_doc(p) -> str:
    s = p.specs or {}
    return f"{p.name} by {p.brand}. {p.category.name if p.category else ''} {s.get('type', '')}. {p.description} {s.get('details', '')}"


def index_products(db: Session) -> int:
    st = get_store("products")
    prods = db.query(Product).options(joinedload(Product.category)).all()
    if st.count() >= len(prods):
        return st.count()
    st.upsert([p.id for p in prods], [product_doc(p) for p in prods],
              [{"category": p.category.name, "brand": p.brand} for p in prods])
    return st.count()


def search(db: Session, text: str, limit: int = 8, constraints: Constraints | None = None) -> dict:
    cats = [c.name for c in db.query(Category).all()]
    brands = [b for (b,) in db.query(Product.brand).distinct().all()]
    c = constraints or parse_constraints(text, cats, brands)
    q = db.query(Product).options(joinedload(Product.category))
    if c.category:
        q = q.join(Category).filter(Category.name == c.category)
    if c.brand:
        q = q.filter(Product.brand == c.brand)
    if c.max_price is not None:
        q = q.filter(Product.price <= c.max_price)
    if c.min_price is not None:
        q = q.filter(Product.price >= c.min_price)
    if c.min_rating:
        q = q.filter(Product.rating >= c.min_rating)
    if c.in_stock:
        q = q.filter(Product.stock > 0)
    cands = q.all()

    ranks: dict[str, float] = {}
    try:
        for i, h in enumerate(get_store("products").query(text, k=30)):
            ranks[h.id] = h.score
    except Exception:  # noqa: BLE001
        pass
    terms = [k for k in c.keywords if k not in (c.category or "").lower()] or c.keywords
    scored = []
    for p in cands:
        lex, sem = lexical_score(p, terms), ranks.get(p.id, 0.0)
        if terms and lex == 0 and sem == 0 and not (c.category and len(terms) <= 1):
            continue
        score = lex + sem * 4 + p.rating * 0.4 + (0.3 if p.stock else -2)
        scored.append((score, p, lex, sem))
    key = {"cheapest": lambda x: x[1].price, "best_rated": lambda x: -x[1].rating}.get(c.sort)
    scored.sort(key=(lambda x: (key(x), -x[0])) if key else (lambda x: -x[0]))

    results = []
    for score, p, lex, sem in scored[:limit]:
        why = []
        if c.category:
            why.append(f"{c.category}")
        if c.max_price:
            why.append(f"within ₹{int(c.max_price):,}")
        if sem > 0.25 or lex > 2:
            why.append("closely matches your description")
        if p.rating >= 4.5:
            why.append(f"rated {p.rating:.1f}★")
        results.append({"product": p, "reason": ", ".join(why) or p.description[:80], "score": round(score, 2)})

    alternatives = []
    if not results and c.max_price and c.max_price > 0:  # "nearly fits" fallback for positive budgets
        relaxed = Constraints(**{**c.__dict__, "max_price": c.max_price * 1.3})
        alt = search(db, text, limit=3, constraints=relaxed)
        alternatives = alt["results"]
    return {"constraints": c, "results": results, "alternatives": alternatives, "total_candidates": len(cands)}
