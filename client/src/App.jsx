import { Navigate, Route, Routes, useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import Header from "./components/Header";
import AuthModal from "./components/AuthModal";
import ChatWidget from "./components/ChatWidget";
import { useApp } from "./context";
import Shop from "./pages/Shop";
import ProductPage from "./pages/ProductPage";
import CartPage from "./pages/CartPage";
import OrdersPage from "./pages/OrdersPage";
import WishlistPage from "./pages/WishlistPage";
import ComparePage from "./pages/ComparePage";
import AdminPage from "./pages/AdminPage";
import { ShoppingBag } from "lucide-react";

const Private = ({ children, admin }) => {
  const { user, ready } = useApp();
  if (!ready) {
    return (
      <div className="wrap" style={{ padding: "40px 0" }}>
        <p className="muted">Loading session…</p>
      </div>
    );
  }
  if (!user || (admin && !user.is_admin)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default function App() {
  const { toasts } = useApp();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <Header />

      <main className="wrap">
        <Routes>
          <Route path="/" element={<Shop />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/orders" element={<Private><OrdersPage /></Private>} />
          <Route path="/admin" element={<Private admin><AdminPage /></Private>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Clean Modern Footer */}
      <footer className="foot">
        <div className="wrap row between wrap-row" style={{ gap: "16px" }}>
          <div className="row" style={{ gap: "8px" }}>
            <span
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: "var(--text)",
                color: "var(--surface)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <ShoppingBag size={15} />
            </span>
            <b style={{ color: "var(--text)", fontSize: "0.95rem" }}>BuyWizly</b>
            <span className="muted" style={{ fontSize: "0.82rem", marginLeft: "6px" }}>
              Curated tech with grounded AI intelligence
            </span>
          </div>

          <div className="row wrap-row" style={{ gap: "20px", fontSize: "0.84rem" }}>
            <Link to="/" style={{ color: "var(--text-secondary)" }}>Catalog</Link>
            <Link to="/orders" style={{ color: "var(--text-secondary)" }}>Orders</Link>
            <Link to="/wishlist" style={{ color: "var(--text-secondary)" }}>Wishlist</Link>
            <Link to="/compare" style={{ color: "var(--text-secondary)" }}>Compare</Link>
            <Link to="/admin" style={{ color: "var(--text-secondary)" }}>Admin</Link>
          </div>
        </div>
      </footer>

      <AuthModal />
      <ChatWidget />

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}
