import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import {
  GitCompareArrows,
  Heart,
  LogOut,
  Moon,
  Package,
  Search,
  Shield,
  ShoppingBag,
  Sun,
  User,
  X,
  Sparkles,
} from "lucide-react";
import { useApp } from "../context";

export default function Header() {
  const {
    user,
    cartCount,
    wish,
    theme,
    setTheme,
    setAuthOpen,
    logout,
    compare,
    setCompare,
    setChatOpen,
  } = useApp();
  const [q, setQ] = useState("");
  const [sp] = useSearchParams();
  const nav = useNavigate();

  useEffect(() => {
    setQ(sp.get("q") || "");
  }, [sp]);

  const handleSearch = (e) => {
    e?.preventDefault();
    const params = new URLSearchParams(sp);
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    params.set("page", "1");
    nav(`/?${params.toString()}`);
  };

  return (
    <>
      <header className="topbar">
        <div className="wrap row between">
          {/* Brand Logo */}
          <Link to="/" className="logo">
            <span className="logo-badge">
              <ShoppingBag size={18} strokeWidth={2.4} />
            </span>
            <span>BuyWizly</span>
          </Link>

          {/* Clean Modern Search Bar */}
          <form className="modern-search" role="search" onSubmit={handleSearch}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products, brands, categories…"
              aria-label="Search catalog"
            />
            <div className="search-actions-right">
              {q && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => {
                    setQ("");
                    const params = new URLSearchParams(sp);
                    params.delete("q");
                    nav(`/?${params.toString()}`);
                  }}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
              <button
                type="submit"
                className="search-submit-btn"
                title="Search"
                aria-label="Submit search"
              >
                <Search size={15} />
              </button>
            </div>
          </form>

          {/* Right Nav Actions */}
          <nav className="row" style={{ gap: "4px" }}>
            <button
              className="nav-btn"
              onClick={() => setChatOpen(true)}
              title="Open AI Shopping Concierge"
              style={{
                background: "var(--brand-soft)",
                color: "var(--brand-accent)",
                borderColor: "color-mix(in srgb, var(--brand-accent) 20%, transparent)",
              }}
            >
              <Sparkles size={16} />
              <span className="hidden sm:inline">Ask AI</span>
            </button>

            {user && (
              <NavLink
                to="/orders"
                className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}
                title="Your Orders"
              >
                <Package size={17} />
                <span className="hidden sm:inline">Orders</span>
              </NavLink>
            )}

            {user?.is_admin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}
                title="Admin Console"
              >
                <Shield size={17} />
                <span className="hidden sm:inline">Admin</span>
              </NavLink>
            )}

            <NavLink
              to="/wishlist"
              className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}
              title="Wishlist"
              aria-label="Saved Wishlist"
            >
              <Heart size={17} fill={wish.length > 0 ? "currentColor" : "none"} />
              {wish.length > 0 && <span className="nav-badge">{wish.length}</span>}
            </NavLink>

            <NavLink
              to="/cart"
              className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}
              title="Cart"
              aria-label="Shopping Cart"
            >
              <ShoppingBag size={17} />
              {cartCount > 0 && <span className="nav-badge">{cartCount}</span>}
            </NavLink>

            <button
              className="nav-btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              title={theme === "dark" ? "Light theme" : "Dark theme"}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {user ? (
              <button
                className="nav-btn"
                onClick={logout}
                title={`Signed in as ${user.name} · Click to Sign out`}
                style={{ marginLeft: "4px" }}
              >
                <User size={15} />
                <span className="hidden md:inline">{user.name.split(" ")[0]}</span>
                <LogOut size={13} style={{ opacity: 0.6 }} />
              </button>
            ) : (
              <button
                className="btn sm primary"
                onClick={() => setAuthOpen(true)}
                style={{ marginLeft: "4px" }}
              >
                Sign In
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Floating Comparison Dock (only when comparing items) */}
      {compare.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 45,
            background: "var(--text)",
            color: "var(--surface)",
            padding: "10px 18px",
            borderRadius: "var(--r-pill)",
            boxShadow: "var(--shadow-xl)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <span style={{ fontSize: "0.86rem", fontWeight: 600 }}>
            <GitCompareArrows
              size={16}
              style={{ display: "inline", verticalAlign: "-3px", marginRight: "6px" }}
            />
            {compare.length} product{compare.length > 1 ? "s" : ""} selected to compare
          </span>
          <div className="row" style={{ gap: "8px" }}>
            <button
              className="btn sm"
              style={{
                background: "var(--surface)",
                color: "var(--text)",
                fontWeight: 700,
              }}
              disabled={compare.length < 2}
              onClick={() => nav("/compare")}
            >
              Compare now
            </button>
            <button
              className="icon"
              style={{
                width: "28px",
                height: "28px",
                background: "transparent",
                color: "var(--surface)",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
              onClick={() => setCompare([])}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
