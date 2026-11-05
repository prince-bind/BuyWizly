import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChevronRight,
  GitCompareArrows,
  Heart,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { api, fmtDate, inr } from "../api";
import { useApp } from "../context";
import ProductCard from "../components/ProductCard";
import { ProductImage, Stars } from "../components/ui";

export default function ProductPage() {
  const { id } = useParams();
  const {
    user,
    addToCart,
    toggleWish,
    wish,
    toggleCompare,
    compare,
    toast,
    setAuthOpen,
  } = useApp();
  const [p, setP] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [qty, setQty] = useState(1);
  const [err, setErr] = useState("");
  const [rv, setRv] = useState({ rating: 5, title: "", body: "" });

  const load = () => {
    setErr("");
    setP(null);
    api(`/api/products/${id}`).then(setP).catch((e) => setErr(e.message));
    api(`/api/products/${id}/similar`).then(setSimilar).catch(() => setSimilar([]));
    api(`/api/products/${id}/reviews`).then(setReviews).catch(() => {});
    setSummary(null);
    if (user) {
      api(`/api/products/${id}/review-summary`)
        .then((r) => setSummary(r.summary))
        .catch(() => {});
    }
  };

  useEffect(load, [id, user?.id]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    if (!user) return setAuthOpen(true);
    try {
      await api(`/api/products/${id}/reviews`, {
        method: "POST",
        body: { ...rv, rating: Number(rv.rating) },
      });
      toast("Review submitted successfully!");
      setRv({ rating: 5, title: "", body: "" });
      load();
    } catch (x) {
      toast(x.message, "err");
    }
  };

  if (err) {
    return (
      <div className="alert err">
        {err} <Link to="/" className="link" style={{ marginLeft: "8px" }}>Return to catalog</Link>
      </div>
    );
  }

  if (!p) return <div className="card skel detail-skel" />;

  const specs = p.specs?.details ? p.specs.details.split(/,\s*/) : [];
  const saved = wish.includes(p.id);
  const cmp = compare.includes(p.id);

  return (
    <>
      {/* Breadcrumb */}
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Shop</Link>
        <ChevronRight size={13} />
        <Link to={`/?category=${encodeURIComponent(p.category)}`}>{p.category}</Link>
        <ChevronRight size={13} />
        <span style={{ color: "var(--text)", fontWeight: 600 }}>{p.name}</span>
      </nav>

      {/* Modern 2-Column Product Studio Layout */}
      <div className="detail">
        <div className="gallery">
          <ProductImage p={p} />
        </div>

        <div className="info">
          <span className="brand">{p.brand} · {p.specs?.type || p.category}</span>
          <h1>{p.name}</h1>

          <div className="row" style={{ gap: "10px", margin: "2px 0" }}>
            <Stars value={p.rating} count={p.review_count} />
            <span className="muted">·</span>
            <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
              ID: WIZ-{String(p.id).padStart(4, "0")}
            </span>
          </div>

          <div className="price" style={{ fontSize: "2rem", margin: "6px 0" }}>
            {inr(p.price)}
          </div>

          <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{p.description}</p>

          {specs.length > 0 && (
            <div>
              <label style={{ margin: "6px 0 8px" }}>Key Specifications</label>
              <ul className="specs">
                {specs.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="row" style={{ gap: "8px", margin: "4px 0" }}>
            {p.stock === 0 ? (
              <span className="pill" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>
                Sold Out
              </span>
            ) : p.stock < 10 ? (
              <span className="pill" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                Only {p.stock} units left
              </span>
            ) : (
              <span className="pill" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
                In Stock & Ready to Ship
              </span>
            )}
          </div>

          {/* Action Row */}
          <div className="buy-row">
            <select
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              disabled={p.stock === 0}
              aria-label="Quantity"
            >
              {Array.from({ length: Math.min(p.stock, 5) || 1 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>

            <button
              className="btn lg"
              disabled={!p.stock}
              onClick={() => addToCart(p.id, qty)}
              style={{ flex: 1 }}
            >
              <ShoppingBag size={18} strokeWidth={2.2} />
              <span>{p.stock === 0 ? "Out of Stock" : "Add to Bag"}</span>
            </button>

            <button
              className={`icon ${saved ? "on" : ""}`}
              style={{ width: "42px", height: "42px" }}
              onClick={() => toggleWish(p.id)}
              aria-label="Wishlist"
              title={saved ? "Saved in wishlist" : "Add to wishlist"}
            >
              <Heart size={18} fill={saved ? "currentColor" : "none"} strokeWidth={2.2} />
            </button>

            <button
              className={`icon ${cmp ? "on" : ""}`}
              style={{ width: "42px", height: "42px" }}
              onClick={() => toggleCompare(p)}
              aria-label="Compare"
              title={cmp ? "In comparison dock" : "Add to comparison"}
            >
              <GitCompareArrows size={18} strokeWidth={2.2} />
            </button>
          </div>

          <div className="note">
            <Truck size={17} style={{ flex: "none", color: "var(--text)" }} />
            <div>
              <b>Free Delivery on orders above ₹999</b> · 30-day verified returns (7 days for laptops & phones).
            </div>
          </div>

          {/* AI Sentiment Summary */}
          {summary && (
            <div className="ai-summary">
              <Sparkles size={18} />
              <div>
                <b style={{ display: "block", marginBottom: "4px", fontSize: "0.88rem" }}>
                  AI Review Consensus
                </b>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text)", lineHeight: 1.55 }}>
                  {summary}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer Reviews Section */}
      <section className="section">
        <div className="row between" style={{ marginBottom: "16px" }}>
          <h2>Customer Reviews</h2>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            {reviews.length} submission{reviews.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="reviews">
          <div>
            {reviews.length === 0 ? (
              <p className="muted">No reviews yet — be the first to share your experience.</p>
            ) : (
              reviews.map((r) => (
                <div className="card" key={r.id} style={{ marginBottom: "12px" }}>
                  <div className="row between" style={{ marginBottom: "6px" }}>
                    <div className="row" style={{ gap: "8px" }}>
                      <Stars value={r.rating} />
                      <b style={{ fontSize: "0.95rem" }}>{r.title}</b>
                    </div>
                    <small className="muted">{fmtDate(r.created_at)}</small>
                  </div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    {r.body}
                  </p>
                </div>
              ))
            )}
          </div>

          <form className="card" onSubmit={submit}>
            <h4 style={{ margin: "0 0 12px" }}>Write a Review</h4>
            <label>Rating</label>
            <select
              value={rv.rating}
              onChange={(e) => setRv({ ...rv, rating: e.target.value })}
              style={{ width: "100%", marginBottom: "10px" }}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} ★ {n === 5 ? "Excellent" : n === 4 ? "Good" : n === 3 ? "Average" : "Poor"}
                </option>
              ))}
            </select>

            <label>Headline</label>
            <input
              required
              maxLength={120}
              placeholder="Summary of your review"
              value={rv.title}
              onChange={(e) => setRv({ ...rv, title: e.target.value })}
              style={{ width: "100%", marginBottom: "10px" }}
            />

            <label>Feedback</label>
            <textarea
              required
              rows={3}
              placeholder="What stood out about the product?"
              value={rv.body}
              onChange={(e) => setRv({ ...rv, body: e.target.value })}
              style={{ width: "100%", marginBottom: "14px" }}
            />

            <button className="btn" style={{ width: "100%" }}>
              Submit Review
            </button>
          </form>
        </div>
      </section>

      {/* Similar Products */}
      {similar.length > 0 && (
        <section className="section">
          <h2 style={{ marginBottom: "16px" }}>Similar Products</h2>
          <div className="grid">
            {similar.map((s) => (
              <ProductCard key={s.id} p={s} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
