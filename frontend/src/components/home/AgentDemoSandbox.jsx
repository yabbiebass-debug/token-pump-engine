import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Play, Sparkles } from 'lucide-react';
import { Eyebrow, Panel, Btn, Tag, inputCls } from '@/components/kit/Primitives';
import { streamAgentDemo } from '@/lib/api';

const AGENTS = [
  { id: 'quoter', label: 'QUALIFIER · fork plan', placeholder: 'Describe the product you need. e.g. "A trip planner for a 2,000-member hiking club with Stripe dues and Discord roster sync."' },
  { id: 'extractor', label: 'FORGE · license audit', placeholder: 'Paste a package.json / requirements.txt or list dependencies. e.g. "react, express, ffmpeg (GPL), leaflet, stripe"' },
  { id: 'retention', label: 'SHIPPER · release notes', placeholder: 'Paste a diff summary or changelog notes. e.g. "added offline mode, CSV export, fixed sync bug #42, plugin API"' },
];

const sessionId = () => {
  let id = localStorage.getItem('yabbai_session');
  if (!id) { id = Math.random().toString(36).slice(2); localStorage.setItem('yabbai_session', id); }
  return id;
};

export const AgentDemoSandbox = () => {
  const navigate = useNavigate();
  const [agent, setAgent] = useState(AGENTS[0]);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [meta, setMeta] = useState(null);
  const [running, setRunning] = useState(false);
  const [latency, setLatency] = useState(null);
  const boxRef = useRef(null);

  const run = async () => {
    if (!input.trim() || running) return;
    setRunning(true); setOutput(''); setMeta(null); setLatency(null);
    const start = performance.now();
    try {
      const m = await streamAgentDemo({ agentType: agent.id, userInput: input.trim(), sessionId: sessionId() }, (delta) => {
        setOutput((o) => o + delta);
        if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
      });
      setMeta(m);
    } catch (e) {
      setOutput(`[AGENT OFFLINE] ${e.message}`);
    } finally {
      setLatency(Math.round(performance.now() - start));
      setRunning(false);
    }
  };

  return (
    <section id="demo-section" className="mx-auto max-w-7xl px-4 sm:px-6 py-16" data-testid="agent-demo">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow className="text-green">Test-drive live agents</Eyebrow>
          <h2 className="font-display text-base md:text-lg font-black mt-1">Same models that run Mission Control, streaming</h2>
        </div>
        <Tag tone="purple"><Sparkles className="h-3 w-3" /> Gemini via server-side stream</Tag>
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-5 p-5 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {AGENTS.map((a) => (
              <button key={a.id} onClick={() => { setAgent(a); setOutput(''); setMeta(null); }} data-testid={`demo-agent-${a.id}`}
                className={`px-2.5 py-1.5 rounded-sm text-[9.5px] uppercase tracking-[1.5px] border transition-colors ${agent.id === a.id ? 'bg-purple/20 border-purple text-ink' : 'border-line-subtle text-dim hover:text-ink'}`}>
                {a.label}
              </button>
            ))}
          </div>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={6} placeholder={agent.placeholder} className={inputCls + ' resize-none'} data-testid="demo-input" />
          <div className="flex items-center justify-between gap-3">
            <Btn variant="green" onClick={run} disabled={running || !input.trim()} data-testid="demo-run-btn">
              <Play className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} /> {running ? 'Streaming…' : 'Run agent'}
            </Btn>
            <button className="text-[10px] text-dim hover:text-ink underline" onClick={() => setInput(agent.placeholder.split('e.g. ')[1]?.replace(/"/g, '') || '')} data-testid="demo-use-example-btn">use example</button>
          </div>
        </Panel>
        <Panel className="lg:col-span-7 p-0 overflow-hidden terminal">
          <div className="flex items-center justify-between border-b border-line-subtle px-4 py-2 text-[10px]">
            <div className="flex items-center gap-2 text-dim"><Terminal className="h-3.5 w-3.5 text-green" /> agent://{agent.id} · session {sessionId().slice(0, 6)}</div>
            <div className="flex items-center gap-2">
              {meta?.source && <Tag tone={meta.source === 'fallback' ? 'amber' : 'green'}>{meta.source}</Tag>}
              {latency !== null && <span className="text-dim2">{latency} ms</span>}
            </div>
          </div>
          <pre ref={boxRef} className="h-[260px] overflow-y-auto whitespace-pre-wrap p-4 text-[11.5px] leading-relaxed text-ink font-mono" data-testid="demo-output">
            {output || <span className="text-dim2">Awaiting input. Output streams token-by-token from the backend agent and ends with a Director gate line.</span>}
            {running && <span className="inline-block w-2 h-3 bg-green ml-0.5 animate-pulse align-middle" />}
          </pre>
          {meta?.data && (
            <div className="border-t border-line-subtle px-4 py-3 flex flex-wrap items-center gap-2" data-testid="demo-meta">
              {Object.entries(meta.data).map(([k, v]) => <Tag key={k} tone="dim">{k}: {String(v)}</Tag>)}
              <Btn variant="primary" className="ml-auto" onClick={() => navigate(`/pricing?pkg=${meta.data.suggestedPackage || 'Merge'}`)} data-testid="demo-lock-in-btn">Lock in a build</Btn>
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
};
