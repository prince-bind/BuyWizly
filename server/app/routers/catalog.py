from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import asc, desc, func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Category, Product, Review
from ..schemas import CompareIn, ReviewIn
from ..security import current_user, rate_limit
from ..serializers import product_out
from ..services import llm
from ..services.search import lexical_score, product_doc, search as smart_search
from ..services.vectorstore import get_store, tokenize

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/categories")
def categories(db: Session = Depends(get_db)):
    rows = (db.query(Category.id, Category.name, func.count(Product.id)).outerjoin(Product)
            .group_by(Category.id).order_by(Category.name).all())
    return [{"id": i, "name": n, "count": c} for i, n, c in rows]


@router.get("/brands")
def brands(db: Session = Depends(get_db)):
    return [b for (b,) in db.query(Product.brand).distinct().order_by(Product.brand).all()]


@router.get("/products")
def products(q: str = "", category: str = "", brand: str = "", min_price: float | None = None,
             max_price: float | None = None, min_rating: float = 0, in_stock: bool = False,
             sort: str = "featured", page: int = 1, limit: int = 12, db: Session = Depends(get_db)):
    query = db.query(Product).options(joinedload(Product.category))
    if category:
        query = query.join(Category).filter(Category.name == category)
    if brand:
        query = query.filter(Product.brand == brand)
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)
    if in_stock:
        query = query.filter(Product.stock > 0)
    query = query.filter(Product.rating >= min_rating)
    page, limit = max(1, page), min(max(1, limit), 100)
    order = {"price_asc": asc(Product.price), "price_desc": desc(Product.price), "name": asc(Product.name)}.get(
        sort, desc(Product.rating))
    if q.strip():
        terms = tokenize(q)
        ranked = [(lexical_score(p, terms), p) for p in query.all()]
        ranked = sorted([r for r in ranked if r[0] > 0], key=lambda r: -r[0])
        total, rows = len(ranked), [p for _, p in ranked[(page - 1) * limit: page * limit]]
    else:
        total = query.count()
        rows = query.order_by(order, Product.id).offset((page - 1) * limit).limit(limit).all()
    return {"items": [product_out(p) for p in rows], "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.get("/products/{pid}")
def detail(pid: str, db: Session = Depends(get_db)):
    p = db.query(Product).options(joinedload(Product.category)).filter_by(id=pid).first()
    if not p:
        raise HTTPException(404, "Product not found")
    return product_out(p)


@router.get("/products/{pid}/similar")
def similar(pid: str, db: Session = Depends(get_db)):
    """Content-based recommendations using the product vector index."""
    p = db.query(Product).options(joinedload(Product.category)).filter_by(id=pid).first()
    if not p:
        raise HTTPException(404, "Product not found")
    ids = [h.id for h in get_store("products").query(product_doc(p), k=8) if h.id != pid][:4]
    rows = db.query(Product).options(joinedload(Product.category)).filter(Product.id.in_(ids)).all()
    rows.sort(key=lambda r: ids.index(r.id))
    return [product_out(r) for r in rows]


@router.get("/products/{pid}/reviews")
def reviews(pid: str, db: Session = Depends(get_db)):
    rows = db.query(Review).options(joinedload(Review.user)).filter_by(product_id=pid).order_by(desc(Review.created_at)).all()
    return [{"id": r.id, "rating": r.rating, "title": r.title, "body": r.body, "author": r.user.name,
             "created_at": r.created_at.isoformat()} for r in rows]


@router.post("/products/{pid}/reviews", status_code=201)
def add_review(pid: str, body: ReviewIn, db: Session = Depends(get_db), u=Depends(current_user)):
    p = db.get(Product, pid)
    if not p:
        raise HTTPException(404, "Product not found")
    if db.query(Review).filter_by(product_id=pid, user_id=u.id).first():
        raise HTTPException(409, "You already reviewed this product")
    db.add(Review(product_id=pid, user_id=u.id, **body.model_dump()))
    p.rating = (p.rating * (p.review_count + 10) + body.rating) / (p.review_count + 11)  # Bayesian-style blend
    p.review_count += 1
    db.commit()
    return {"message": "Review added", "rating": round(p.rating, 2)}


@router.get("/products/{pid}/review-summary")
def review_summary(pid: str, db: Session = Depends(get_db), _=Depends(rate_limit)):
    rows = db.query(Review).filter_by(product_id=pid).order_by(desc(Review.created_at)).limit(30).all()
    if len(rows) < 2:
        return {"summary": None, "count": len(rows)}
    text = "\n".join(f"{r.rating}★ {r.title}: {r.body}"[:300] for r in rows)
    out = llm.complete("Summarise these product reviews in 2 sentences: what customers like and what they complain about. "
                       "Use only the reviews.", text)
    if not out:
        avg = sum(r.rating for r in rows) / len(rows)
        out = f"Customers rate this {avg:.1f}★ on average across {len(rows)} reviews."
    return {"summary": out, "count": len(rows)}


@router.post("/products/compare")
def compare(body: CompareIn, db: Session = Depends(get_db), _=Depends(rate_limit)):
    ps = db.query(Product).options(joinedload(Product.category)).filter(Product.id.in_(body.product_ids)).all()
    if len(ps) < 2:
        raise HTTPException(404, "Products not found")
    facts = "\n".join(f"- {p.name}: ₹{int(p.price):,}, {p.rating}★, {p.specs.get('details', '')}. {p.description}" for p in ps)
    out = llm.complete("Compare the products using ONLY the facts given. Give a verdict per use-case (budget, performance, value) in under 120 words.", facts)
    if not out:
        c, b = min(ps, key=lambda p: p.price), max(ps, key=lambda p: p.rating)
        out = f"{c.name} is the cheapest at ₹{int(c.price):,}. {b.name} has the best rating ({b.rating}★)."
    return {"products": [product_out(p) for p in ps], "verdict": out, "used_llm": llm.available()}
