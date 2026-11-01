export const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const KEY = "shopsmart_token";
export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* storage blocked */ } };

export async function api(path, { method = "GET", body, form, params } = {}) {
  const qs = params ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null && v !== false)) : "";
  const headers = {};
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (body) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(API + path + qs, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data.detail;
    throw Object.assign(new Error(Array.isArray(d) ? d.map((e) => e.msg).join(", ") : d || "Something went wrong"), { status: res.status });
  }
  return data;
}

/** Stream the assistant over Server-Sent Events. Calls onMeta / onToken / onDone as events arrive. */
export async function streamChat(message, sessionId, { onMeta, onToken, onDone, signal }) {
  const res = await fetch(`${API}/api/assistant/chat/stream`, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Assistant unavailable");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = /event: (.+)/.exec(block)?.[1];
      const data = JSON.parse(/data: (.+)/s.exec(block)?.[1] ?? "null");
      if (ev === "meta") onMeta?.(data); else if (ev === "token") onToken?.(data); else if (ev === "done") onDone?.(data);
      else if (ev === "error") throw new Error(data);
    }
  }
}

export const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
export const fmtDate = (s) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
