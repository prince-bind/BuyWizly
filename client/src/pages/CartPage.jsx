import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Trash2,
} from "lucide-react";
import { api, inr } from "../api";
import { useApp } from "../context";
import { Empty, ProductImage } from "../components/ui";

const blank = { name: "", line1: "", city: "", pincode: "", phone: "" };

export default function CartPage() {
  const { user, cart, setQty, refresh, toast, setAuthOpen } = useApp();
  const nav = useNavigate();
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState(null);
  const [msg, setMsg] = useState("");
  const [addr, setAddr] = useState({ ...blank, name: user?.name || "" });
  const [pay, setPay] = useState("UPI");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("cart");
  const [price, setPrice] = useState(cart);

  useEffect(() => {
    setPrice(cart);
    setApplied(null);
    setMsg("");
  }, [cart]);

  if (!user) {
    return (
      <Empty icon={<ShoppingBag size={48} />} title="Sign in to view your bag">
        <p className="muted">Your saved items and checkout state are synced to your account.</p>
        <button
          className="btn sm primary"
          style={{ marginTop: "14px" }}
          onClick={() => setAuthOpen(true)}
        >
          Sign in
        </button>
      </Empty>
    );
  }

  if (!cart.items.length) {
    return (
      <Empty icon={<ShoppingBag size={48} />} title="Your shopping bag is empty">
        <p className="muted">Explore our curated tech catalog and add your favorite items.</p>
        <Link to="/" className="btn sm primary" style={{ marginTop: "14px" }}>
          Browse Catalog
        </Link>
      </Empty>
    );
  }

  const applyCoupon = async () => {
    try {
      const q = await api("/api/orders/quote", {
        method: "POST",
        body: { coupon_code: coupon },
      });
      setPrice(q);
      setMsg(q.coupon_message || "");
      setApplied(q.discount > 0 ? coupon.toUpperCase() : null);
    } catch (e) {
      toast(e.message, "err");
    }
  };

  const place = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const o = await api("/api/orders/checkout", {
        method: "POST",
        body: { address: addr, payment_method: pay, coupon_code: applied },
      });
      await refresh();
      toast(`Order #${o.id} successfully placed! 🎉`);
      nav("/orders");
    } catch (x) {
      toast(x.message, "err");
    } finally {
      setBusy(false);
    }
  };

  const a = (k) => ({
    value: addr[k],
    onChange: (e) => setAddr({ ...addr, [k]: e.target.value }),
    required: true,
  });

  const totalItems = cart.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="cart">
      <section>
        <div className="row between" style={{ marginBottom: "18px" }}>
          <h1 style={{ margin: 0 }}>{step === "cart" ? "Shopping Bag" : "Checkout"}</h1>

          <div className="row" style={{ gap: "6px" }}>
            <button
              className={`btn sm ${step === "cart" ? "primary" : "ghost"}`}
              onClick={() => setStep("cart")}
            >
              1. Bag
            </button>
            <button
              className={`btn sm ${step === "checkout" ? "primary" : "ghost"}`}
              onClick={() => setStep("checkout")}
            >
              2. Checkout
            </button>
          </div>
        </div>

        {step === "cart" ? (
          <div>
            {cart.items.map(({ product: p, quantity }) => (
              <div className="cart-row" key={p.id}>
                <ProductImage p={p} />

                <div className="grow" style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span className="brand">{p.brand}</span>
                  <Link to={`/product/${p.id}`} className="name">
                    {p.name}
                  </Link>
                  <span className="muted" style={{ fontSize: "0.82rem" }}>
                    {inr(p.price)} each
                  </span>
                </div>

                <div className="qty-control">
                  <button
                    onClick={() => setQty(p.id, quantity - 1)}
                    aria-label="Decrease quantity"
                  >
                    {quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                  </button>
                  <span style={{ fontSize: "0.86rem", fontWeight: 700, minWidth: "18px", textAlign: "center" }}>
                    {quantity}
                  </span>
                  <button
                    disabled={quantity >= p.stock}
                    onClick={() => setQty(p.id, quantity + 1)}
                    aria-label="Increase quantity"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <div className="price" style={{ minWidth: "85px", textAlign: "right", fontSize: "1.05rem" }}>
                  {inr(p.price * quantity)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <form className="card" id="checkout" onSubmit={place} style={{ padding: "24px" }}>
            <h3 style={{ margin: "0 0 14px" }}>Shipping Address</h3>
            <div className="two">
              <label>
                Full Name
                <input {...a("name")} placeholder="Recipient name" />
              </label>
              <label>
                Phone (10 digits)
                <input {...a("phone")} pattern="\d{10}" placeholder="e.g. 9876543210" />
              </label>
            </div>

            <label>
              Address Line
              <input {...a("line1")} minLength={3} placeholder="Flat, building, street" />
            </label>

            <div className="two">
              <label>
                City
                <input {...a("city")} placeholder="City" />
              </label>
              <label>
                Pincode
                <input {...a("pincode")} pattern="\d{6}" placeholder="e.g. 560001" />
              </label>
            </div>

            <h3 style={{ margin: "22px 0 12px" }}>Payment Method</h3>
            <div className="radios">
              {[
                ["UPI", "UPI / QR / Instant Apps", <QrCode size={18} key="upi" />],
                ["CARD", "Credit / Debit Card", <CreditCard size={18} key="card" />],
                ["COD", "Cash on Delivery", <Banknote size={18} key="cod" />],
              ].map(([v, l, icon]) => (
                <label key={v} className={pay === v ? "on" : ""}>
                  <input
                    type="radio"
                    name="payment_method"
                    checked={pay === v}
                    onChange={() => setPay(v)}
                  />
                  {icon}
                  <span>{l}</span>
                </label>
              ))}
            </div>

            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "14px" }}>
              <ShieldCheck size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} />
              Live stock reserved in database. Demonstration checkout.
            </div>
          </form>
        )}
      </section>

      {/* Order Summary */}
      <aside className="summary-card">
        <h3 style={{ margin: 0 }}>Order Summary</h3>

        <div className="row between" style={{ fontSize: "0.88rem" }}>
          <span className="muted">Items ({totalItems}):</span>
          <span>{inr(price.subtotal)}</span>
        </div>

        <div className="row between" style={{ fontSize: "0.88rem" }}>
          <span className="muted">Shipping:</span>
          <span>{price.shipping_fee ? inr(price.shipping_fee) : <span className="ok" style={{ fontWeight: 600 }}>FREE</span>}</span>
        </div>

        {price.discount > 0 && (
          <div className="row between ok" style={{ fontSize: "0.88rem", fontWeight: 600 }}>
            <span>Coupon ({applied}):</span>
            <span>−{inr(price.discount)}</span>
          </div>
        )}

        <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "4px 0" }} />

        <div className="row between" style={{ fontSize: "1.15rem", fontWeight: 800 }}>
          <span>Total:</span>
          <span className="price">{inr(price.total)}</span>
        </div>

        <div className="row" style={{ gap: "6px", marginTop: "4px" }}>
          <Tag size={15} className="muted" />
          <input
            placeholder="Coupon code (SAVE10)"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            style={{ flex: 1, padding: "7px 10px", fontSize: "0.85rem" }}
          />
          <button
            type="button"
            className="btn sm ghost"
            onClick={applyCoupon}
            disabled={!coupon}
          >
            Apply
          </button>
        </div>

        {msg && (
          <small style={{ color: applied ? "var(--ok)" : "var(--bad)", fontWeight: 600 }}>
            {msg}
          </small>
        )}

        {step === "cart" ? (
          <button
            className="btn lg primary"
            onClick={() => setStep("checkout")}
            style={{ marginTop: "8px" }}
          >
            <span>Proceed to Checkout</span>
            <ArrowRight size={16} />
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
            <button
              className="btn lg primary"
              form="checkout"
              disabled={busy}
            >
              {busy ? "Placing Order…" : `Place Order · ${inr(price.total)}`}
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => setStep("cart")}
            >
              Back to Bag
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
