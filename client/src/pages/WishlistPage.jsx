import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { api } from "../api";
import { useApp } from "../context";
import ProductCard from "../components/ProductCard";
import { Empty } from "../components/ui";

export default function WishlistPage() {
  const { user, wish, setAuthOpen } = useApp();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (user) {
      api("/api/wishlist")
        .then(setItems)
        .catch(() => {});
    }
  }, [user, wish]);

  if (!user) {
    return (
      <Empty icon={<Heart size={48} />} title="Sign in to view your saved items">
        <p className="muted">Your curated items are preserved across devices in your account.</p>
        <button className="btn sm" onClick={() => setAuthOpen(true)}>
          Sign in
        </button>
      </Empty>
    );
  }

  if (!items.length) {
    return (
      <Empty icon={<Heart size={48} />} title="Your wishlist is empty">
        <p className="muted">
          Save your favorite products for future review by tapping the heart icon on any card.
        </p>
        <Link to="/" className="btn sm">
          Explore Catalog
        </Link>
      </Empty>
    );
  }

  return (
    <>
      <div className="row between wrap-row" style={{ marginBottom: "24px" }}>
        <div>
          <h1>Saved Wishlist</h1>
          <p className="muted" style={{ margin: 0 }}>
            {items.length} saved hardware item{items.length === 1 ? "" : "s"} ready for inspection.
          </p>
        </div>
      </div>
      <div className="grid">
        {items.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </>
  );
}
