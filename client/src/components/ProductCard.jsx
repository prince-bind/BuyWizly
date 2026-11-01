import { Link } from "react-router-dom";
import { GitCompareArrows, Heart, ShoppingCart } from "lucide-react";
import { useApp } from "../context";
import { inr } from "../api";
import { ProductImage, Stars } from "./ui";

export default function ProductCard({ p }) {
  const { addToCart, toggleWish, wish, toggleCompare, compare } = useApp();
  const saved = wish.includes(p.id), cmp = compare.includes(p.id);
  return (
    <article className="card product">
      <Link to={`/product/${p.id}`} className="img-wrap">
        <ProductImage p={p} />
        {p.stock === 0 ? <span className="badge out">Out of stock</span> : p.stock < 10 && <span className="badge low">Only {p.stock} left</span>}
      </Link>
      <div className="actions-top">
        <button className={`icon ${saved ? "on" : ""}`} onClick={() => toggleWish(p.id)} aria-label="Save to wishlist"><Heart size={16} fill={saved ? "currentColor" : "none"} /></button>
        <button className={`icon ${cmp ? "on" : ""}`} onClick={() => toggleCompare(p)} aria-label="Add to compare"><GitCompareArrows size={16} /></button>
      </div>
      <div className="body">
        <span className="brand">{p.brand} · {p.category}</span>
        <Link to={`/product/${p.id}`} className="name">{p.name}</Link>
        <Stars value={p.rating} count={p.review_count || undefined} />
        <div className="row between">
          <b className="price">{inr(p.price)}</b>
          <button className="btn sm" disabled={p.stock === 0} onClick={() => addToCart(p.id)}><ShoppingCart size={15} /> Add</button>
        </div>
      </div>
    </article>
  );
}
