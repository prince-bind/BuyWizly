ADDR = {"name": "T", "line1": "12 Main Street", "city": "Pune", "pincode": "411001", "phone": "9999999999"}


def test_health(client):
    h = client.get("/api/health").json()
    assert h["status"] == "ok" and h["vector_backend"] == "memory"


def test_auth_and_admin_flag(client, demo, fresh, admin):
    assert client.get("/api/auth/me", headers=demo).json()["is_admin"] is False
    assert client.get("/api/auth/me", headers=fresh).json()["is_admin"] is False
    assert client.get("/api/auth/me", headers=admin).json()["is_admin"] is True
    assert client.post("/api/auth/register", json={"name": "x", "email": "demo@shopsmart.ai", "password": "Password123"}).status_code == 409
    assert client.post("/api/auth/login", json={"email": "demo@shopsmart.ai", "password": "wrong"}).status_code == 401


def test_catalog_filters(client):
    r = client.get("/api/products", params={"category": "Computers", "max_price": 60000, "sort": "price_asc"}).json()
    assert r["total"] > 0 and all(p["price"] <= 60000 and p["category"] == "Computers" for p in r["items"])
    assert client.get("/api/products", params={"q": "lapto"}).json()["total"] > 0  # typo tolerant
    assert client.get("/api/products/NOPE").status_code == 404


def test_cart_checkout_cancel_flow(client, fresh):
    pid = "GRO902"
    stock0 = client.get(f"/api/products/{pid}").json()["stock"]
    assert client.post("/api/cart", json={"product_id": pid, "quantity": 2}, headers=fresh).status_code == 200
    cart = client.get("/api/cart", headers=fresh).json()
    assert cart["shipping_fee"] == 99 and cart["total"] == cart["subtotal"] + 99  # Basic tier under ₹999 pays shipping
    r = client.post("/api/orders/checkout", json={"address": ADDR, "payment_method": "UPI"}, headers=fresh)
    assert r.status_code == 201
    oid = r.json()["id"]
    assert client.get(f"/api/products/{pid}").json()["stock"] == stock0 - 2
    assert client.get("/api/cart", headers=fresh).json()["items"] == []
    c = client.post(f"/api/orders/{oid}/cancel", headers=fresh)
    assert c.status_code == 200 and c.json()["status"] == "Cancelled"
    assert client.get(f"/api/products/{pid}").json()["stock"] == stock0  # inventory restored
    assert client.post(f"/api/orders/{oid}/cancel", headers=fresh).status_code == 409


def test_coupon_and_validation(client, fresh):
    client.post("/api/cart", json={"product_id": "LAP102", "quantity": 1}, headers=fresh)
    q = client.post("/api/orders/quote", json={"coupon_code": "SAVE10"}, headers=fresh).json()
    assert q["discount"] == 2000  # 10% of 52,990 capped at 2,000
    assert client.post("/api/orders/checkout", json={"address": {**ADDR, "pincode": "12"}}, headers=fresh).status_code == 422
    assert client.post("/api/orders/checkout", json={"address": ADDR, "coupon_code": "BOGUS"}, headers=fresh).status_code == 400


def test_orders_are_private(client, demo, fresh):
    demo_orders = client.get("/api/orders", headers=demo).json()
    assert demo_orders
    assert client.get(f"/api/orders/{demo_orders[0]['id']}", headers=fresh).status_code == 404
    assert client.get("/api/orders", headers=fresh).json() == []


def test_return_rules(client, demo):
    delivered = next(o for o in client.get("/api/orders", headers=demo).json() if o["status"] == "Delivered")
    r = client.post(f"/api/orders/{delivered['id']}/return", json={"reason": "Changed my mind"}, headers=demo)
    assert r.status_code == 409  # laptop delivered 12 days ago: 7-day window closed
    assert "7-day" in r.json()["detail"]


def test_reviews(client, fresh):
    r = client.post("/api/products/AUD301/reviews", json={"rating": 5, "title": "Great", "body": "Love it"}, headers=fresh)
    assert r.status_code == 201
    assert client.post("/api/products/AUD301/reviews", json={"rating": 4}, headers=fresh).status_code == 409
    assert client.get("/api/products/AUD301/reviews").json()[0]["title"] == "Great"


def test_admin_protected(client, fresh, demo, admin):
    assert client.get("/api/admin/documents", headers=fresh).status_code == 403
    assert client.get("/api/admin/documents", headers=demo).status_code == 403
    assert client.get("/api/admin/documents", headers=admin).status_code == 200
    assert client.get("/api/admin/analytics", headers=admin).status_code == 200
