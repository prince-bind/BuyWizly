import { Star } from "lucide-react";

export const Stars = ({ value, count }) => (
  <span className="stars" title={`${value} out of 5`}>
    <Star size={14} fill="currentColor" /> <b>{Number(value).toFixed(1)}</b>
    {count != null && <span className="muted"> ({count})</span>}
  </span>
);

export const Skeleton = ({ n = 8 }) => (
  <div className="grid">{Array.from({ length: n }, (_, i) => <div key={i} className="card skel"><div className="skel-img" /><div className="skel-line" /><div className="skel-line short" /></div>)}</div>
);

export const Empty = ({ icon, title, children }) => (
  <div className="empty">{icon}<h3>{title}</h3><p className="muted">{children}</p></div>
);

export function ProductImage({ p, className = "" }) {
  return <img className={className} src={p.image_url} alt={p.name} loading="lazy"
    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />;
}

/** tiny safe markdown: **bold** and line breaks only (no HTML injection) */
export const Md = ({ text }) => (
  <>{text.split("\n").map((line, i) => (
    <p key={i}>{line.split(/(\*\*[^*]+\*\*)/g).map((s, j) => s.startsWith("**") ? <b key={j}>{s.slice(2, -2)}</b> : s)}</p>
  ))}</>
);
