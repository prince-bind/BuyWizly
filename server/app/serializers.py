def product_out(p) -> dict:
    return {"id": p.id, "name": p.name, "category": p.category.name if p.category else "General",
            "brand": p.brand, "description": p.description, "price": p.price, "rating": round(p.rating, 1),
            "review_count": p.review_count, "stock": p.stock, "image_url": p.image_url, "specs": p.specs}


def order_out(o) -> dict:
    return {"id": o.id, "subtotal": o.subtotal, "shipping_fee": o.shipping_fee, "discount": o.discount,
            "total": o.total, "coupon_code": o.coupon_code, "status": o.status,
            "delivery_type": o.delivery_type, "payment_method": o.payment_method,
            "shipping_address": o.shipping_address, "created_at": o.created_at.isoformat(),
            "items": [{"product": product_out(i.product), "quantity": i.quantity, "price": i.price} for i in o.items],
            "events": [{"status": e.status, "timestamp": e.timestamp.isoformat()} for e in o.events],
            "returns": [{"id": r.id, "status": r.status, "reason": r.reason} for r in o.returns]}


def user_out(u) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "membership_tier": u.membership_tier,
            "is_admin": u.is_admin}
