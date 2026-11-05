import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  FlaskConical,
  HelpCircle,
  Layers,
  RefreshCw,
  Search,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { api, fmtDate } from "../api";
import { useApp } from "../context";

const Stat = ({ label, value, icon: Icon }) => (
  <div className="card stat">
    <div className="row between" style={{ marginBottom: "8px" }}>
      <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      {Icon && <Icon size={16} className="muted" />}
    </div>
    <b>{value ?? "–"}</b>
  </div>
);

const Bars = ({ data }) => {
  const max = Math.max(1, ...Object.values(data || {}));
  return (
    <div className="bars">
      {Object.entries(data || {}).map(([k, v]) => (
        <div key={k}>
          <span style={{ fontWeight: 500 }}>{k || "unclassified"}</span>
          <i style={{ width: `${(v / max) * 100}%` }} />
          <b style={{ fontFamily: "var(--font-mono)" }}>{v}</b>
        </div>
      ))}
    </div>
  );
};

function Analytics() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api("/api/admin/analytics")
      .then(setD)
      .catch(() => {});
  }, []);

  if (!d) return <div className="card skel detail-skel" style={{ height: "260px" }} />;

  const t = d.totals;

  return (
    <>
      <div className="stats">
        <Stat label="Total Queries" value={t.queries} icon={Search} />
        <Stat label="Avg Latency" value={`${t.avg_latency_ms} ms`} icon={Activity} />
        <Stat label="Helpful (👍)" value={t.thumbs_up} icon={ThumbsUp} />
        <Stat label="Unhelpful (👎)" value={t.thumbs_down} icon={ThumbsDown} />
        <Stat label="Active Users" value={t.users} icon={Users} />
        <Stat label="Orders Processed" value={t.orders} icon={Database} />
      </div>

      <div
        className="card"
        style={{
          padding: "14px 18px",
          marginBottom: "18px",
          background: "var(--surface2)",
          fontSize: "0.86rem",
        }}
      >
        <span className="muted">Inference Pipeline: </span>
        <b>{d.system.llm_configured ? "Groq (Connected)" : "Extractive Fallback"}</b>
        <span className="muted"> · Vector Storage Engine: </span>
        <b>{d.system.vector_backend}</b>
      </div>

      <div className="two">
        <div className="card">
          <h4 style={{ marginBottom: "16px" }}>Queries by Intent</h4>
          <Bars data={d.by_intent} />
        </div>
        <div className="card">
          <h4 style={{ marginBottom: "16px" }}>RAG Confidence Distribution</h4>
          <Bars data={d.by_confidence} />
        </div>
      </div>

      <div className="card">
        <h4>
          <HelpCircle size={16} style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px" }} />
          Identified Knowledge Gaps (Unanswered Customer Questions)
        </h4>
        {d.unanswered.length === 0 ? (
          <p className="muted" style={{ margin: "10px 0" }}>
            No unanswered queries recorded yet. The retrieval gate is well-covered.
          </p>
        ) : (
          <ul style={{ margin: "10px 0 14px", paddingLeft: "20px" }}>
            {d.unanswered.map((u) => (
              <li key={u.id} style={{ margin: "4px 0", color: "var(--text)" }}>
                “{u.query}”
              </li>
            ))}
          </ul>
        )}
        <small className="muted">
          Tip: Ingest policy documents or FAQs addressing these gaps via the Knowledge Base tab.
        </small>
      </div>

      <div className="card">
        <h4 style={{ marginBottom: "14px" }}>Recent Telemetry & Inquiries</h4>
        <div className="table-wrap">
          <table className="plain">
            <thead>
              <tr>
                <th>Query</th>
                <th>Intent</th>
                <th>Confidence</th>
                <th>Latency</th>
                <th>LLM</th>
                <th>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {d.recent.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.query}</td>
                  <td>
                    <span className="pill">{r.intent}</span>
                  </td>
                  <td>
                    <span className={`conf ${r.confidence || "LOW"}`}>
                      {r.confidence || "–"}
                    </span>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                    {r.latency_ms} ms
                  </td>
                  <td>{r.used_llm ? "Yes" : "No"}</td>
                  <td>
                    {r.feedback === 1 ? (
                      <span className="ok">👍</span>
                    ) : r.feedback === -1 ? (
                      <span className="bad">👎</span>
                    ) : (
                      "–"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Knowledge() {
  const { toast } = useApp();
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = () => api("/api/admin/documents").then(setDocs);

  useEffect(() => {
    load();
  }, []);

  const upload = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api("/api/admin/documents", {
        method: "POST",
        form: new FormData(e.target),
      });
      toast(`Successfully indexed ${r.chunk_count} chunk vectors`);
      e.target.reset();
      load();
    } catch (x) {
      toast(x.message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form className="card form" onSubmit={upload}>
        <h4 style={{ marginBottom: "16px" }}>
          <Upload size={16} style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px" }} />
          Ingest Knowledge Document (PDF, Markdown, TXT, JSON)
        </h4>
        <div className="two">
          <label>
            File Upload
            <input type="file" name="file" accept=".pdf,.md,.txt,.json" required />
          </label>
          <label>
            Document Title
            <input name="title" placeholder="Optional title override" />
          </label>
        </div>
        <div className="two">
          <label>
            Category
            <input name="category" defaultValue="General" />
          </label>
          <label>
            Version Tag
            <input name="version" defaultValue="2026.1" />
          </label>
        </div>
        <button className="btn" disabled={busy} style={{ marginTop: "14px" }}>
          {busy ? "Chunking, Vectorizing & Ingesting…" : "Upload & Vectorize"}
        </button>
      </form>

      <div className="row between" style={{ margin: "28px 0 14px" }}>
        <h4>Indexed Store Documents ({docs.length})</h4>
        <button
          className="btn ghost sm"
          onClick={async () => {
            const r = await api("/api/admin/documents/reindex", { method: "POST" });
            toast(`Rebuilt vector index: ${r.chunks} total chunks`);
            load();
          }}
        >
          <RefreshCw size={14} />
          <span>Rebuild Vector Index</span>
        </button>
      </div>

      <div className="table-wrap card" style={{ padding: 0 }}>
        <table className="plain">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Version</th>
              <th>Chunks</th>
              <th>Added Date</th>
              <th style={{ width: "50px" }} />
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600 }}>{d.title}</td>
                <td>
                  <span className="pill">{d.category}</span>
                </td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                  v{d.version}
                </td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{d.chunk_count}</td>
                <td className="muted">{fmtDate(d.uploaded_at)}</td>
                <td>
                  <button
                    className="icon"
                    onClick={async () => {
                      if (confirm(`Permanently remove "${d.title}" and erase associated embeddings?`)) {
                        await api(`/api/admin/documents/${d.id}`, { method: "DELETE" });
                        load();
                      }
                    }}
                    title="Delete document"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Playground() {
  const [q, setQ] = useState("How many days to return a laptop?");
  const [r, setR] = useState(null);
  const [err, setErr] = useState("");

  const run = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      setR(await api("/api/admin/rag/test", { params: { q } }));
    } catch (x) {
      setErr(x.message);
    }
  };

  return (
    <>
      <p className="muted">
        Inspect vector similarity and keyword overlap in real-time. Answers are refused if the
        similarity score fails threshold gates or coverage criteria.
      </p>

      <form className="row" onSubmit={run} style={{ marginBottom: "20px" }}>
        <input
          className="grow"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Test question for vector retrieval…"
        />
        <button className="btn">Run Retrieval</button>
      </form>

      {err && <div className="alert err">{err}</div>}

      {r && (
        <>
          <div className="card" style={{ padding: "14px 18px", marginBottom: "16px" }}>
            <span className="muted">Computed Confidence: </span>
            <b className={`conf ${r.confidence}`} style={{ marginLeft: "4px" }}>
              {r.confidence}
            </b>
            <span className="muted" style={{ marginLeft: "14px" }}>
              Gating Threshold:{" "}
            </span>
            <b style={{ fontFamily: "var(--font-mono)" }}>{r.threshold}</b>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {r.hits.map((h, i) => (
              <div className="card src-card" key={h.id}>
                <div className="row between wrap-row" style={{ marginBottom: "8px" }}>
                  <b>
                    #{i + 1} {h.title} <span className="muted">/ {h.section}</span>
                  </b>
                  <span className="pill" style={{ fontFamily: "var(--font-mono)" }}>
                    Score: {h.score}
                  </span>
                </div>
                <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.55 }}>
                  {h.text}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState("analytics");
  const tabs = [
    ["analytics", "Analytics & Telemetry", BarChart3],
    ["kb", "Knowledge Base", BookOpen],
    ["rag", "RAG Retrieval Playground", FlaskConical],
  ];

  return (
    <>
      <div className="row between wrap-row" style={{ marginBottom: "20px" }}>
        <div>
          <h1>Administration Console</h1>
          <p className="muted" style={{ margin: 0 }}>
            Catalog health, RAG document management, and assistant observability.
          </p>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(([k, l, Icon]) => (
          <button
            key={k}
            className={tab === k ? "on" : ""}
            onClick={() => setTab(k)}
          >
            <Icon size={16} />
            <span>{l}</span>
          </button>
        ))}
      </div>

      {tab === "analytics" ? <Analytics /> : tab === "kb" ? <Knowledge /> : <Playground />}
    </>
  );
}
