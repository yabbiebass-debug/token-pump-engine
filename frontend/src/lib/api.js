import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const API_BASE = API;
export const api = axios.create({ baseURL: API });
const data = (p) => p.then((r) => r.data);

const ACCESS = 'yabbai_access';
const REFRESH = 'yabbai_refresh';
export const tokens = {
  get: () => localStorage.getItem(ACCESS),
  getRefresh: () => localStorage.getItem(REFRESH),
  set: (access, refresh) => { localStorage.setItem(ACCESS, access); if (refresh) localStorage.setItem(REFRESH, refresh); },
  clear: () => { localStorage.removeItem(ACCESS); localStorage.removeItem(REFRESH); },
};

api.interceptors.request.use((config) => {
  const t = tokens.get();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const orig = err.config || {};
    const isAuthCall = (orig.url || '').includes('/auth/');
    if (err.response?.status === 401 && !orig._retry && !isAuthCall) {
      orig._retry = true;
      const rt = tokens.getRefresh();
      if (rt) {
        try {
          const { data: d } = await axios.post(`${API}/auth/refresh`, { refresh_token: rt });
          tokens.set(d.access_token);
          orig.headers = { ...(orig.headers || {}), Authorization: `Bearer ${d.access_token}` };
          return api(orig);
        } catch (_) { /* fall through */ }
      }
      if (tokens.get() || rt) {
        tokens.clear();
        window.dispatchEvent(new Event('yabbai:logout'));
      }
    }
    return Promise.reject(err);
  },
);

export const login = (email, password) => data(api.post('/auth/login', { email, password }));
export const logout = () => data(api.post('/auth/logout'));
export const me = () => data(api.get('/auth/me'));
export const refreshSession = (refresh_token) => data(axios.post(`${API}/auth/refresh`, { refresh_token }));

export const getState = () => data(api.get('/state'));
export const getMeta = () => data(api.get('/meta'));
export const getFlywheel = () => data(api.get('/flywheel/status'));
export const getLedger = (limit = 120) => data(api.get('/flywheel/ledger', { params: { limit } }));
export const getHistory = () => data(api.get('/flywheel/history'));
export const getTokenLive = () => data(api.get('/token/live'));
export const getWallet = (address) => data(api.get(`/wallet/${address}`));
export const getVault = () => data(api.get('/vault'));
export const getAlertsStatus = () => data(api.get('/alerts/status'));
export const getLiveStatus = () => data(api.get('/live/status'));
export const getMining = () => data(api.get('/mining/status'));
export const estimateMining = (hashrates) => data(api.post('/mining/estimate', { hashrates }));
export const getLiveQuote = (amount_sol) => data(api.get('/live/quote', { params: { amount_sol } }));
export const liveBuild = (body) => data(api.post('/live/build', body));
export const liveConfirm = (body) => data(api.post('/live/confirm', body));
export const liveDismiss = (intent_id) => data(api.post('/live/dismiss', { intent_id }));
export const ledgerCsvUrl = (type) => `${API}/flywheel/ledger.csv${type && type !== 'all' ? `?type=${type}` : ''}`;

export const runCycle = () => data(api.post('/cycle/run'));
export const setAutoCycle = (auto_cycle) => data(api.patch('/state/auto-cycle', { auto_cycle }));
export const approveGate = (id) => data(api.post(`/approvals/${id}/approve`));
export const rejectGate = (id) => data(api.post(`/approvals/${id}/reject`));
export const createLead = (body) => data(api.post('/leads', body));
export const moveLead = (id, stage) => data(api.patch(`/leads/${id}/stage`, { stage }));
export const createPayment = (body) => data(api.post('/payments', body));
export const quotePayment = (body) => data(api.post('/payments/quote', body));
export const verifySol = (signature, expected_sol) => data(api.post('/payments/verify-sol', { signature, expected_sol }));
export const createWithdrawal = (body) => data(api.post('/withdrawals', body));
export const getTreasuryActivity = () => data(api.get('/treasury/activity'));
export const syncTreasury = () => data(api.post('/treasury/sync'));
export const updateClient = (id, body) => data(api.patch(`/clients/${id}`, body));
export const updateFlywheelConfig = (body) => data(api.put('/flywheel/config', body));
export const injectNow = () => data(api.post('/flywheel/inject'));
export const sendTestAlert = () => data(api.post('/alerts/test'));

export const errMsg = (e) => {
  const d = e?.response?.data?.detail;
  if (d == null) return e?.message || 'Request failed';
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => (x && typeof x.msg === 'string' ? x.msg : JSON.stringify(x))).join(' ');
  if (typeof d.msg === 'string') return d.msg;
  return String(d);
};

export async function streamAgentDemo(body, onDelta) {
  const res = await fetch(`${API}/agent-demo/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`stream failed (${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let meta = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop();
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      const item = JSON.parse(line.slice(5));
      if (item.delta) onDelta(item.delta);
      if (item.done) meta = item;
    }
  }
  return meta;
}
