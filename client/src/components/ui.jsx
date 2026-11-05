import { useState } from "react";
import { Star, Package } from "lucide-react";

export const Stars = ({ value, count }) => (
  <span className="stars" title={`${value} out of 5 stars`}>
    <Star size={13} fill="currentColor" strokeWidth={0} />
    <b>{Number(value).toFixed(1)}</b>
    {count != null && <span className="muted">({count})</span>}
  </span>
);

export const Skeleton = ({ n = 8 }) => (
  <div className="grid">
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="card skel">
        <div className="skel-img" />
        <div className="skel-line" style={{ width: "40%" }} />
        <div className="skel-line" style={{ width: "75%" }} />
        <div className="skel-line short" />
      </div>
    ))}
  </div>
);

export const Empty = ({ icon, title, children }) => (
  <div className="empty">
    {icon}
    <h3>{title}</h3>
    <div style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.55 }}>
      {children}
    </div>
  </div>
);

export function ProductImage({ p, className = "" }) {
  const [failed, setFailed] = useState(!p?.image_url);

  if (failed || !p?.image_url) {
    return (
      <div
        className={`img-fallback ${className}`}
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          background: "var(--surface2)",
          color: "var(--muted)",
        }}
      >
        <Package size={32} opacity={0.3} />
      </div>
    );
  }

  return (
    <img
      className={className}
      src={p.image_url}
      alt={p.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** tiny safe markdown: **bold** and line breaks only (no HTML injection) */
export const Md = ({ text }) => (
  <>
    {text.split("\n").map((line, i) => (
      <p key={i}>
        {line.split(/(\*\*[^*]+\*\*)/g).map((s, j) =>
          s.startsWith("**") ? <b key={j}>{s.slice(2, -2)}</b> : s
        )}
      </p>
    ))}
  </>
);
