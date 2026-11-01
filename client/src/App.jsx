import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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

const Private = ({ children, admin }) => {
  const { user, ready } = useApp();
  if (!ready) return <div className="wrap"><p className="muted">Loading…</p></div>;
  if (!user || (admin && !user.is_admin)) return <Navigate to="/" replace />;
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
      <footer className="foot wrap muted">AskCart · RAG-powered shopping assistant · demo project</footer>
      <AuthModal /><ChatWidget />
      <div className="toasts">{toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}</div>
    </>
  );
}
