import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, ChevronDown, History, Plus, Send, Sparkles, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react";
import { api, fmtDate, inr, streamChat } from "../api";
import { useApp } from "../context";
import { Md, ProductImage } from "./ui";

const STARTERS = ["Find a laptop under ₹60,000", "Where is my order?", "What is your return policy?", "Compare AeroBook Pro 14 vs EverydayBook 15"];

function Cards({ meta, onClose }) {
  const { addToCart } = useApp();
  return (
    <>
      {meta.products?.length > 0 && (
        <div className="mini-scroll">
          {meta.products.map((p) => (
            <div className="mini" key={p.id}>
              <Link to={`/product/${p.id}`} onClick={onClose}><ProductImage p={p} /></Link>
              <Link to={`/product/${p.id}`} onClick={onClose} className="name">{p.name}</Link>
              <div className="row between"><b>{inr(p.price)}</b><span className="muted">{p.rating}★</span></div>
              {p.reason && <small className="muted">{p.reason}</small>}
              <button className="btn sm" disabled={!p.stock} onClick={() => addToCart(p.id)}>Add to cart</button>
            </div>
          ))}
        </div>
      )}
      {meta.orders?.map((o) => (
        <div className="mini-order" key={o.id}>
          <div className="row between"><b>Order #{o.id}</b><span className={`pill ${o.status.toLowerCase().replace(/ /g, "-")}`}>{o.status}</span></div>
          <small className="muted">{o.items.map((i) => i.product.name).join(", ")} · {inr(o.total)} · {fmtDate(o.created_at)}</small>
          <Link to="/orders" onClick={onClose}>View tracking →</Link>
        </div>
      ))}
      {meta.sources?.length > 0 && (
        <details className="trace"><summary>Sources ({meta.sources.length}) · confidence <b className={`conf ${meta.confidence}`}>{meta.confidence}</b></summary>
          {meta.sources.map((s) => (
            <div className="src" key={s.index}><b>[{s.index}] {s.document}</b> <span className="muted">· {s.section} · v{s.version} · relevance {s.score}</span><p>“{s.snippet}…”</p></div>
          ))}
        </details>
      )}
      {meta.steps?.length > 0 && (
        <details className="trace"><summary>How I answered</summary><ol>{meta.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></details>
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

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, chatOpen]);
  useEffect(() => { setMsgs([]); setSid(null); setHist(null); }, [user?.id]);

  const patchLast = (fn) => setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? fn(x) : x)));

  const send = async (q) => {
    q = (q ?? text).trim();
    if (!q || busy) return;
    if (!user) { setAuthOpen(true); return; }
    setText(""); setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "", meta: {}, streaming: true }]);
    abort.current = new AbortController();
    try {
      await streamChat(q, sid, {
        signal: abort.current.signal,
        onMeta: (meta) => { setSid(meta.session_id); patchLast((x) => ({ ...x, meta })); },
        onToken: (t) => patchLast((x) => ({ ...x, content: x.content + t })),
        onDone: (d) => patchLast((x) => ({ ...x, streaming: false, logId: d.log_id })),
      });
    } catch (e) {
      if (e.name !== "AbortError") patchLast((x) => ({ ...x, streaming: false, content: x.content || e.message, error: true }));
    } finally { setBusy(false); patchLast((x) => ({ ...x, streaming: false })); }
  };

  const rate = async (i, rating) => {
    const m = msgs[i];
    try { await api("/api/assistant/feedback", { method: "POST", body: { log_id: m.logId, rating: m.rating === rating ? 0 : rating } }); }
    catch (e) { return toast(e.message, "err"); }
    setMsgs((all) => all.map((x, j) => (j === i ? { ...x, rating: x.rating === rating ? 0 : rating } : x)));
  };

  const openHistory = async () => setHist(hist ? null : await api("/api/assistant/sessions").catch(() => []));
  const load = async (id) => {
    const rows = await api(`/api/assistant/sessions/${id}`);
    setMsgs(rows.map((r) => ({ role: r.role, content: r.content, meta: r.meta, logId: r.meta?.log_id })));
    setSid(id); setHist(null);
  };
  const reset = () => { abort.current?.abort(); setMsgs([]); setSid(null); setHist(null); setBusy(false); };

  const lastSuggestions = msgs.at(-1)?.meta?.suggestions;

  return (
    <>
      {!chatOpen && <button className="fab" onClick={() => setChatOpen(true)} aria-label="Open AI assistant"><Sparkles size={22} /><span>Ask AskCart</span></button>}
      {chatOpen && (
        <section className="chat" role="dialog" aria-label="AskCart assistant">
          <header>
            <div className="row"><span className="avatar"><Bot size={18} /></span><div><b>AskCart</b><small>Products · Orders · Policies</small></div></div>
            <div className="row">
              <button className="icon" onClick={openHistory} title="History"><History size={17} /></button>
              <button className="icon" onClick={reset} title="New chat"><Plus size={17} /></button>
              <button className="icon" onClick={() => setChatOpen(false)} title="Close"><ChevronDown size={18} /></button>
            </div>
          </header>
          {hist && (
            <div className="hist">
              {hist.length === 0 && <p className="muted">No previous chats yet.</p>}
              {hist.map((h) => (
                <div className="row between" key={h.id}>
                  <button className="link" onClick={() => load(h.id)}>{h.title}</button>
                  <button className="icon" onClick={async () => { await api(`/api/assistant/sessions/${h.id}`, { method: "DELETE" }); setHist(hist.filter((x) => x.id !== h.id)); }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="msgs">
            {msgs.length === 0 && (
              <div className="welcome">
                <h3>Hi{user ? `, ${user.name.split(" ")[0]}` : ""} 👋</h3>
                <p className="muted">I search the catalog, track your orders and answer policy questions — with sources.</p>
                {!user && <button className="btn" onClick={() => setAuthOpen(true)}>Sign in to start</button>}
                <div className="chips">{STARTERS.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}</div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <div className={`bubble ${m.error ? "error" : ""}`}>
                  {m.content ? <Md text={m.content} /> : <span className="typing"><i /><i /><i /></span>}
                  {m.streaming && m.content && <span className="caret" />}
                </div>
                {m.role === "assistant" && m.meta && !m.streaming && <Cards meta={m.meta} onClose={() => setChatOpen(false)} />}
                {m.role === "assistant" && m.logId && !m.streaming && (
                  <div className="fb">
                    <button className={`icon ${m.rating === 1 ? "on" : ""}`} onClick={() => rate(i, 1)}><ThumbsUp size={14} /></button>
                    <button className={`icon ${m.rating === -1 ? "on bad" : ""}`} onClick={() => rate(i, -1)}><ThumbsDown size={14} /></button>
                  </div>
                )}
              </div>
            ))}
            {!busy && lastSuggestions?.length > 0 && <div className="chips">{lastSuggestions.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}</div>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about products, orders, returns…" maxLength={1000} />
            {busy ? <button type="button" className="btn" onClick={() => abort.current?.abort()}><X size={16} /></button>
                  : <button className="btn" disabled={!text.trim()}><Send size={16} /></button>}
          </form>
        </section>
      )}
    </>
  );
}
