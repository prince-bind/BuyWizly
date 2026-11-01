import { useState } from "react";
import { X } from "lucide-react";
import { useApp } from "../context";

export default function AuthModal() {
  const { authOpen, setAuthOpen, login, register } = useApp();
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  if (!authOpen) return null;
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { mode === "login" ? await login(f.email, f.password) : await register(f.name, f.email, f.password); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="overlay" onClick={() => setAuthOpen(false)}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="icon close" onClick={() => setAuthOpen(false)}><X size={18} /></button>
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="muted">{mode === "login" ? "Sign in to shop, track orders and chat with the assistant." : "Join BuyWizly in a few seconds."}</p>
        {mode === "register" && <label>Name<input required value={f.name} onChange={set("name")} autoComplete="name" /></label>}
        <label>Email<input required type="email" value={f.email} onChange={set("email")} autoComplete="email" /></label>
        <label>Password<input required type="password" minLength={8} value={f.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {err && <div className="alert err">{err}</div>}
        <button className="btn lg" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
        {mode === "login" && <>
          <div className="muted center">
            <small>Testing account: demo@shopsmart.ai / ShopSmart123!</small>
          </div>
          <button type="button" className="btn ghost" onClick={() => setF({ ...f, email: "demo@shopsmart.ai", password: "ShopSmart123!" })}>Fill demo account</button>
        </>}
        <p className="muted center">{mode === "login" ? "New here?" : "Already registered?"}{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); setErr(""); }}>{mode === "login" ? "Create an account" : "Sign in"}</a></p>
      </form>
    </div>
  );
}
