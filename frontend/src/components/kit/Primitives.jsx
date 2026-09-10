import React from 'react';

export const Panel = ({ children, className = '', ...props }) => (
  <div className={`relative border border-line bg-panel/90 backdrop-blur-sm rounded-sm ${className}`} {...props}>
    {children}
  </div>
);

export const Eyebrow = ({ children, className = '' }) => (
  <div className={`text-[10px] uppercase tracking-[2px] font-bold text-dim ${className}`}>{children}</div>
);

export const Stat = ({ label, value, tone = 'text-ink', sub, testId, className = '' }) => (
  <div className={className} data-testid={testId}>
    <div className="text-[9px] uppercase tracking-[1.5px] text-dim font-bold">{label}</div>
    <div className={`font-display text-[15px] font-black leading-tight ${tone}`}>{value}</div>
    {sub && <div className="text-[10px] text-dim2 mt-0.5">{sub}</div>}
  </div>
);

const TAG = {
  green: 'bg-green/10 text-green border-green/30',
  purple: 'bg-purple/15 text-purple border-purple/40',
  amber: 'bg-amber/15 text-amber border-amber/40',
  red: 'bg-red/10 text-red border-red/40',
  dim: 'bg-panel3 text-dim border-line-subtle',
};

export const Tag = ({ children, tone = 'green', className = '', ...props }) => (
  <span className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-[1.5px] px-2 py-0.5 rounded border font-bold ${TAG[tone]} ${className}`} {...props}>
    {children}
  </span>
);

const BTN = {
  primary: 'bg-purple text-white hover:bg-purple-hover hover:shadow-[0_0_18px_rgba(153,69,255,0.45)]',
  green: 'bg-green text-void hover:bg-green-hover hover:shadow-[0_0_18px_rgba(20,241,149,0.4)]',
  amber: 'bg-amber text-void hover:bg-amber/90 hover:shadow-[0_0_15px_rgba(245,166,35,0.35)]',
  ghost: 'border border-line text-dim hover:text-ink hover:border-purple/60 bg-transparent',
  danger: 'border border-red/40 bg-red/10 text-red hover:bg-red/20',
};

export const Btn = ({ variant = 'primary', className = '', children, ...props }) => (
  <button
    className={`inline-flex items-center justify-center gap-1.5 rounded-sm px-4 py-2 text-[10.5px] font-bold uppercase tracking-[1.5px] transition-[background-color,box-shadow,color,transform] duration-200 active:translate-y-px disabled:opacity-40 disabled:pointer-events-none ${BTN[variant]} ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const Field = ({ label, children, hint }) => (
  <label className="block">
    <div className="text-[9.5px] uppercase tracking-[1.5px] text-dim font-bold mb-1">{label}</div>
    {children}
    {hint && <div className="text-[10px] text-dim2 mt-1">{hint}</div>}
  </label>
);

export const inputCls =
  'w-full bg-void border border-line-subtle rounded-sm px-3 py-2 text-[12px] text-ink font-mono placeholder:text-dim2 focus:outline-none focus:border-purple transition-colors';

export const Bar = ({ value, tone = 'bg-green', className = '' }) => (
  <div className={`h-1.5 w-full bg-panel3 rounded-full overflow-hidden ${className}`}>
    <div className={`h-full ${tone} transition-[width] duration-700`} style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }} />
  </div>
);
