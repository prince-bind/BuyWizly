import json

from app.services.chunking import chunk_text
from app.services.search import parse_constraints

CATS, BRANDS = ["Computers", "Phones", "Audio", "Books"], ["Sony", "Lenovo"]


def chat(client, h, msg, sid=None):
    r = client.post("/api/assistant/chat", json={"message": msg, "session_id": sid}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def test_chunking_keeps_headings():
    md = "# Doc\n\n## Returns\nItems return in 30 days. Refund in 7 days.\n\n## Shipping\nFree for Prime."
    cs = chunk_text(md)
    assert {c.section for c in cs} >= {"Returns", "Shipping"} and all(c.text.startswith(c.section) for c in cs)


def test_constraint_parsing():
    c = parse_constraints("best laptop under ₹60,000 in stock", CATS, BRANDS)
    assert (c.category, c.max_price, c.in_stock, c.sort) == ("Computers", 60000, True, "best_rated")
    c = parse_constraints("laptop under -100", CATS, BRANDS)
    assert c.max_price == -100
    c = parse_constraints("Sony headphones between 10k and 25k", CATS, BRANDS)
    assert (c.brand, c.category, c.min_price, c.max_price) == ("Sony", "Audio", 10000, 25000)


def test_product_search_respects_budget(client, demo):
    r = chat(client, demo, "I need a laptop under 60000")
    assert r["intent"] == "product_search" and r["products"]
    assert all(p["price"] <= 60000 and p["category"] == "Computers" for p in r["products"])


def test_product_search_rejects_negative_budget(client, demo):
    r = chat(client, demo, "I need a laptop under -100")
    assert r["intent"] == "product_search"
    assert r["products"] == []
    assert "couldn't find a match" in r["answer"].lower()


def test_policy_rag_grounded_with_sources(client, demo):
    r = chat(client, demo, "How many days do I have to return a laptop?")
    assert r["intent"] == "policy" and r["sources"] and r["confidence"] != "LOW"
    assert "7" in r["answer"]


def test_policy_unknown_does_not_hallucinate(client, demo):
    r = chat(client, demo, "What is the return policy for martian spacecraft engines and quantum toasters?")
    assert r["confidence"] == "LOW" and not r["sources"] and "contact" in r["answer"].lower()


def test_order_tracking_scoped_to_user(client, demo, fresh):
    r = chat(client, demo, "where is my order?")
    assert r["intent"] == "order_status" and len(r["orders"]) >= 1
    other = chat(client, fresh, "track my order")
    assert other["orders"] == []
    oid = r["orders"][0]["id"]
    assert chat(client, fresh, f"status of order #{oid}")["orders"] == []  # cannot read someone else's order


def test_followup_uses_history(client, demo):
    a = chat(client, demo, "show me headphones")
    b = chat(client, demo, "what about under 30000", sid=a["session_id"])
    assert b["products"] and all(p["price"] <= 30000 for p in b["products"])


def test_compare(client, demo):
    r = chat(client, demo, "compare AeroBook Pro 14 vs EverydayBook 15")
    assert r["intent"] == "compare" and len(r["products"]) == 2


def test_streaming_sse(client, demo):
    with client.stream("POST", "/api/assistant/chat/stream", json={"message": "what is the refund timeline"}, headers=demo) as r:
        body = "".join(r.iter_text())
    assert "event: meta" in body and "event: token" in body and "event: done" in body
    done = json.loads(body.split("event: done\ndata: ")[1].split("\n")[0])
    assert client.post("/api/assistant/feedback", json={"log_id": done["log_id"], "rating": 1}, headers=demo).status_code == 200


def test_admin_upload_makes_new_knowledge_answerable(client, demo, admin):
    doc = b"# Gift Wrapping\n\n## Gift wrap service\nGift wrapping costs Rs 49 per item and includes a handwritten card."
    r = client.post("/api/admin/documents", files={"file": ("gift_wrap.md", doc)}, data={"title": "Gift Wrap", "category": "Services"}, headers=admin)
    assert r.status_code == 201 and r.json()["chunk_count"] >= 1
    a = chat(client, demo, "how much does gift wrapping cost?")
    assert "49" in a["answer"] and a["sources"][0]["document"] == "Gift Wrap"
    assert client.delete(f"/api/admin/documents/{r.json()['id']}", headers=admin).status_code == 200
    gone = chat(client, demo, "how much does gift wrapping cost?")
    assert not gone.get("sources") and "49" not in gone["answer"]  # knowledge removed from the index
