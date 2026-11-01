from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import CartItem, Order, OrderItem, Product, ReturnRequest, ShipmentEvent, WishlistItem, now
from ..schemas import CartUpdate, Checkout, Quote, ReturnIn
from ..security import current_user
from ..serializers import order_out, product_out
from ..seed import STAGES

router = APIRouter(prefix="/api", tags=["shop"])
COUPONS = {"SAVE10": dict(pct=10, cap=2000, min=2999), "WELCOME5": dict(pct=5, cap=1500, min=0)}
SHORT_RETURN = {"Computers", "Phones"}  # 7-day window per policy


# ------------------------------------------------------------------ pricing
def price_cart(items, user, coupon: str | None):
    subtotal = sum(i.product.price * i.quantity for i in items)
    shipping = 0.0 if user.membership_tier == "Prime" or subtotal >= 999 else 99.0
    discount, msg = 0.0, None
    if coupon:
        c = COUPONS.get(coupon.strip().upper())
        if not c:
            msg = "Invalid coupon code"
        elif subtotal < c["min"]:
            msg = f"Coupon needs a minimum order of ₹{c['min']:,}"
        else:
            discount = min(subtotal * c["pct"] / 100, c["cap"])
            msg = f"{coupon.upper()} applied"
    return {"subtotal": subtotal, "shipping_fee": shipping, "discount": round(discount, 2),
            "total": round(subtotal + shipping - discount, 2), "coupon_message": msg}


def _cart_rows(db, uid):
    return (db.query(CartItem).options(joinedload(CartItem.product).joinedload(Product.category))
            .filter_by(user_id=uid).order_by(CartItem.id).all())


# ------------------------------------------------------------------ cart
@router.get("/cart")
def get_cart(coupon: str | None = None, db: Session = Depends(get_db), u=Depends(current_user)):
    rows = _cart_rows(db, u.id)
    return {"items": [{"product": product_out(r.product), "quantity": r.quantity} for r in rows],
            **price_cart(rows, u, coupon)}


