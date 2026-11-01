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
  useEffect(() => { if (user) api("/api/wishlist").then(setItems).catch(() => {}); }, [user, wish]);
  if (!user) return <Empty icon={<Heart size={44} />} title="Sign in to see your wishlist"><button className="btn" onClick={() => setAuthOpen(true)}>Sign in</button></Empty>;
  if (!items.length) return <Empty icon={<Heart size={44} />} title="Nothing saved yet"><Link to="/">Browse products</Link> and tap the heart.</Empty>;
  return <><h1>Wishlist</h1><div className="grid">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div></>;
}
