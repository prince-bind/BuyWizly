import { useState } from "react";
import { Lock, Mail, Shield, User, X, Zap } from "lucide-react";
import { useApp } from "../context";

export default function AuthModal() {
  const { authOpen, setAuthOpen, login, register } = useApp();
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!authOpen) return null;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(f.email, f.password);
      } else {
        await register(f.name, f.email, f.password);
      }
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="overlay" onClick={() => setAuthOpen(false)}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        aria-modal="true"
        role="dialog"
      >
        <button
          type="button"
          className="icon close"
          onClick={() => setAuthOpen(false)}
          aria-label="Close dialog"
        >
          <X size={17} />
        </button>

        <h2>{mode === "login" ? "Sign in to BuyWizly" : "Create your account"}</h2>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.88rem" }}>
          {mode === "login"
            ? "Access your saved wishlist, past orders, and AI concierge history."
            : "Join our store for member privileges, saved addresses, and express checkouts."}
        </p>

        {mode === "register" && (
          <label>
            Full Name
            <input
              required
              placeholder="e.g. Alex Morgan"
              value={f.name}
              onChange={set("name")}
              autoComplete="name"
            />
          </label>
        )}

        <label>
          Email Address
          <input
            required
            type="email"
            placeholder="name@example.com"
            value={f.email}
            onChange={set("email")}
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            required
            type="password"
            minLength={8}
            placeholder="••••••••"
            value={f.password}
            onChange={set("password")}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>

        {err && <div className="alert err">{err}</div>}

        <button
          className="btn lg"
          disabled={busy}
          style={{ width: "100%", marginTop: "10px" }}
        >
          {busy
            ? "Authenticating…"
            : mode === "login"
            ? "Sign in"
            : "Complete Registration"}
        </button>

        {mode === "login" && (
          <div
            style={{
              marginTop: "12px",
              paddingTop: "14px",
              borderTop: "1px solid var(--border-light)",
            }}
          >
            <button
              type="button"
              className="btn ghost sm"
              style={{ width: "100%", gap: "6px" }}
              onClick={() =>
                setF({
                  ...f,
                  email: "demo@shopsmart.ai",
                  password: "ShopSmart123!",
                })
              }
            >
              <Zap size={14} style={{ color: "var(--brand-accent)" }} />
              <span>Fill Pre-Configured Demo Account</span>
            </button>
            <div className="center" style={{ marginTop: "6px" }}>
              <small className="muted">demo@shopsmart.ai · seeded with order timelines</small>
            </div>
          </div>
        )}

        <p className="muted center" style={{ marginTop: "16px", fontSize: "0.86rem" }}>
          {mode === "login" ? "New to BuyWizly?" : "Already registered?"}{" "}
          <a
            href="#"
            className="link"
            style={{ fontWeight: 600 }}
            onClick={(e) => {
              e.preventDefault();
              setMode(mode === "login" ? "register" : "login");
              setErr("");
            }}
          >
            {mode === "login" ? "Create an account" : "Sign in here"}
          </a>
        </p>
      </form>
    </div>
  );
}
