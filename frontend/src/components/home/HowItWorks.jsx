import React from 'react';
import { Search, GitFork, Bot, Rocket, ShieldAlert, Scale, Landmark } from 'lucide-react';
import { Eyebrow, Panel } from '@/components/kit/Primitives';

const STEPS = [
  { Icon: Search, title: 'Tell us the niche', desc: 'Tell us the corner of the universe that needs a tool — a hobby, a trade, a game, a lab, a market. We scan what already exists and what is missing.' },
  { Icon: GitFork, title: 'Fork, Merge, or Forge', desc: 'We pick the path: adapt one proven repo, merge several into one product, or build from scratch. Fixed price, checkout by card, PayPal, or SOL.' },
  { Icon: Bot, title: 'Agent loop + human gate', desc: 'Nine agents scout, license-check, build, test, and inject. No release ships and no message goes out without Director sign-off.' },
  { Icon: Rocket, title: 'Shipped under your name', desc: 'Published on GitHub and the right registry, with a paid layer if you want one. Optional monthly stewardship keeps it alive.' },
];

const GUARANTEES = [
  { Icon: ShieldAlert, title: 'No rogue releases', desc: 'No agent publishes a package, messages a community, or moves money without explicit approval.' },
  { Icon: Scale, title: 'License-clean by default', desc: 'Every upstream repo and dependency is checked for fork, rebrand, and resale rights before a line is changed.' },
  { Icon: Landmark, title: 'Transparent treasury', desc: 'Every sale, sweep, conversion, and buyback is ledgered in Mission Control, with the SOL treasury visible on Solscan.' },
];

export const HowItWorks = () => (
  <section className="border-y border-line bg-panel/40" data-testid="how-it-works">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 grid gap-12 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <Eyebrow className="text-purple">How a product gets made here</Eyebrow>
        <h2 className="font-display text-base md:text-lg font-black mt-1 mb-6">From niche to shipped repo in four moves</h2>
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 border border-line-subtle bg-panel p-4 rounded-sm hover:border-purple/50 transition-colors" data-testid={`how-step-${i + 1}`}>
              <div className="h-9 w-9 shrink-0 rounded-sm bg-purple/15 border border-purple/40 flex items-center justify-center text-purple">
                <s.Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-[12px] font-black">0{i + 1} · {s.title}</div>
                <p className="text-[11px] text-dim leading-relaxed mt-1">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="lg:col-span-5">
        <Eyebrow className="text-amber">Director guarantees</Eyebrow>
        <h2 className="font-display text-base md:text-lg font-black mt-1 mb-6">Autonomy with a hand on the key</h2>
        <div className="space-y-3">
          {GUARANTEES.map((g) => (
            <Panel key={g.title} className="p-4 border-amber/25">
              <div className="flex items-center gap-2 text-amber font-display text-[12px] font-black"><g.Icon className="h-4 w-4" /> {g.title}</div>
              <p className="text-[11px] text-dim leading-relaxed mt-1.5">{g.desc}</p>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  </section>
);
