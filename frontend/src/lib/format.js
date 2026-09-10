export const usd = (n, d = 0) =>
  '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const num = (n, d = 0) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: d });
export const sol = (n, d = 4) => `${Number(n || 0).toFixed(d)} SOL`;
export const pct = (n, d = 2) => `${Number(n || 0).toFixed(d)}%`;
export const short = (s, a = 6, b = 4) => (s ? `${s.slice(0, a)}…${s.slice(-b)}` : '');
export const compact = (n) => {
  const v = Number(n || 0);
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k';
  return v.toFixed(v < 10 ? 2 : 0);
};
export const tiny = (n) => {
  const v = Number(n || 0);
  if (v === 0) return '0';
  if (v < 0.01) return v.toFixed(11).replace(/0+$/, '');
  return v.toFixed(4);
};
export const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
export const dateTime = (iso) =>
  iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const timeAgo = (iso) => {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
export const countdown = (secs) => {
  const s = Math.max(0, Number(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = Math.floor(s % 60);
  return h ? `${h}h ${m}m` : `${m}m ${String(r).padStart(2, '0')}s`;
};
