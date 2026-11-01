import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, FastForward, Package, RotateCcw, XCircle } from "lucide-react";
import { api, fmtDate, inr } from "../api";
import { useApp } from "../context";
import { Empty, ProductImage } from "../components/ui";

const STAGES = ["Order confirmed", "Processing", "Shipped", "Out for delivery", "Delivered"];

function Timeline({ o }) {
  if (o.status === "Cancelled") return <p className="bad">This order was cancelled.</p>;
  const reached = new Set(o.events.map((e) => e.status));
  return (
    <ol className="timeline">
      {STAGES.map((s) => { const ev = o.events.find((e) => e.status === s); return (
        <li key={s} className={reached.has(s) ? "done" : ""}><span>{reached.has(s) ? <Check size={13} /> : ""}</span><b>{s}</b><small>{ev ? fmtDate(ev.timestamp) : "—"}</small></li>
      ); })}
    </ol>
  );
}

export default function OrdersPage() {
  const { toast } = useApp();
  const [orders, setOrders] = useState(null);
  const [ret, setRet] = useState(null), [reason, setReason] = useState("");
  const load = () => api("/api/orders").then(setOrders).catch((e) => toast(e.message, "err"));
  useEffect(() => { load(); }, []); // eslint-disable-line
  const act = async (path, body, ok) => { try { await api(path, { method: "POST", body }); toast(ok); setRet(null); setReason(""); load(); } catch (e) { toast(e.message, "err"); } };

  if (!orders) return <div className="card skel detail-skel" />;
  if (!orders.length) return <Empty icon={<Package size={44} />} title="No orders yet"><Link to="/">Start shopping</Link></Empty>;
  return (
    <>
      <h1>Your orders</h1>
      {orders.map((o) => (
        <article className="card order" key={o.id}>
          <div className="row between wrap-row">
            <div><b>Order #{o.id}</b> <span className="muted">· placed {fmtDate(o.created_at)} · {o.payment_method}</span></div>
            <span className={`pill ${o.status.toLowerCase().replace(/ /g, "-")}`}>{o.status}</span>
          </div>
          <Timeline o={o} />
          {o.items.map((i) => (
            <div className="row item" key={i.product.id}><ProductImage p={i.product} /><div className="grow"><Link to={`/product/${i.product.id}`} className="name">{i.product.name}</Link><span className="muted">Qty {i.quantity} · {inr(i.price)}</span></div></div>
          ))}
          <div className="row between wrap-row">
            <span className="muted">{o.discount > 0 && `Saved ${inr(o.discount)} · `}Total <b>{inr(o.total)}</b>{o.shipping_address?.city && ` · ${o.shipping_address.city}`}</span>
            <div className="row">
              {["Confirmed", "Processing"].includes(o.status) && <button className="btn ghost sm danger" onClick={() => confirm("Cancel this order?") && act(`/api/orders/${o.id}/cancel`, null, "Order cancelled")}><XCircle size={15} /> Cancel</button>}
              {o.status === "Delivered" && <button className="btn ghost sm" onClick={() => setRet(ret === o.id ? null : o.id)}><RotateCcw size={15} /> Return</button>}
              {!["Delivered", "Cancelled", "Return requested"].includes(o.status) && <button className="btn ghost sm" title="Demo only: simulate courier progress" onClick={() => act(`/api/orders/${o.id}/advance`, null, "Shipment advanced (demo)")}><FastForward size={15} /> Simulate next step</button>}
            </div>
          </div>
          {ret === o.id && (
            <form className="row" onSubmit={(e) => { e.preventDefault(); act(`/api/orders/${o.id}/return`, { reason }, "Return requested — pickup within 2 business days"); }}>
              <input className="grow" required minLength={3} placeholder="Why are you returning this?" value={reason} onChange={(e) => setReason(e.target.value)} /><button className="btn sm">Submit return</button>
            </form>
          )}
        </article>
      ))}
    </>
  );
}
