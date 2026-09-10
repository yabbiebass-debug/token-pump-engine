import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Trophy, Play, RotateCcw, ArrowRight } from 'lucide-react';
import { Panel, Eyebrow, Btn, Tag } from '@/components/kit/Primitives';
import { PROMO_CODE } from '@/lib/constants';

const BEATS = 8, NEED = 6, BAND = [0.62, 0.86];

export default function PulsePage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(0);
  const [level, setLevel] = useState(1);
  const [beat, setBeat] = useState(0);
  const [hits, setHits] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [flash, setFlash] = useState(null);
  const [done, setDone] = useState(null);
  const [unlocked, setUnlocked] = useState(localStorage.getItem('pulse_voucher') === PROMO_CODE);
  const raf = useRef();
  const t0 = useRef(0);
  const period = Math.max(650, 1500 - (level - 1) * 180);

  useEffect(() => {
    if (!playing) return;
    t0.current = performance.now();
    const loop = (t) => { setPhase(((t - t0.current) % period) / period); raf.current = requestAnimationFrame(loop); };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, period]);

  const start = () => { setBeat(0); setHits(0); setDone(null); setPlaying(true); };

  const tap = () => {
    if (!playing) return;
    const hit = phase >= BAND[0] && phase <= BAND[1];
    setFlash(hit ? 'HIT' : 'MISS');
    setTimeout(() => setFlash(null), 350);
    const h = hits + (hit ? 1 : 0), b = beat + 1;
    setHits(h); setBeat(b);
    t0.current = performance.now();
    if (b >= BEATS) {
      setPlaying(false);
      const win = h >= NEED;
      setDone({ win, h });
      if (win) {
        setLevel((l) => l + 1);
        if (!unlocked) { localStorage.setItem('pulse_voucher', PROMO_CODE); setUnlocked(true); toast.success(`Voucher ${PROMO_CODE} unlocked — $250 off any build`); }
      }
    }
  };

  const inBand = phase >= BAND[0] && phase <= BAND[1];
  const r = 40 + phase * 100;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 grid gap-8 lg:grid-cols-12 items-start" data-testid="pulse-page">
      <div className="lg:col-span-5 space-y-5">
        <Eyebrow className="text-purple">Pulse · reflex game</Eyebrow>
        <h1 className="font-display text-4xl sm:text-5xl font-black leading-tight">Catch the pulse, <span className="text-green">earn $250</span> off your build.</h1>
        <p className="text-dim text-sm leading-relaxed">Tap when the expanding ring enters the green band. Land {NEED} of {BEATS} beats to clear a level. Clearing level 1 unlocks the <span className="text-ink">{PROMO_CODE}</span> voucher at checkout — every level after tightens the timing.</p>
        <div className="flex flex-wrap gap-2">
          <Tag tone="purple">Level {level}</Tag>
          <Tag tone="dim">Period {period} ms</Tag>
          {unlocked && <Tag tone="green"><Trophy className="h-3 w-3" /> {PROMO_CODE} unlocked</Tag>}
        </div>
        {unlocked && <Btn variant="green" onClick={() => navigate('/pricing')} data-testid="pulse-goto-pricing">Use voucher at checkout <ArrowRight className="h-3.5 w-3.5" /></Btn>}
      </div>

      <Panel className="lg:col-span-7 p-6 flex flex-col items-center gap-5 scanline select-none">
        <div className="flex w-full justify-between text-[10px] uppercase tracking-[1.5px] text-dim">
          <span>Beat <span className="text-ink">{Math.min(beat + (playing ? 1 : 0), BEATS)}</span>/{BEATS}</span>
          <span>Hits <span className="text-green">{hits}</span></span>
          <span className={flash === 'HIT' ? 'text-green' : flash === 'MISS' ? 'text-red' : 'text-dim2'} data-testid="pulse-feedback">{flash || '—'}</span>
        </div>
        <button onClick={tap} disabled={!playing} className="relative h-[300px] w-[300px] rounded-full border border-line-subtle bg-void/70 flex items-center justify-center disabled:cursor-default cursor-pointer" data-testid="pulse-arena" aria-label="Tap arena">
          <div className="absolute rounded-full border-2 border-green/60" style={{ height: `${(40 + BAND[0] * 100) * 2}px`, width: `${(40 + BAND[0] * 100) * 2}px` }} />
          <div className="absolute rounded-full border-2 border-green/60" style={{ height: `${(40 + BAND[1] * 100) * 2}px`, width: `${(40 + BAND[1] * 100) * 2}px` }} />
          <div className="absolute rounded-full bg-green/10" style={{ height: `${(40 + BAND[1] * 100) * 2}px`, width: `${(40 + BAND[1] * 100) * 2}px`, maskImage: `radial-gradient(circle, transparent ${40 + BAND[0] * 100}px, #000 ${40 + BAND[0] * 100}px)`, WebkitMaskImage: `radial-gradient(circle, transparent ${40 + BAND[0] * 100}px, #000 ${40 + BAND[0] * 100}px)` }} />
          {playing && <div className={`absolute rounded-full border-[3px] ${inBand ? 'border-green shadow-[0_0_24px_rgba(20,241,149,0.6)]' : 'border-purple'}`} style={{ height: `${r * 2}px`, width: `${r * 2}px` }} />}
          <div className="font-display text-[12px] font-black text-dim2 uppercase tracking-[2px]">{playing ? 'TAP' : done ? (done.win ? 'CLEARED' : 'RETRY') : 'READY'}</div>
        </button>
        {done && (
          <div className={`text-[12px] ${done.win ? 'text-green' : 'text-red'}`} data-testid="pulse-result">
            {done.win ? `Level cleared · ${done.h}/${BEATS} on beat.` : `${done.h}/${BEATS} — need ${NEED}. Again?`}
          </div>
        )}
        <div className="flex gap-2">
          {!playing ? <Btn variant="primary" onClick={start} data-testid="pulse-start-btn"><Play className="h-3.5 w-3.5" /> {done ? 'Play again' : 'Start'}</Btn> : <Btn variant="ghost" onClick={() => { setPlaying(false); setDone(null); }} data-testid="pulse-stop-btn"><RotateCcw className="h-3.5 w-3.5" /> Reset</Btn>}
        </div>
      </Panel>
    </div>
  );
}