@router.post("/cart")
def cart_add(body: CartUpdate, db: Session = Depends(get_db), u=Depends(current_user)):
    if body.quantity < 1:
        raise HTTPException(400, "Quantity must be positive")
    p = db.get(Product, body.product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    item = db.query(CartItem).filter_by(user_id=u.id, product_id=p.id).first()
    qty = (item.quantity if item else 0) + body.quantity
    if p.stock < qty:
        raise HTTPException(409, f"Only {p.stock} unit(s) of {p.name} available")
    if item:
        item.quantity = qty
    else:
        db.add(CartItem(user_id=u.id, product_id=p.id, quantity=qty))
    db.commit()
    return {"message": "Cart updated"}


@router.patch("/cart/{pid}")
def cart_update(pid: str, body: CartUpdate, db: Session = Depends(get_db), u=Depends(current_user)):
    item = db.query(CartItem).filter_by(user_id=u.id, product_id=pid).first()
    if not item:
        raise HTTPException(404, "Cart item not found")
    if body.quantity <= 0:
        db.delete(item)
    elif body.quantity > db.get(Product, pid).stock:
        raise HTTPException(409, "Requested quantity is not available")
    else:
        item.quantity = body.quantity
    db.commit()
    return {"message": "Cart updated"}


@router.delete("/cart/{pid}")
def cart_remove(pid: str, db: Session = Depends(get_db), u=Depends(current_user)):
    db.query(CartItem).filter_by(user_id=u.id, product_id=pid).delete()
    db.commit()
    return {"message": "Removed"}


# ------------------------------------------------------------------ wishlist
@router.get("/wishlist")
def wishlist(db: Session = Depends(get_db), u=Depends(current_user)):
    ids = [w.product_id for w in db.query(WishlistItem).filter_by(user_id=u.id)]
    rows = db.query(Product).options(joinedload(Product.category)).filter(Product.id.in_(ids)).all()
    return [product_out(p) for p in rows]


@router.post("/wishlist/{pid}")
def wishlist_toggle(pid: str, db: Session = Depends(get_db), u=Depends(current_user)):
    if not db.get(Product, pid):
        raise HTTPException(404, "Product not found")
    item = db.query(WishlistItem).filter_by(user_id=u.id, product_id=pid).first()
    if item:
        db.delete(item)
    else:
        db.add(WishlistItem(user_id=u.id, product_id=pid))
    db.commit()
    return {"saved": item is None}


# ------------------------------------------------------------------ orders
def _order_q(db):
    return db.query(Order).options(joinedload(Order.items).joinedload(OrderItem.product).joinedload(Product.category),
                                   joinedload(Order.events), joinedload(Order.returns))


def _own_order(db, oid, uid) -> Order:
    o = _order_q(db).filter_by(id=oid, user_id=uid).first()
    if not o:
        raise HTTPException(404, "Order not found")
    return o


@router.post("/orders/quote")
def quote(body: Quote, db: Session = Depends(get_db), u=Depends(current_user)):
    return price_cart(_cart_rows(db, u.id), u, body.coupon_code)


@router.post("/orders/checkout", status_code=201)
def checkout(body: Checkout, db: Session = Depends(get_db), u=Depends(current_user)):
    try:
        rows = _cart_rows(db, u.id)
        if not rows:
            raise HTTPException(400, "Your cart is empty")
        pricing = price_cart(rows, u, body.coupon_code)
        if body.coupon_code and pricing["discount"] == 0:
            raise HTTPException(400, pricing["coupon_message"])
        if body.payment_method == "COD" and pricing["total"] > 50000:
            raise HTTPException(400, "Cash on Delivery is available only up to ₹50,000")
        order = Order(user_id=u.id, subtotal=pricing["subtotal"], shipping_fee=pricing["shipping_fee"],
                      discount=pricing["discount"], total=pricing["total"],
                      coupon_code=body.coupon_code.upper() if pricing["discount"] else None,
                      payment_method=body.payment_method, shipping_address=body.address.model_dump())
        db.add(order)
        for r in rows:  # re-validate stock atomically at order time
            p = db.query(Product).filter_by(id=r.product_id).with_for_update().first()
            if p.stock < r.quantity:
                raise HTTPException(409, f"Stock changed for {p.name}. Please review your cart.")
            p.stock -= r.quantity
            order.items.append(OrderItem(product_id=p.id, quantity=r.quantity, price=p.price))
        order.events.append(ShipmentEvent(status="Order confirmed"))
        db.query(CartItem).filter_by(user_id=u.id).delete()
        db.commit()
        return order_out(_order_q(db).filter_by(id=order.id).one())
    except Exception:
        db.rollback()
        raise


@router.get("/orders")
def orders(db: Session = Depends(get_db), u=Depends(current_user)):
    return [order_out(o) for o in _order_q(db).filter_by(user_id=u.id).order_by(desc(Order.created_at)).all()]


@router.get("/orders/{oid}")
def order_detail(oid: int, db: Session = Depends(get_db), u=Depends(current_user)):
    return order_out(_own_order(db, oid, u.id))


@router.post("/orders/{oid}/cancel")
def cancel(oid: int, db: Session = Depends(get_db), u=Depends(current_user)):
    o = _own_order(db, oid, u.id)
    if o.status not in ("Confirmed", "Processing"):
        raise HTTPException(409, f"Orders that are {o.status} can no longer be cancelled")
    for i in o.items:
        i.product.stock += i.quantity  # release inventory
    o.status = "Cancelled"
    o.events.append(ShipmentEvent(status="Cancelled by customer"))
    db.commit()
    return order_out(o)


@router.post("/orders/{oid}/return")
def request_return(oid: int, body: ReturnIn, db: Session = Depends(get_db), u=Depends(current_user)):
    o = _own_order(db, oid, u.id)
    if o.status != "Delivered":
        raise HTTPException(409, "Only delivered orders can be returned")
    delivered = o.events[-1].timestamp if o.events else o.created_at
    window = 7 if any(i.product.category.name in SHORT_RETURN for i in o.items) else 30
    if now() - delivered > timedelta(days=window):
        raise HTTPException(409, f"The {window}-day return window for this order has closed")
    o.returns.append(ReturnRequest(reason=body.reason))
    o.status = "Return requested"
    o.events.append(ShipmentEvent(status="Return requested"))
    db.commit()
    return order_out(o)


@router.post("/orders/{oid}/advance")
def advance_demo(oid: int, db: Session = Depends(get_db), u=Depends(current_user)):
    """DEMO ONLY: simulates the courier moving the parcel to the next stage."""
    o = _own_order(db, oid, u.id)
    cur = "Order confirmed" if o.status == "Confirmed" else o.status
    if cur not in STAGES or cur == STAGES[-1]:
        raise HTTPException(409, "Order cannot advance further")
    nxt = STAGES[STAGES.index(cur) + 1]
    o.status = nxt
    o.events.append(ShipmentEvent(status=nxt))
    db.commit()
    return order_out(o)
