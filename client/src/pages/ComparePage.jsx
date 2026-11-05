import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GitCompareArrows, Scale, ShoppingBag, Sparkles } from "lucide-react";
import { api, inr } from "../api";
import { useApp } from "../context";
import { Empty, ProductImage, Stars } from "../components/ui";

export default function ComparePage() {
  const { compare, user, setAuthOpen, addToCart } = useApp();
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setRes(null);
    setErr("");
    if (compare.length >= 2 && user) {
      api("/api/products/compare", {
        method: "POST",
        body: { product_ids: compare },
      })
        .then(setRes)
        .catch((e) => setErr(e.message));
    }
  }, [compare, user]);

  if (compare.length < 2) {
    return (
      <Empty icon={<GitCompareArrows size={48} />} title="Select 2–3 products to compare">
        <p className="muted">
          Click the comparison icon on any product cards in the catalog to dock them here.
        </p>
        <Link to="/" className="btn sm">
          Browse Catalog
        </Link>
      </Empty>
    );
  }

  if (!user) {
    return (
      <Empty icon={<GitCompareArrows size={48} />} title="Sign in for comparative analysis">
        <p className="muted">
          Our grounded engine compares real hardware specifications and renders a head-to-head verdict.
        </p>
        <button className="btn sm" onClick={() => setAuthOpen(true)}>
          Sign in to compare
        </button>
      </Empty>
    );
  }

  if (err) return <div className="alert err">{err}</div>;
  if (!res) return <div className="card skel detail-skel" />;

  const rows = [
    ["Price", (p) => <b className="price" style={{ fontSize: "1.05rem" }}>{inr(p.price)}</b>],
    ["Customer Rating", (p) => <Stars value={p.rating} count={p.review_count} />],
    ["Brand", (p) => p.brand],
    ["Category", (p) => p.category],
    [
      "Inventory",
      (p) => (
        <span
          className={`pill ${p.stock ? "delivered" : "cancelled"}`}
          style={{ fontSize: "0.74rem" }}
        >
          {p.stock ? `${p.stock} in stock` : "Sold out"}
        </span>
      ),
    ],
    ["Key Highlights", (p) => p.specs?.details || "Standard retail specifications"],
  ];

  return (
    <>
      <div className="row between wrap-row" style={{ marginBottom: "20px" }}>
        <div>
          <h1>Head-to-Head Comparison</h1>
          <p className="muted" style={{ margin: 0 }}>
            Side-by-side spec audit and automated synthetic appraisal.
          </p>
        </div>
      </div>

      <div className="ai-summary" style={{ marginBottom: "28px" }}>
        <Scale size={20} style={{ color: "var(--brand-accent)", flex: "none", marginTop: "2px" }} />
        <div>
          <div className="ai-summary-badge">
            <span>Comparative Appraisal</span>
          </div>
          <p style={{ margin: 0, color: "var(--text)", lineHeight: 1.6 }}>{res.verdict}</p>
        </div>
      </div>

      <div className="table-wrap card" style={{ padding: 0 }}>
        <table className="compare">
          <thead>
            <tr>
              <th style={{ width: "160px", background: "var(--surface)" }} />
              {res.products.map((p) => (
                <th key={p.id}>
                  <ProductImage p={p} />
                  <Link to={`/product/${p.id}`} className="name">
                    {p.name}
                  </Link>
                  <button
                    className="btn sm"
                    disabled={!p.stock}
                    onClick={() => addToCart(p.id)}
                    style={{ marginTop: "8px", width: "100%" }}
                  >
                    <ShoppingBag size={14} />
                    <span>Add to Bag</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn]) => (
              <tr key={label}>
                <th>{label}</th>
                {res.products.map((p) => (
                  <td key={p.id}>{fn(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
