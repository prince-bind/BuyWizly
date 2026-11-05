import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  SearchX,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { api } from "../api";
import { useApp } from "../context";
import ProductCard from "../components/ProductCard";
import { Empty, Skeleton } from "../components/ui";

const QUICK_PROMPTS = [
  "Laptops for coding under ₹60,000",
  "Noise-cancelling headphones",
  "Top rated smartphones",
  "What is the return window for electronics?",
];

export default function Shop() {
  const [sp, setSp] = useSearchParams();
  const { setChatOpen } = useApp();
  const [cats, setCats] = useState([]);
  const [brands, setBrands] = useState([]);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const f = {
    q: sp.get("q") || "",
    category: sp.get("category") || "",
    brand: sp.get("brand") || "",
    max_price: sp.get("max_price") || "",
    min_rating: sp.get("min_rating") || "",
    in_stock: sp.get("in_stock") || "",
    sort: sp.get("sort") || "featured",
    page: Number(sp.get("page") || 1),
  };

  const set = (patch) => {
    const n = new URLSearchParams(sp);
    Object.entries({ page: 1, ...patch }).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    setSp(n);
  };

  useEffect(() => {
    api("/api/categories").then(setCats).catch((e) => setErr(e.message));
    api("/api/brands").then(setBrands).catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    api("/api/products", { params: { ...f, limit: 12 } })
      .then(setData)
      .catch((e) => {
        setErr(e.message);
        setData({ items: [], total: 0, pages: 0 });
      });
  }, [sp]); // eslint-disable-line

  const active = Boolean(f.q || f.category || f.brand || f.max_price || f.min_rating || f.in_stock);

  return (
    <>
      {/* Clean Modern Hero */}
      {!active && (
        <section className="modern-hero">
          <div className="hero-tag">
            <Sparkles size={13} />
            <span>AI-Powered Catalog & Document Grounding</span>
          </div>

          <h1>Smart shopping with verified store intelligence.</h1>
          <p>
            Explore curated electronics with guaranteed stock locking, side-by-side spec comparison,
            and an intelligent assistant grounded in official store policies.
          </p>

          <div className="prompt-chips">
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)" }}>
              Try asking:
            </span>
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                className="prompt-chip"
                onClick={() => setChatOpen(true)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>
      )}

      {err && <div className="alert err">{err}</div>}

      {/* Main Catalog View */}
      <div className="shop">
        {/* Working Sidebar Filters */}
        <aside className="filters">
          <div className="row between" style={{ marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid var(--border)" }}>
            <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <SlidersHorizontal size={14} />
              <span>Filters</span>
            </h4>
            {active && (
              <button
                className="link"
                style={{ fontSize: "0.8rem" }}
                onClick={() => setSp({})}
              >
                Reset
              </button>
            )}
          </div>

          <h4>Category</h4>
          <div className="cat-list">
            <button
              className={!f.category ? "on" : ""}
              onClick={() => set({ category: "" })}
            >
              <span>All Categories</span>
              <span>{cats.reduce((acc, c) => acc + c.count, 0)}</span>
            </button>
            {cats.map((c) => (
              <button
                key={c.id}
                className={f.category === c.name ? "on" : ""}
                onClick={() => set({ category: c.name })}
              >
                <span>{c.name}</span>
                <span>{c.count}</span>
              </button>
            ))}
          </div>

          <h4>Brand</h4>
          <select
            value={f.brand}
            onChange={(e) => set({ brand: e.target.value })}
            style={{ marginBottom: "16px", width: "100%" }}
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <h4>Max Price (₹)</h4>
          <input
            type="number"
            min="0"
            key={f.max_price}
            defaultValue={f.max_price}
            placeholder="e.g. 50000"
            onBlur={(e) => e.target.value !== f.max_price && set({ max_price: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
            style={{ marginBottom: "16px", width: "100%" }}
          />

          <h4>Minimum Rating</h4>
          <select
            value={f.min_rating}
            onChange={(e) => set({ min_rating: e.target.value })}
            style={{ marginBottom: "16px", width: "100%" }}
          >
            <option value="">All Ratings</option>
            <option value="4">4.0 ★ & above</option>
            <option value="4.5">4.5 ★ & above</option>
          </select>

          <div style={{ paddingTop: "10px", borderTop: "1px solid var(--border)" }}>
            <label className="check">
              <input
                type="checkbox"
                checked={Boolean(f.in_stock)}
                onChange={(e) => set({ in_stock: e.target.checked ? "1" : "" })}
              />
              <span>In stock items only</span>
            </label>
          </div>
        </aside>

        {/* Products Section */}
        <section>
          {/* Working Toolbar */}
          <div className="row between toolbar">
            <p>
              {data ? (
                <>
                  Showing <b>{data.total}</b> product{data.total === 1 ? "" : "s"}
                </>
              ) : (
                "Loading products…"
              )}
              {f.q && (
                <>
                  {" "}for “<b>{f.q}</b>”
                </>
              )}
              {f.category && (
                <>
                  {" "}in <b>{f.category}</b>
                </>
              )}
            </p>

            <div className="row" style={{ gap: "8px" }}>
              <span className="muted" style={{ fontSize: "0.84rem" }}>Sort:</span>
              <select
                value={f.sort}
                onChange={(e) => set({ sort: e.target.value })}
                aria-label="Sort products"
              >
                <option value="featured">Top Rated</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name">Name (A–Z)</option>
              </select>
            </div>
          </div>

          {/* Product Grid */}
          {!data ? (
            <Skeleton n={8} />
          ) : data.items.length === 0 ? (
            <Empty icon={<SearchX size={44} />} title="No products match your criteria">
              <p>Adjust your search filters or ask the AI assistant to find similar models.</p>
              <button
                className="btn sm primary"
                style={{ marginTop: "12px" }}
                onClick={() => setChatOpen(true)}
              >
                <Sparkles size={14} />
                <span>Ask AI Assistant</span>
              </button>
            </Empty>
          ) : (
            <div className="grid">
              {data.items.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data?.pages > 1 && (
            <div className="row" style={{ justifyContent: "center", marginTop: "36px", gap: "10px" }}>
              <button
                className="btn sm ghost"
                disabled={f.page <= 1}
                onClick={() => set({ page: f.page - 1 })}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span style={{ fontSize: "0.86rem", fontWeight: 600 }}>
                Page {data.page} of {data.pages}
              </span>
              <button
                className="btn sm ghost"
                disabled={f.page >= data.pages}
                onClick={() => set({ page: f.page + 1 })}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
