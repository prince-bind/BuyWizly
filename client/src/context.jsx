import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [cart, setCart] = useState({ items: [], subtotal: 0, shipping_fee: 0, discount: 0, total: 0 });
  const [wish, setWish] = useState([]);
  const [compare, setCompare] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch { return "light"; } });

  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem("theme", theme); } catch { /* ignore */ } }, [theme]);

  const toast = useCallback((msg, kind = "ok") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) { setCart((c) => ({ ...c, items: [] })); setWish([]); return; }
    const [c, w] = await Promise.all([api("/api/cart"), api("/api/wishlist")]);
    setCart(c); setWish(w.map((p) => p.id));
  }, []);

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try { setUser(await api("/api/auth/me")); await refresh(); } catch { setToken(null); }
      }
      setReady(true);
    })();
  }, [refresh]);

  const session = async (data) => { setToken(data.access_token); setUser(data.user); await refresh(); setAuthOpen(false); toast(`Welcome, ${data.user.name.split(" ")[0]}!`); };
  const login = async (email, password) => session(await api("/api/auth/login", { method: "POST", body: { email, password } }));
  const register = async (name, email, password) => session(await api("/api/auth/register", { method: "POST", body: { name, email, password } }));
  const logout = () => { setToken(null); setUser(null); setCart({ items: [], subtotal: 0, shipping_fee: 0, discount: 0, total: 0 }); setWish([]); toast("Signed out"); };

  const guard = (fn) => async (...a) => {
    if (!user) { setAuthOpen(true); toast("Please sign in first", "warn"); return; }
    try { return await fn(...a); } catch (e) { toast(e.message, "err"); }
  };
  const addToCart = guard(async (pid, quantity = 1) => { await api("/api/cart", { method: "POST", body: { product_id: pid, quantity } }); await refresh(); toast("Added to cart"); });
  const setQty = guard(async (pid, quantity) => { await api(`/api/cart/${pid}`, { method: "PATCH", body: { product_id: pid, quantity } }); await refresh(); });
  const toggleWish = guard(async (pid) => { const r = await api(`/api/wishlist/${pid}`, { method: "POST" }); await refresh(); toast(r.saved ? "Saved to wishlist" : "Removed from wishlist"); });
  const toggleCompare = (p) => setCompare((c) => c.includes(p.id) ? c.filter((x) => x !== p.id) : c.length >= 3 ? (toast("Compare up to 3 products", "warn"), c) : [...c, p.id]);

  const value = { user, ready, cart, wish, compare, setCompare, theme, setTheme, toast, toasts, authOpen, setAuthOpen, chatOpen, setChatOpen,
    login, register, logout, refresh, addToCart, setQty, toggleWish, toggleCompare, cartCount: cart.items.reduce((n, i) => n + i.quantity, 0) };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
