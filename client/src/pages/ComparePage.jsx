import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GitCompareArrows, Sparkles } from "lucide-react";
import { api, inr } from "../api";
import { useApp } from "../context";
import { Empty, ProductImage, Stars } from "../components/ui";

export default function ComparePage() {
  const { compare, user, setAuthOpen, addToCart } = useApp();
  const [res, setRes] = useState(null), [err, setErr] = useState("");
  useEffect(() => {
    setRes(null); setErr("");
    if (compare.length >= 2 && user) api("/api/products/compare", { method: "POST", body: { product_ids: compare } }).then(setRes).catch((e) => setErr(e.message));
  }, [compare, user]);
  if (compare.length < 2) return <Empty icon={<GitCompareArrows size={44} />} title="Pick 2–3 products to compare"><Link to="/">Browse products</Link> and tap the compare icon.</Empty>;
  if (!user) return <Empty icon={<GitCompareArrows size={44} />} title="Sign in for AI comparison"><button className="btn" onClick={() => setAuthOpen(true)}>Sign in</button></Empty>;
  if (err) return <div className="alert err">{err}</div>;
  if (!res) return <div className="card skel detail-skel" />;
  const rows = [["Price", (p) => inr(p.price)], ["Rating", (p) => <Stars value={p.rating} />], ["Brand", (p) => p.brand], ["Category", (p) => p.category], ["Availability", (p) => (p.stock ? `${p.stock} in stock` : "Out of stock")], ["Highlights", (p) => p.specs?.details]];
  return (
    <>
      <h1>Compare products</h1>
      <div className="ai-summary"><Sparkles size={16} /><div><b>AI verdict</b><p>{res.verdict}</p></div></div>
      <div className="table-wrap"><table className="compare">
        <thead><tr><th />{res.products.map((p) => <th key={p.id}><ProductImage p={p} /><Link to={`/product/${p.id}`}>{p.name}</Link><button className="btn sm" onClick={() => addToCart(p.id)}>Add to cart</button></th>)}</tr></thead>
        <tbody>{rows.map(([label, fn]) => <tr key={label}><th>{label}</th>{res.products.map((p) => <td key={p.id}>{fn(p)}</td>)}</tr>)}</tbody>
      </table></div>
    </>
  );
}
