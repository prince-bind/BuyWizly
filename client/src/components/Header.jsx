import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { GitCompareArrows, Heart, LogOut, Moon, Package, Search, Shield, ShoppingCart, Sparkles, Sun, X } from "lucide-react";
import { useApp } from "../context";

export default function Header() {
  const { user, cartCount, wish, theme, setTheme, setAuthOpen, logout, compare, setCompare } = useApp();
  const [q, setQ] = useState("");
  const nav = useNavigate();
  return (
    <>
      <header className="topbar">
        <div className="wrap row between">
          <Link to="/" className="logo"><span><Sparkles size={18} /></span>BuyWizly</Link>
          <form className="search" onSubmit={(e) => { e.preventDefault(); nav(`/?q=${encodeURIComponent(q)}`); }}>
            <Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, brands, categories…" />
          </form>
          <nav className="row">
            {user && <NavLink to="/orders" className="navbtn"><Package size={18} /><span>Orders</span></NavLink>}
            {user?.is_admin && <NavLink to="/admin" className="navbtn"><Shield size={18} /><span>Admin</span></NavLink>}
            <NavLink to="/wishlist" className="navbtn"><Heart size={18} />{wish.length > 0 && <i>{wish.length}</i>}</NavLink>
            <NavLink to="/cart" className="navbtn"><ShoppingCart size={18} />{cartCount > 0 && <i>{cartCount}</i>}</NavLink>
            <button className="navbtn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
            {user ? <button className="navbtn" onClick={logout} title={`${user.name} · ${user.membership_tier}`}><LogOut size={18} /></button>
                  : <button className="btn sm" onClick={() => setAuthOpen(true)}>Sign in</button>}
          </nav>
        </div>
      </header>
      {compare.length > 0 && (
        <div className="tray row between">
          <span><GitCompareArrows size={16} /> {compare.length} selected to compare</span>
          <span className="row"><button className="btn sm" disabled={compare.length < 2} onClick={() => nav("/compare")}>Compare now</button>
            <button className="icon" onClick={() => setCompare([])}><X size={16} /></button></span>
        </div>
      )}
    </>
  );
}
