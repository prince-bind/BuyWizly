import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  FileCheck2,
  History,
  Plus,
  Send,
  ShoppingBag,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { api, fmtDate, inr, streamChat } from "../api";
import { useApp } from "../context";
import { Md, ProductImage } from "./ui";

const STARTERS = [
  "Find a coding laptop under ₹60,000",
  "Where is my order?",
  "What is the return policy for electronics?",
  "Compare AeroBook Pro 14 vs EverydayBook 15",
];

function ThinkingIndicator({ meta }) {
  const [stepIndex, setStepIndex] = useState(0);
  const defaultSteps = [
    "Thinking & analyzing question…",
    "Searching catalog & documents…",
    "Checking store policy grounding…",
    "Formulating verified answer…",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((idx) => (idx + 1) % defaultSteps.length);
    }, 1600);
    return () => clearInterval(timer);
  }, []);

  const currentText =
    meta?.steps && meta.steps.length > 0
      ? meta.steps[meta.steps.length - 1]
      : defaultSteps[stepIndex];

  return (
    <div className="thinking-indicator">
      <Sparkles size={14} className="thinking-icon" />
      <span className="thinking-text">{currentText}</span>
      <span className="typing-dots">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

function Cards({ meta, onClose }) {
  const { addToCart } = useApp();
  return (
    <>
      {meta.products?.length > 0 && (
        <div className="mini-scroll">
          {meta.products.map((p) => (
            <div className="mini" key={p.id}>
              <Link to={`/product/${p.id}`} onClick={onClose} aria-label={`View ${p.name}`}>
                <ProductImage p={p} />
              </Link>
              <Link to={`/product/${p.id}`} onClick={onClose} className="name">
                {p.name}
              </Link>
              <div className="row between" style={{ fontSize: "0.82rem" }}>
                <b style={{ color: "var(--brand-accent)" }}>{inr(p.price)}</b>
                <span className="muted">★ {Number(p.rating).toFixed(1)}</span>
              </div>
              {p.reason && (
                <small style={{ color: "var(--brand-accent)", fontWeight: 600 }}>
                  {p.reason}
                </small>
              )}
              <button
                className="btn sm primary"
                style={{ padding: "4px 8px", fontSize: "0.78rem", marginTop: "4px", width: "100%" }}
                disabled={!p.stock}
                onClick={() => addToCart(p.id)}
              >
                <ShoppingBag size={12} strokeWidth={2.2} />
                <span>Add</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {meta.orders?.map((o) => (
        <div
          key={o.id}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            fontSize: "0.85rem",
          }}
        >
          <div className="row between">
            <b>Order #{o.id}</b>
            <span className={`pill ${o.status.toLowerCase().replace(/ /g, "-")}`}>
              {o.status}
            </span>
          </div>
          <small className="muted">
            {o.items.map((i) => i.product.name).join(", ")} · {inr(o.total)} · {fmtDate(o.created_at)}
          </small>
          <Link
            to="/orders"
            onClick={onClose}
            className="link"
            style={{ fontSize: "0.82rem", fontWeight: 700 }}
          >
            View shipment timeline →
          </Link>
        </div>
      ))}

      {meta.sources?.length > 0 && (
        <details className="trace">
          <summary>
            <span className="row" style={{ display: "inline-flex", gap: "6px" }}>
              <FileCheck2 size={14} />
              <span>Verified Sources ({meta.sources.length})</span>
              <span
                style={{
                  background: meta.confidence === "HIGH" ? "var(--ok-soft)" : "var(--warn-soft)",
                  color: meta.confidence === "HIGH" ? "var(--ok)" : "var(--warn)",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  marginLeft: "4px",
                }}
              >
                {meta.confidence} confidence
              </span>
            </span>
          </summary>
          {meta.sources.map((s) => (
            <div
              key={s.index}
              style={{
                margin: "6px 0",
                padding: "6px 8px",
                background: "var(--surface2)",
                borderLeft: "3px solid var(--brand-accent)",
                borderRadius: "0 4px 4px 0",
                fontSize: "0.78rem",
              }}
            >
              <div className="row between" style={{ fontSize: "0.76rem" }}>
                <b>[{s.index}] {s.document}</b>
                <span className="muted">{s.section} · v{s.version}</span>
              </div>
              <p style={{ margin: "2px 0 0", fontStyle: "italic" }}>“{s.snippet}…”</p>
            </div>
          ))}
        </details>
      )}

      {meta.steps?.length > 0 && (
        <details className="trace">
          <summary>Reasoning trace</summary>
          <ol style={{ margin: "4px 0", paddingLeft: "18px" }}>
            {meta.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      )}
    </>
  );
}

export default function ChatWidget() {
  const { user, chatOpen, setChatOpen, setAuthOpen, toast } = useApp();
  const [msgs, setMsgs] = useState([]);
  const [sid, setSid] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState(null);
  const end = useRef(null);
  const abort = useRef(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, chatOpen]);

  useEffect(() => {
    setMsgs([]);
    setSid(null);
    setHist(null);
  }, [user?.id]);

  const patchLast = (fn) =>
    setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? fn(x) : x)));

  const send = async (q) => {
    q = (q ?? text).trim();
    if (!q || busy) return;
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setText("");
    setBusy(true);
    setMsgs((m) => [
      ...m,
      { role: "user", content: q },
      { role: "assistant", content: "", meta: {}, streaming: true },
    ]);
    abort.current = new AbortController();
    try {
      await streamChat(q, sid, {
        signal: abort.current.signal,
        onMeta: (meta) => {
          setSid(meta.session_id);
          patchLast((x) => ({ ...x, meta }));
        },
        onToken: (t) => patchLast((x) => ({ ...x, content: x.content + t })),
        onDone: (d) =>
          patchLast((x) => ({ ...x, streaming: false, logId: d.log_id })),
      });
    } catch (e) {
      if (e.name !== "AbortError") {
        patchLast((x) => ({
          ...x,
          streaming: false,
          content: x.content || e.message,
          error: true,
        }));
      }
    } finally {
      setBusy(false);
      patchLast((x) => ({ ...x, streaming: false }));
    }
  };

  const rate = async (i, rating) => {
    const m = msgs[i];
    try {
      await api("/api/assistant/feedback", {
        method: "POST",
        body: { log_id: m.logId, rating: m.rating === rating ? 0 : rating },
      });
    } catch (e) {
      return toast(e.message, "err");
    }
    setMsgs((all) =>
      all.map((x, j) =>
        j === i ? { ...x, rating: x.rating === rating ? 0 : rating } : x
      )
    );
  };

  const openHistory = async () =>
    setHist(hist ? null : await api("/api/assistant/sessions").catch(() => []));

  const load = async (id) => {
    const rows = await api(`/api/assistant/sessions/${id}`);
    setMsgs(
      rows.map((r) => ({
        role: r.role,
        content: r.content,
        meta: r.meta,
        logId: r.meta?.log_id,
      }))
    );
    setSid(id);
    setHist(null);
  };

  const reset = () => {
    abort.current?.abort();
    setMsgs([]);
    setSid(null);
    setHist(null);
    setBusy(false);
  };

  const lastSuggestions = msgs.at(-1)?.meta?.suggestions;

  return (
    <>
      {!chatOpen && (
        <button
          className="fab"
          onClick={() => setChatOpen(true)}
          aria-label="Open AI Assistant"
        >
          <span className="pulse-dot" />
          <Sparkles size={16} />
          <span>Ask AI</span>
        </button>
      )}

      {chatOpen && (
        <section className="chat" role="dialog" aria-label="BuyWizly AI Assistant">
          <header>
            <div className="row" style={{ gap: "8px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "var(--brand-soft)",
                  color: "var(--brand-accent)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Sparkles size={16} />
              </div>
              <div>
                <b>BuyWizly Assistant</b>
                <small>Products · Orders · Policies</small>
              </div>
            </div>
            <div className="row" style={{ gap: "4px" }}>
              <button className="icon" onClick={openHistory} title="Previous chats">
                <History size={15} />
              </button>
              <button className="icon" onClick={reset} title="Start new chat">
                <Plus size={15} />
              </button>
              <button
                className="icon"
                onClick={() => setChatOpen(false)}
                title="Minimize window"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </header>

          {hist && (
            <div style={{ padding: "10px 14px", background: "var(--surface2)", borderBottom: "1px solid var(--border)", maxHeight: "150px", overflowY: "auto" }}>
              {hist.length === 0 && (
                <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                  No previous chat history logged.
                </p>
              )}
              {hist.map((h) => (
                <div className="row between" key={h.id} style={{ margin: "4px 0" }}>
                  <button className="link" onClick={() => load(h.id)} style={{ fontSize: "0.84rem" }}>
                    {h.title}
                  </button>
                  <button
                    className="icon"
                    style={{ width: "24px", height: "24px", border: 0 }}
                    onClick={async () => {
                      await api(`/api/assistant/sessions/${h.id}`, { method: "DELETE" });
                      setHist(hist.filter((x) => x.id !== h.id));
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="msgs">
            {msgs.length === 0 && (
              <div style={{ textAlign: "center", padding: "20px 8px" }}>
                <h3 style={{ margin: "0 0 6px" }}>
                  Hi{user ? `, ${user.name.split(" ")[0]}` : ""} 👋
                </h3>
                <p className="muted" style={{ fontSize: "0.88rem", lineHeight: 1.5 }}>
                  I search live catalog specs, verify stock, track orders, and cite store policies.
                </p>
                {!user && (
                  <button
                    className="btn sm primary"
                    style={{ marginTop: "10px" }}
                    onClick={() => setAuthOpen(true)}
                  >
                    Sign in to chat
                  </button>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "14px", justifyContent: "center" }}>
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      className="prompt-chip"
                      onClick={() => send(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <div className={`bubble ${m.error ? "error" : ""}`}>
                  {m.content ? (
                    <>
                      <Md text={m.content} />
                      {m.streaming && <span className="caret" />}
                    </>
                  ) : (
                    <ThinkingIndicator meta={m.meta} />
                  )}
                </div>

                {m.role === "assistant" && m.meta && !m.streaming && (
                  <Cards meta={m.meta} onClose={() => setChatOpen(false)} />
                )}

                {m.role === "assistant" && m.logId && !m.streaming && (
                  <div className="row" style={{ gap: "6px", marginTop: "2px" }}>
                    <button
                      className="icon"
                      style={{ width: "26px", height: "26px", borderRadius: "4px" }}
                      onClick={() => rate(i, 1)}
                      title="Helpful"
                    >
                      <ThumbsUp size={12} color={m.rating === 1 ? "var(--ok)" : "currentColor"} />
                    </button>
                    <button
                      className="icon"
                      style={{ width: "26px", height: "26px", borderRadius: "4px" }}
                      onClick={() => rate(i, -1)}
                      title="Not helpful"
                    >
                      <ThumbsDown size={12} color={m.rating === -1 ? "var(--bad)" : "currentColor"} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {!busy && lastSuggestions?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                {lastSuggestions.map((s) => (
                  <button key={s} className="prompt-chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={end} />
          </div>

          <form
            className="flex items-center gap-2.5 p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-full"
            style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px" }}
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              className="flex-1 min-w-0 w-full"
              style={{ flex: "1 1 auto", minWidth: 0, width: "100%" }}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask about specs, order status, return policies…"
              maxLength={1000}
              aria-label="Message assistant"
            />
            {busy ? (
              <button
                type="button"
                className="btn primary flex-none shrink-0"
                style={{ flexShrink: 0, marginLeft: "auto" }}
                onClick={() => abort.current?.abort()}
                title="Stop streaming"
              >
                <X size={16} />
              </button>
            ) : (
              <button
                className="btn primary flex-none shrink-0"
                style={{ flexShrink: 0, marginLeft: "auto" }}
                disabled={!text.trim()}
                title="Send query"
              >
                <Send size={15} />
              </button>
            )}
          </form>
        </section>
      )}
    </>
  );
}
