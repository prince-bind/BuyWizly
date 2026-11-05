import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  FastForward,
  Package,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { api, fmtDate, inr } from "../api";
import { useApp } from "../context";
import { Empty, ProductImage } from "../components/ui";

const STAGES = [
  "Order confirmed",
  "Processing",
  "Shipped",
  "Out for delivery",
  "Delivered",
];

function Timeline({ o }) {
  if (o.status === "Cancelled") {
    return (
      <div style={{ color: "var(--bad)", fontSize: "0.85rem", fontWeight: 600 }}>
        This order has been cancelled and inventory returned to stock.
      </div>
    );
  }

  const reached = new Set(o.events.map((e) => e.status));

  return (
    <ol className="timeline">
      {STAGES.map((s) => {
        const ev = o.events.find((e) => e.status === s);
        const isDone = reached.has(s);
        return (
          <li key={s} className={isDone ? "done" : ""}>
            <span>{isDone ? <Check size={13} strokeWidth={2.8} /> : ""}</span>
            <b>{s}</b>
            <small>{ev ? fmtDate(ev.timestamp) : "—"}</small>
          </li>
        );
      })}
    </ol>
  );
}

export default function OrdersPage() {
  const { toast } = useApp();
  const [orders, setOrders] = useState(null);
  const [ret, setRet] = useState(null);
  const [reason, setReason] = useState("");

  const load = () =>
    api("/api/orders")
      .then(setOrders)
      .catch((e) => toast(e.message, "err"));

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const act = async (path, body, ok) => {
    try {
      await api(path, { method: "POST", body });
      toast(ok);
      setRet(null);
      setReason("");
      load();
    } catch (e) {
      toast(e.message, "err");
    }
  };

  if (!orders) return <div className="card skel detail-skel" />;

  if (!orders.length) {
    return (
      <Empty icon={<Package size={48} />} title="No orders placed yet">
        <p className="muted">Your active and past orders will appear here with shipment milestones.</p>
        <Link to="/" className="btn sm primary" style={{ marginTop: "12px" }}>
          Explore Products
        </Link>
      </Empty>
    );
  }

  return (
    <>
      <div className="row between wrap-row" style={{ marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Your Orders</h1>
          <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.88rem" }}>
            Shipment tracking, delivery milestones, and verified return requests.
          </p>
        </div>
      </div>

      {orders.map((o) => (
        <article className="order" key={o.id}>
          <div className="row between wrap-row" style={{ paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
            <div>
              <b style={{ fontSize: "1rem" }}>Order #{o.id}</b>
              <span className="muted" style={{ fontSize: "0.84rem", marginLeft: "8px" }}>
                Placed {fmtDate(o.created_at)} · {o.payment_method}
              </span>
            </div>

            <span className={`pill ${o.status.toLowerCase().replace(/ /g, "-")}`}>
              {o.status}
            </span>
          </div>

          <Timeline o={o} />

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {o.items.map((i) => (
              <div className="row" key={i.product.id} style={{ gap: "14px" }}>
                <ProductImage p={i.product} style={{ width: "64px", height: "64px", objectFit: "contain" }} />
                <div className="grow">
                  <Link to={`/product/${i.product.id}`} className="name">
                    {i.product.name}
                  </Link>
                  <span className="muted" style={{ fontSize: "0.82rem" }}>
                    Qty {i.quantity} · {inr(i.price)}
                  </span>
                </div>
                <div className="price" style={{ fontSize: "0.98rem" }}>
                  {inr(i.price * i.quantity)}
                </div>
              </div>
            ))}
          </div>

          <div className="row between wrap-row" style={{ paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
            <span className="muted" style={{ fontSize: "0.86rem" }}>
              {o.discount > 0 && `Saved ${inr(o.discount)} · `}
              Total: <b style={{ color: "var(--text)" }}>{inr(o.total)}</b>
              {o.shipping_address?.city && ` · Delivering to ${o.shipping_address.city}`}
            </span>

            <div className="row" style={{ gap: "8px" }}>
              {["Confirmed", "Processing"].includes(o.status) && (
                <button
                  className="btn sm ghost"
                  style={{ color: "var(--bad)" }}
                  onClick={() =>
                    confirm("Cancel this order? Stock will be restored immediately.") &&
                    act(`/api/orders/${o.id}/cancel`, null, "Order cancelled & stock restored")
                  }
                >
                  <XCircle size={14} />
                  <span>Cancel</span>
                </button>
              )}

              {o.status === "Delivered" && (
                <button
                  className="btn sm ghost"
                  onClick={() => setRet(ret === o.id ? null : o.id)}
                >
                  <RotateCcw size={14} />
                  <span>Return</span>
                </button>
              )}

              {!["Delivered", "Cancelled", "Return requested"].includes(o.status) && (
                <button
                  className="btn sm ghost"
                  title="Demo only: advance shipment milestone"
                  onClick={() =>
                    act(`/api/orders/${o.id}/advance`, null, "Shipment state updated (demo)")
                  }
                >
                  <FastForward size={14} />
                  <span>Simulate Next Step (Demo)</span>
                </button>
              )}
            </div>
          </div>

          {ret === o.id && (
            <form
              className="card"
              style={{
                background: "var(--surface2)",
                padding: "16px",
                border: "1px solid var(--border)",
              }}
              onSubmit={(e) => {
                e.preventDefault();
                act(
                  `/api/orders/${o.id}/return`,
                  { reason },
                  "Return authorized — courier pickup scheduled within 2 business days"
                );
              }}
            >
              <h4 style={{ margin: "0 0 6px" }}>Return Request</h4>
              <p className="muted" style={{ fontSize: "0.82rem", margin: "0 0 10px" }}>
                Subject to 30-day general return window (or 7-day rule for laptops and smartphones).
              </p>
              <div className="row">
                <input
                  className="grow"
                  required
                  minLength={4}
                  placeholder="Reason for return…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button className="btn sm primary">Submit Return</button>
              </div>
            </form>
          )}
        </article>
      ))}
    </>
  );
}
