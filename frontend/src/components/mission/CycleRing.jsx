import React from 'react';
import { STAGES, GATED } from '@/lib/constants';

const CX = 150, CY = 150, R = 108;
const polar = (deg, r) => { const a = ((deg - 90) * Math.PI) / 180; return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }; };
const arc = (s, e) => { const a = polar(s, R), b = polar(e, R); return `M ${a.x} ${a.y} A ${R} ${R} 0 ${e - s > 180 ? 1 : 0} 1 ${b.x} ${b.y}`; };

export const CycleRing = ({ cycles, activeStage }) => {
  const step = 360 / STAGES.length;
  return (
    <div className="relative w-full max-w-[280px] mx-auto" data-testid="cycle-ring">
      <svg viewBox="0 0 300 300" className="block h-auto w-full select-none" role="img" aria-label="Eight-stage cycle with Director gates">
        {STAGES.map((name, i) => {
          const active = activeStage === i, gate = GATED.has(name), reinvest = name === 'REINVEST';
          const color = gate ? '#f5a623' : reinvest ? '#14f195' : '#9945ff';
          return (
            <path key={name} d={arc(i * step + 2, (i + 1) * step - 2)} fill="none" strokeWidth={13}
              stroke={active ? color : gate ? 'rgba(245,166,35,0.25)' : reinvest ? 'rgba(20,241,149,0.25)' : '#1b2030'}
              style={active ? { filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke 150ms' } : { transition: 'stroke 300ms' }} />
          );
        })}
        {STAGES.map((name, i) => {
          const mid = i * step + step / 2, label = polar(mid, R + 25), dot = polar(mid, R), gate = GATED.has(name), active = activeStage === i;
          return (
            <g key={`l-${name}`}>
              {gate && (<><circle cx={dot.x} cy={dot.y} r={8} fill="#090a0f" stroke="#f5a623" strokeWidth={1.8} /><text x={dot.x} y={dot.y + 3} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#f5a623">⚿</text></>)}
              <text x={label.x} y={label.y + 3} textAnchor="middle" fontSize="8" letterSpacing="1" fontFamily="JetBrains Mono, monospace"
                fill={active ? '#f0f3f8' : gate ? '#f5a623' : name === 'REINVEST' ? '#14f195' : '#9aa3b5'} fontWeight={active ? 700 : 500}>{name}</text>
            </g>
          );
        })}
        <text x={CX} y={145} textAnchor="middle" fontFamily="Unbounded, sans-serif" fontSize="30" fontWeight="800" fill="#f0f3f8" data-testid="cycle-count">{cycles}</text>
        <text x={CX} y={166} textAnchor="middle" fontSize="8" letterSpacing="3" fill="#9aa3b5" fontFamily="JetBrains Mono, monospace">CYCLES RUN</text>
      </svg>
    </div>
  );
};
