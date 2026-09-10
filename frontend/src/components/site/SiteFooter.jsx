import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { TOKEN_MINT, SOL_RECIPIENT } from '@/lib/constants';
import { short } from '@/lib/format';

export const SiteFooter = () => (
  <footer className="border-t border-line bg-panel/60 mt-16" data-testid="site-footer">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-4 text-[11px]">
      <div className="md:col-span-2 space-y-3">
        <div className="font-display text-[14px] font-black">YABB<span className="text-purple">AI</span> FORGE</div>
        <p className="text-dim leading-relaxed max-w-md">
          An open-source product foundry with a token flywheel. We fork, merge, and forge tools for every niche — then route a fixed share of every purchase, every agent cycle, and every mined hash into the $BASH buyback reserve on Solana.
        </p>
        <p className="text-[10px] text-dim2 leading-relaxed max-w-md">
          Buybacks in this build run in SIMULATED (paper) mode against live pump.fun bonding-curve math. No wallet keys are held and no live orders are placed. Payments are demo checkouts. Nothing here is financial advice.
        </p>
      </div>
      <div className="space-y-2">
        <div className="text-[9.5px] uppercase tracking-[2px] text-dim font-bold">Navigate</div>
        {[['/', 'Home'], ['/pricing', 'Pricing & Checkout'], ['/mission', 'Mission Control'], ['/flywheel', '$BASH Flywheel'], ['/pulse', 'Pulse Game']].map(([to, l]) => (
          <Link key={to} to={to} className="block text-dim hover:text-ink transition-colors" data-testid={`footer-link-${l.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{l}</Link>
        ))}
      </div>
      <div className="space-y-2">
        <div className="text-[9.5px] uppercase tracking-[2px] text-dim font-bold">On-chain</div>
        <a href={`https://pump.fun/coin/${TOKEN_MINT}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-green hover:underline" data-testid="footer-pump-link">
          pump.fun · {short(TOKEN_MINT)} <ExternalLink className="h-3 w-3" />
        </a>
        <a href={`https://dexscreener.com/solana/${TOKEN_MINT}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-dim hover:text-ink" data-testid="footer-dex-link">
          DexScreener <ExternalLink className="h-3 w-3" />
        </a>
        <a href={`https://solscan.io/account/${SOL_RECIPIENT}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-dim hover:text-ink" data-testid="footer-solscan-link">
          Treasury {short(SOL_RECIPIENT)} <ExternalLink className="h-3 w-3" />
        </a>
        <a href="https://github.com/bashammm/YABBAI---BASHAM-AUTO" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-dim hover:text-ink" data-testid="footer-github-link">
          GitHub source <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
    <div className="border-t border-line-subtle text-center text-[9.5px] uppercase tracking-[2px] text-dim2 py-4">
      © {new Date().getFullYear()} Basham Automations · YabbAI Forge v2 · Director-gated agents
    </div>
  </footer>
);
