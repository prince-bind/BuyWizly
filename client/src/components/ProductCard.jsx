import { Link } from "react-router-dom";
import { GitCompareArrows, Heart, ShoppingBag } from "lucide-react";
import { useApp } from "../context";
import { inr } from "../api";
import { ProductImage, Stars } from "./ui";

export default function ProductCard({ p }) {
  const { addToCart, toggleWish, wish, toggleCompare, compare } = useApp();
  const saved = wish.includes(p.id);
  const cmp = compare.includes(p.id);

  return (
    <article className="product">
      {/* Product Image Canvas */}
      <Link to={`/product/${p.id}`} className="img-wrap" aria-label={`View ${p.name}`}>
        <ProductImage p={p} />
        {p.stock === 0 ? (
          <span className="badge">Sold out</span>
        ) : p.stock < 10 ? (
          <span className="badge low">Only {p.stock} left</span>
        ) : null}
      </Link>

      {/* Top Right Quick Actions */}
      <div className="actions-top">
        <button
          className={`icon ${saved ? "on" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            toggleWish(p.id);
          }}
          aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
          title={saved ? "Saved in wishlist" : "Add to wishlist"}
        >
          <Heart size={15} fill={saved ? "currentColor" : "none"} strokeWidth={2.2} />
        </button>
        <button
          className={`icon ${cmp ? "on" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            toggleCompare(p);
          }}
          aria-label="Add to comparison"
          title={cmp ? "In comparison dock" : "Add to comparison"}
        >
          <GitCompareArrows size={15} strokeWidth={2.2} />
        </button>
      </div>

      {/* Product Information */}
      <div className="body">
        <span className="brand">{p.brand} · {p.category}</span>

        <Link to={`/product/${p.id}`} className="name" title={p.name}>
          {p.name}
        </Link>

        <div className="row" style={{ margin: "2px 0" }}>
          <Stars value={p.rating} count={p.review_count || undefined} />
        </div>

        <div className="row between" style={{ marginTop: "auto", paddingTop: "8px" }}>
          <div className="price">{inr(p.price)}</div>

          <button
            className="btn sm"
            disabled={p.stock === 0}
            onClick={() => addToCart(p.id)}
            title={p.stock === 0 ? "Out of stock" : "Add to cart"}
          >
            <ShoppingBag size={14} strokeWidth={2.2} />
            <span>Add</span>
          </button>
        </div>
      </div>
    </article>
  );
}
