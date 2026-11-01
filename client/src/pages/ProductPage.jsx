import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GitCompareArrows, Heart, ShoppingCart, Sparkles, Truck } from "lucide-react";
import { api, fmtDate, inr } from "../api";
import { useApp } from "../context";
import ProductCard from "../components/ProductCard";
import { ProductImage, Stars } from "../components/ui";

export default function ProductPage() {
  const { id } = useParams();
  const { user, addToCart, toggleWish, wish, toggleCompare, compare, toast, setAuthOpen } = useApp();
  const [p, setP] = useState(null), [similar, setSimilar] = useState([]), [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null), [qty, setQty] = useState(1), [err, setErr] = useState("");
  const [rv, setRv] = useState({ rating: 5, title: "", body: "" });

  const load = () => {
    setErr(""); setP(null);
    api(`/api/products/${id}`).then(setP).catch((e) => setErr(e.message));
    api(`/api/products/${id}/similar`).then(setSimilar).catch(() => setSimilar([]));
    api(`/api/products/${id}/reviews`).then(setReviews).catch(() => {});
    setSummary(null);
    if (user) api(`/api/products/${id}/review-summary`).then((r) => setSummary(r.summary)).catch(() => {});
  };
  useEffect(load, [id, user?.id]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    if (!user) return setAuthOpen(true);
    try { await api(`/api/products/${id}/reviews`, { method: "POST", body: { ...rv, rating: Number(rv.rating) } }); toast("Thanks for your review!"); setRv({ rating: 5, title: "", body: "" }); load(); }
    catch (x) { toast(x.message, "err"); }
  };

  if (err) return <div className="alert err">{err} <Link to="/">Back to shop</Link></div>;
  if (!p) return <div className="card skel detail-skel" />;
  const specs = p.specs?.details ? p.specs.details.split(/,\s*/) : [];
  return (
    <>
      <p className="crumbs muted"><Link to="/">Shop</Link> / <Link to={`/?category=${p.category}`}>{p.category}</Link> / {p.name}</p>
      <div className="detail">
        <div className="card gallery"><ProductImage p={p} /></div>
        <div className="info">
          <span className="brand">{p.brand} · {p.specs?.type || p.category}</span>
          <h1>{p.name}</h1>
          <Stars value={p.rating} count={p.review_count} />
          <div className="price big">{inr(p.price)}</div>
          <p>{p.description}</p>
          {specs.length > 0 && <ul className="specs">{specs.map((s) => <li key={s}>{s}</li>)}</ul>}
          <p className={p.stock > 0 ? "ok" : "bad"}>{p.stock === 0 ? "Out of stock" : p.stock < 10 ? `Only ${p.stock} left in stock` : "In stock"}</p>
          <div className="row buy">
            <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>{Array.from({ length: Math.min(p.stock, 5) || 1 }, (_, i) => <option key={i}>{i + 1}</option>)}</select>
            <button className="btn lg" disabled={!p.stock} onClick={() => addToCart(p.id, qty)}><ShoppingCart size={18} /> Add to cart</button>
            <button className={`btn ghost icon-btn ${wish.includes(p.id) ? "on" : ""}`} onClick={() => toggleWish(p.id)}><Heart size={18} fill={wish.includes(p.id) ? "currentColor" : "none"} /></button>
            <button className={`btn ghost icon-btn ${compare.includes(p.id) ? "on" : ""}`} onClick={() => toggleCompare(p)}><GitCompareArrows size={18} /></button>
          </div>
          <p className="muted note"><Truck size={14} /> Free delivery for Prime · ₹99 under ₹999 for Basic · 30-day returns (7 days for laptops & phones)</p>
        </div>
      </div>

      <section className="section">
        <h2>Customer reviews</h2>
        {summary && <div className="ai-summary"><Sparkles size={16} /> <div><b>AI summary</b><p>{summary}</p></div></div>}
        <div className="reviews">
          <div>{reviews.length === 0 ? <p className="muted">No reviews yet — be the first.</p> : reviews.map((r) => (
            <div className="review card" key={r.id}><div className="row between"><Stars value={r.rating} /><small className="muted">{r.author} · {fmtDate(r.created_at)}</small></div><b>{r.title}</b><p>{r.body}</p></div>
          ))}</div>
          <form className="card review-form" onSubmit={submit}>
            <h4>Write a review</h4>
            <label>Rating<select value={rv.rating} onChange={(e) => setRv({ ...rv, rating: e.target.value })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</select></label>
            <label>Title<input value={rv.title} maxLength={120} onChange={(e) => setRv({ ...rv, title: e.target.value })} /></label>
            <label>Review<textarea rows={3} value={rv.body} onChange={(e) => setRv({ ...rv, body: e.target.value })} /></label>
            <button className="btn">Submit review</button>
          </form>
        </div>
      </section>

      {similar.length > 0 && <section className="section"><h2>Similar products <small className="muted">(vector similarity)</small></h2><div className="grid">{similar.map((s) => <ProductCard key={s.id} p={s} />)}</div></section>}
    </>
  );
}
