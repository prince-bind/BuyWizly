import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Tag, Trash2 } from "lucide-react";
import { api, inr } from "../api";
import { useApp } from "../context";
import { Empty, ProductImage } from "../components/ui";

const blank = { name: "", line1: "", city: "", pincode: "", phone: "" };

export default function CartPage() {
  const { user, cart, setQty, refresh, toast, setAuthOpen } = useApp();
  const nav = useNavigate();
  const [coupon, setCoupon] = useState(""), [applied, setApplied] = useState(null), [msg, setMsg] = useState("");
  const [addr, setAddr] = useState({ ...blank, name: user?.name || "" }), [pay, setPay] = useState("UPI"), [busy, setBusy] = useState(false), [step, setStep] = useState("cart");
  const [price, setPrice] = useState(cart);

  useEffect(() => { setPrice(cart); setApplied(null); setMsg(""); }, [cart]);
  if (!user) return <Empty icon={<ShoppingBag size={44} />} title="Sign in to see your cart"><button className="btn" onClick={() => setAuthOpen(true)}>Sign in</button></Empty>;
  if (!cart.items.length) return <Empty icon={<ShoppingBag size={44} />} title="Your cart is empty"><Link to="/">Continue shopping</Link></Empty>;

  const applyCoupon = async () => {
    try { const q = await api("/api/orders/quote", { method: "POST", body: { coupon_code: coupon } }); setPrice(q); setMsg(q.coupon_message || ""); setApplied(q.discount > 0 ? coupon.toUpperCase() : null); }
    catch (e) { toast(e.message, "err"); }
  };
  const place = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const o = await api("/api/orders/checkout", { method: "POST", body: { address: addr, payment_method: pay, coupon_code: applied } }); await refresh(); toast(`Order #${o.id} placed 🎉`); nav("/orders"); }
    catch (x) { toast(x.message, "err"); } finally { setBusy(false); }
  };
  const a = (k) => ({ value: addr[k], onChange: (e) => setAddr({ ...addr, [k]: e.target.value }), required: true });

  return (
    <div className="cart">
      <section>
        <h1>{step === "cart" ? "Shopping cart" : "Checkout"}</h1>
        {step === "cart" ? cart.items.map(({ product: p, quantity }) => (
          <div className="card cart-row" key={p.id}>
            <ProductImage p={p} />
            <div className="grow"><Link to={`/product/${p.id}`} className="name">{p.name}</Link><span className="muted">{p.brand} · {inr(p.price)} each</span></div>
            <div className="qty"><button className="icon" onClick={() => setQty(p.id, quantity - 1)}>{quantity === 1 ? <Trash2 size={15} /> : <Minus size={15} />}</button><b>{quantity}</b><button className="icon" disabled={quantity >= p.stock} onClick={() => setQty(p.id, quantity + 1)}><Plus size={15} /></button></div>
            <b className="price">{inr(p.price * quantity)}</b>
          </div>
        )) : (
          <form className="card form" id="checkout" onSubmit={place}>
            <h3>Delivery address</h3>
            <div className="two"><label>Full name<input {...a("name")} /></label><label>Phone (10 digits)<input {...a("phone")} pattern="\d{10}" /></label></div>
            <label>Address<input {...a("line1")} minLength={3} /></label>
            <div className="two"><label>City<input {...a("city")} /></label><label>Pincode<input {...a("pincode")} pattern="\d{6}" /></label></div>
            <h3>Payment</h3>
            <div className="radios">{[["UPI", "UPI"], ["CARD", "Credit / Debit card"], ["COD", "Cash on delivery"]].map(([v, l]) => <label key={v} className={pay === v ? "on" : ""}><input type="radio" checked={pay === v} onChange={() => setPay(v)} /> {l}</label>)}</div>
            <p className="muted">Demo project — no real payment is taken.</p>
          </form>
        )}
      </section>
      <aside className="card summary">
        <h3>Order summary</h3>
        <div className="row between"><span>Subtotal</span><span>{inr(price.subtotal)}</span></div>
        <div className="row between"><span>Shipping</span><span>{price.shipping_fee ? inr(price.shipping_fee) : "FREE"}</span></div>
        {price.discount > 0 && <div className="row between ok"><span>Discount ({applied})</span><span>−{inr(price.discount)}</span></div>}
        <hr /><div className="row between total"><span>Total</span><span>{inr(price.total)}</span></div>
        <div className="coupon row"><Tag size={16} /><input placeholder="Coupon (try SAVE10)" value={coupon} onChange={(e) => setCoupon(e.target.value)} /><button className="btn ghost sm" onClick={applyCoupon} disabled={!coupon}>Apply</button></div>
        {msg && <small className={applied ? "ok" : "bad"}>{msg}</small>}
        {step === "cart" ? <button className="btn lg" onClick={() => setStep("checkout")}>Proceed to checkout</button>
          : <><button className="btn lg" form="checkout" disabled={busy}>{busy ? "Placing order…" : `Place order · ${inr(price.total)}`}</button><button className="btn ghost" onClick={() => setStep("cart")}>Back to cart</button></>}
      </aside>
    </div>
  );
}
