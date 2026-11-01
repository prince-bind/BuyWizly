import logging
from datetime import timedelta

from sqlalchemy.orm import Session

from .config import settings
from .models import Category, Order, OrderItem, Product, ShipmentEvent, User, now
from .security import hash_password
from .seed_data import images, products

log = logging.getLogger(__name__)
DEMO_EMAIL, DEMO_PASSWORD = "demo@shopsmart.ai", "ShopSmart123!"
STAGES = ["Order confirmed", "Processing", "Shipped", "Out for delivery", "Delivered"]


def seed(db: Session):
    cats = {c.name: c.id for c in db.query(Category).all()}
    for name in sorted({p[2] for p in products}):
        if name not in cats:
            c = Category(name=name)
            db.add(c)
            db.flush()
            cats[name] = c.id
    for id_, name, cat, brand, desc, price, rating, stock, kind, specs in products:
        if not db.get(Product, id_):
            db.add(Product(id=id_, name=name, category_id=cats[cat], brand=brand, description=desc, price=price,
                           rating=rating, stock=stock, image_url=images.get(cat, ""),
                           specs={"type": kind, "details": specs}))
    _promote_admins(db)
    if not settings.seed_demo:
        db.commit()
        return
    demo = db.query(User).filter_by(email=DEMO_EMAIL).first()
    if not demo:
        demo = User(name="Demo Shopper", email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD),
                    membership_tier="Prime", is_admin=False)
        db.add(demo)
    elif demo.is_admin and DEMO_EMAIL not in settings.admin_email_set:
        demo.is_admin = False  # the shared demo account must never be an admin
    db.commit()
    if not db.query(Order).filter_by(user_id=demo.id).count():
        _demo_orders(db, demo)


def _promote_admins(db: Session):
    """Users whose email is listed in ADMIN_EMAILS become admins, even if they registered earlier."""
    wanted = settings.admin_email_set - {DEMO_EMAIL}
    if not wanted:
        return
    for u in db.query(User).filter(User.email.in_(wanted), User.is_admin.is_(False)).all():
        u.is_admin = True
        log.info("Promoted %s to admin (ADMIN_EMAILS)", u.email)
    db.flush()


def _demo_orders(db: Session, user: User):
    """Give the demo account orders in different states so tracking/returns/cancel can be shown."""
    spec = [("LAP102", 1, 4, 12), ("AUD301", 1, 2, 3), ("BOK601", 2, 0, 0)]  # (product, qty, stage idx, days ago)
    for pid, qty, stage, days in spec:
        p = db.get(Product, pid)
        if not p:
            continue
        created = now() - timedelta(days=days)
        o = Order(user_id=user.id, subtotal=p.price * qty, total=p.price * qty, status=STAGES[stage].replace("Order confirmed", "Confirmed"),
                  payment_method="UPI", created_at=created,
                  shipping_address={"name": user.name, "line1": "221B Residency Road", "city": "Bengaluru", "pincode": "560025", "phone": "9876543210"})
        o.items.append(OrderItem(product_id=pid, quantity=qty, price=p.price))
        for i in range(stage + 1):
            o.events.append(ShipmentEvent(status=STAGES[i], timestamp=created + timedelta(hours=10 * i)))
        db.add(o)
    db.commit()
