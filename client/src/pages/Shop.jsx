import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, SearchX, Sparkles } from "lucide-react";
import { api } from "../api";
import { useApp } from "../context";
import ProductCard from "../components/ProductCard";
import { Empty, Skeleton } from "../components/ui";

export default function Shop() {
  const [sp, setSp] = useSearchParams();
  const { setChatOpen } = useApp();
  const [cats, setCats] = useState([]);
  const [brands, setBrands] = useState([]);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const f = { q: sp.get("q") || "", category: sp.get("category") || "", brand: sp.get("brand") || "", max_price: sp.get("max_price") || "",
    min_rating: sp.get("min_rating") || "", in_stock: sp.get("in_stock") || "", sort: sp.get("sort") || "featured", page: Number(sp.get("page") || 1) };
  const set = (patch) => { const n = new URLSearchParams(sp); Object.entries({ page: 1, ...patch }).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setSp(n); };

  useEffect(() => { api("/api/categories").then(setCats).catch((e) => setErr(e.message)); api("/api/brands").then(setBrands).catch(() => {}); }, []);
  useEffect(() => {
    setData(null);
    api("/api/products", { params: { ...f, limit: 12 } }).then(setData).catch((e) => { setErr(e.message); setData({ items: [], total: 0, pages: 0 }); });
  }, [sp]); // eslint-disable-line

  const active = f.q || f.category || f.brand || f.max_price || f.min_rating || f.in_stock;
  return (
    <>
      {!active && (
        <section className="hero">
          <div><span className="tag"><Sparkles size={14} /> Powered by RAG + LLM</span>
            <h1>Shop in plain English.<br />Get answers with sources.</h1>
            <p>Describe what you need — “a laptop for coding under ₹60,000” — track orders, or ask about returns. Every policy answer cites the document it came from.</p>
            <button className="btn lg" onClick={() => setChatOpen(true)}><Sparkles size={18} /> Ask the AI assistant</button></div>
        </section>
      )}
      {err && <div className="alert err">{err}</div>}
      <div className="shop">
        <aside className="filters card">
          <h4>Categories</h4>
          <div className="cat-list">
            <button className={!f.category ? "on" : ""} onClick={() => set({ category: "" })}>All</button>
            {cats.map((c) => <button key={c.id} className={f.category === c.name ? "on" : ""} onClick={() => set({ category: c.name })}>{c.name}<span>{c.count}</span></button>)}
          </div>
          <label>Brand<select value={f.brand} onChange={(e) => set({ brand: e.target.value })}><option value="">All brands</option>{brands.map((b) => <option key={b}>{b}</option>)}</select></label>
          <label>Max price (₹)<input type="number" min="0" key={f.max_price} defaultValue={f.max_price} placeholder="e.g. 50000" onBlur={(e) => e.target.value !== f.max_price && set({ max_price: e.target.value })} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} /></label>
          <label>Min rating<select value={f.min_rating} onChange={(e) => set({ min_rating: e.target.value })}><option value="">Any</option><option value="4">4★ & up</option><option value="4.5">4.5★ & up</option></select></label>
          <label className="check"><input type="checkbox" checked={!!f.in_stock} onChange={(e) => set({ in_stock: e.target.checked ? "1" : "" })} /> In stock only</label>
          {active && <button className="btn ghost" onClick={() => setSp({})}>Clear all filters</button>}
        </aside>
        <section>
          <div className="row between toolbar">
            <p className="muted">{data ? `${data.total} product${data.total === 1 ? "" : "s"}` : "Loading…"}{f.q && <> for “<b>{f.q}</b>”</>}</p>
            <select value={f.sort} onChange={(e) => set({ sort: e.target.value })}><option value="featured">Top rated</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="name">Name</option></select>
          </div>
          {!data ? <Skeleton /> : data.items.length === 0 ? (
            <Empty icon={<SearchX size={40} />} title="No products found">Try fewer filters, or ask the AI assistant to find something similar.</Empty>
          ) : <div className="grid">{data.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
          {data?.pages > 1 && (
            <div className="pager row">
              <button className="btn ghost sm" disabled={f.page <= 1} onClick={() => set({ page: f.page - 1 })}><ChevronLeft size={16} /></button>
              <span>Page {data.page} of {data.pages}</span>
              <button className="btn ghost sm" disabled={f.page >= data.pages} onClick={() => set({ page: f.page + 1 })}><ChevronRight size={16} /></button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
