import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API });
const data = (p) => p.then((r) => r.data);

export const getState = () => data(api.get('/state'));
export const getMeta = () => data(api.get('/meta'));
export const getFlywheel = () => data(api.get('/flywheel/status'));
export const getLedger = (limit = 120) => data(api.get('/flywheel/ledger', { params: { limit } }));
export const getHistory = () => data(api.get('/flywheel/history'));
export const getTokenLive = () => data(api.get('/token/live'));
export const getWallet = (address) => data(api.get(`/wallet/${address}`));
export const getVault = () => data(api.get('/vault'));

export const runCycle = () => data(api.post('/cycle/run'));
export const setAutoCycle = (auto_cycle) => data(api.patch('/state/auto-cycle', { auto_cycle }));
export const approveGate = (id) => data(api.post(`/approvals/${id}/approve`));
export const rejectGate = (id) => data(api.post(`/approvals/${id}/reject`));
export const createLead = (body) => data(api.post('/leads', body));
export const moveLead = (id, stage) => data(api.patch(`/leads/${id}/stage`, { stage }));
export const createPayment = (body) => data(api.post('/payments', body));
export const createWithdrawal = (body) => data(api.post('/withdrawals', body));
export const updateFlywheelConfig = (body) => data(api.put('/flywheel/config', body));
export const fastForward = () => data(api.post('/flywheel/fast-forward'));
export const injectNow = () => data(api.post('/flywheel/inject'));
export const convertNow = () => data(api.post('/flywheel/convert'));

export const errMsg = (e) => e?.response?.data?.detail || e?.message || 'Request failed';

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
