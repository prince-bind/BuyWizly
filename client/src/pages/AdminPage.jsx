import { useEffect, useState } from "react";
import { BarChart3, BookOpen, FlaskConical, RefreshCw, Trash2, Upload } from "lucide-react";
import { api, fmtDate } from "../api";
import { useApp } from "../context";

const Stat = ({ label, value }) => <div className="card stat"><b>{value ?? "–"}</b><span className="muted">{label}</span></div>;
const Bars = ({ data }) => { const max = Math.max(1, ...Object.values(data || {})); return <div className="bars">{Object.entries(data || {}).map(([k, v]) => <div key={k}><span>{k || "n/a"}</span><i style={{ width: `${(v / max) * 100}%` }} /><b>{v}</b></div>)}</div>; };

function Analytics() {
  const [d, setD] = useState(null);
  useEffect(() => { api("/api/admin/analytics").then(setD).catch(() => {}); }, []);
  if (!d) return <p className="muted">Loading…</p>;
  const t = d.totals;
  return (
    <>
      <div className="stats"><Stat label="Assistant queries" value={t.queries} /><Stat label="Avg latency (ms)" value={t.avg_latency_ms} /><Stat label="👍 helpful" value={t.thumbs_up} /><Stat label="👎 not helpful" value={t.thumbs_down} /><Stat label="Users" value={t.users} /><Stat label="Orders" value={t.orders} /></div>
      <p className="muted">LLM: <b>{d.system.llm_configured ? "Groq connected" : "not configured (extractive fallback)"}</b> · Vector store: <b>{d.system.vector_backend}</b></p>
      <div className="two"><div className="card"><h4>Queries by intent</h4><Bars data={d.by_intent} /></div><div className="card"><h4>RAG confidence</h4><Bars data={d.by_confidence} /></div></div>
      <div className="card"><h4>Knowledge gaps — questions the bot couldn’t answer</h4>{d.unanswered.length === 0 ? <p className="muted">None yet 🎉</p> : <ul>{d.unanswered.map((u) => <li key={u.id}>{u.query}</li>)}</ul>}<small className="muted">Upload a document covering these in the Knowledge Base tab.</small></div>
      <div className="card"><h4>Recent queries</h4><div className="table-wrap"><table className="plain"><thead><tr><th>Query</th><th>Intent</th><th>Conf.</th><th>ms</th><th>LLM</th><th>👍</th></tr></thead>
        <tbody>{d.recent.map((r) => <tr key={r.id}><td>{r.query}</td><td>{r.intent}</td><td>{r.confidence || "–"}</td><td>{r.latency_ms}</td><td>{r.used_llm ? "yes" : "no"}</td><td>{r.feedback === 1 ? "👍" : r.feedback === -1 ? "👎" : ""}</td></tr>)}</tbody></table></div></div>
    </>
  );
}

function Knowledge() {
  const { toast } = useApp();
  const [docs, setDocs] = useState([]), [busy, setBusy] = useState(false);
  const load = () => api("/api/admin/documents").then(setDocs);
  useEffect(() => { load(); }, []);
  const upload = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api("/api/admin/documents", { method: "POST", form: new FormData(e.target) }); toast(`Indexed ${r.chunk_count} chunks`); e.target.reset(); load(); }
    catch (x) { toast(x.message, "err"); } finally { setBusy(false); }
  };
  return (
    <>
      <form className="card form" onSubmit={upload}>
        <h4><Upload size={16} /> Add a document (PDF, Markdown, TXT, JSON)</h4>
        <div className="two"><label>File<input type="file" name="file" accept=".pdf,.md,.txt,.json" required /></label><label>Title<input name="title" placeholder="Optional" /></label></div>
        <div className="two"><label>Category<input name="category" defaultValue="General" /></label><label>Version<input name="version" defaultValue="2026.1" /></label></div>
        <button className="btn" disabled={busy}>{busy ? "Chunking & embedding…" : "Upload & index"}</button>
      </form>
      <div className="row between"><h4>Indexed documents ({docs.length})</h4><button className="btn ghost sm" onClick={async () => { const r = await api("/api/admin/documents/reindex", { method: "POST" }); toast(`Re-indexed ${r.chunks} chunks`); load(); }}><RefreshCw size={14} /> Rebuild index</button></div>
      <div className="table-wrap"><table className="plain"><thead><tr><th>Title</th><th>Category</th><th>Version</th><th>Chunks</th><th>Added</th><th /></tr></thead>
        <tbody>{docs.map((d) => <tr key={d.id}><td>{d.title}</td><td>{d.category}</td><td>{d.version}</td><td>{d.chunk_count}</td><td>{fmtDate(d.uploaded_at)}</td>
          <td><button className="icon" onClick={async () => { if (confirm(`Delete "${d.title}" and its vectors?`)) { await api(`/api/admin/documents/${d.id}`, { method: "DELETE" }); load(); } }}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div>
    </>
  );
}

function Playground() {
  const [q, setQ] = useState("How many days to return a laptop?"), [r, setR] = useState(null), [err, setErr] = useState("");
  const run = async (e) => { e.preventDefault(); setErr(""); try { setR(await api("/api/admin/rag/test", { params: { q } })); } catch (x) { setErr(x.message); } };
  return (
    <>
      <p className="muted">Inspect exactly which chunks retrieval returns and how they score. Answers are refused when the top score is under the threshold or the passage doesn’t cover the question’s keywords.</p>
      <form className="row" onSubmit={run}><input className="grow" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn">Retrieve</button></form>
      {err && <div className="alert err">{err}</div>}
      {r && <><p>Confidence: <b className={`conf ${r.confidence}`}>{r.confidence}</b> · threshold {r.threshold}</p>
        {r.hits.map((h, i) => <div className="card src-card" key={h.id}><div className="row between"><b>#{i + 1} {h.title} <span className="muted">/ {h.section}</span></b><span className="pill">{h.score}</span></div><p>{h.text}</p></div>)}</>}
    </>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState("analytics");
  const tabs = [["analytics", "Analytics", BarChart3], ["kb", "Knowledge base", BookOpen], ["rag", "RAG playground", FlaskConical]];
  return (
    <>
      <h1>Admin console</h1>
      <div className="tabs">{tabs.map(([k, l, I]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}><I size={16} /> {l}</button>)}</div>
      {tab === "analytics" ? <Analytics /> : tab === "kb" ? <Knowledge /> : <Playground />}
    </>
  );
}
