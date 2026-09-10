import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, Zap, Terminal } from 'lucide-react';
import { useFlywheel } from '@/hooks/useData';
import { tiny } from '@/lib/format';

const LINKS = [
  { to: '/', label: 'Home', id: 'home' },
  { to: '/pricing', label: 'Pricing', id: 'pricing' },
  { to: '/mission', label: 'Mission Control', id: 'mission' },
  { to: '/flywheel', label: '$BASH Flywheel', id: 'flywheel', hot: true },
  { to: '/pulse', label: 'Pulse', id: 'pulse' },
];

export const SiteNav = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useFlywheel();
  const token = data?.token;

  const item = (l) => (
    <NavLink
      key={l.id}
      to={l.to}
      end={l.to === '/'}
      data-testid={`nav-${l.id}`}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-sm text-[10.5px] uppercase tracking-[1.5px] transition-colors ${
          isActive ? (l.hot ? 'text-green bg-green/10 border border-green/30' : 'text-ink bg-panel border border-line') : l.hot ? 'text-green/80 hover:text-green' : 'text-dim hover:text-ink'
        }`
      }
    >
      {l.label}
    </NavLink>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-void/85 backdrop-blur-md" data-testid="site-nav">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-[60px] flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5 group" data-testid="nav-logo">
          <div className="h-8 w-8 rounded-sm bg-purple flex items-center justify-center text-white shadow-[0_0_16px_rgba(153,69,255,0.5)] group-hover:rotate-6 transition-transform">
            <Terminal className="h-4 w-4" />
          </div>
          <div className="leading-none">
            <div className="font-display text-[13px] font-black tracking-wide">
              YABB<span className="text-purple">AI</span> FORGE
            </div>
            <div className="text-[8.5px] uppercase tracking-[2.5px] text-dim2">Basham Automations</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">{LINKS.map(item)}</nav>

        <div className="flex items-center gap-2">
          {token && (
            <div className="hidden md:flex items-center gap-2 text-[10px] font-mono border border-line-subtle rounded-sm px-2.5 py-1.5 bg-panel" data-testid="nav-token-price">
              <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
              <span className="text-dim">${token.symbol}</span>
              <span className="text-ink">{tiny(token.price_sol)} SOL</span>
              <span className={token.price_change_24h_pct >= 0 ? 'text-green' : 'text-red'}>
                {token.price_change_24h_pct >= 0 ? '+' : ''}{token.price_change_24h_pct.toFixed(1)}%
              </span>
            </div>
          )}
          <button
            onClick={() => navigate('/pricing')}
            data-testid="nav-cta-start-build"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-sm bg-green px-3.5 py-2 text-[10px] font-bold uppercase tracking-[1.5px] text-void hover:bg-green-hover hover:shadow-[0_0_18px_rgba(20,241,149,0.4)] transition-[background-color,box-shadow]"
          >
            <Zap className="h-3 w-3" /> Start a Build
          </button>
          <button className="lg:hidden text-dim hover:text-ink p-1" onClick={() => setOpen(!open)} data-testid="nav-mobile-toggle" aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden border-t border-line bg-panel px-4 py-3 flex flex-col gap-1.5" data-testid="nav-mobile-menu">
          {LINKS.map(item)}
        </div>
      )}
    </header>
  );
};
