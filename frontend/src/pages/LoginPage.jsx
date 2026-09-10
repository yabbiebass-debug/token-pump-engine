import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Lock, ShieldCheck, LogOut } from 'lucide-react';
import { Panel, Eyebrow, Btn, Field, inputCls, Tag } from '@/components/kit/Primitives';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/api';

export default function LoginPage() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/mission';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setError(''); }, [email, password]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await login(email.trim(), password);
      toast.success(`Director session opened · ${u.email}`);
      navigate(next);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 grid gap-10 lg:grid-cols-12 items-center" data-testid="login-page">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="relative lg:col-span-6 space-y-5">
        <Eyebrow className="text-amber flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Director access</Eyebrow>
        <h1 className="font-display text-4xl sm:text-5xl font-black leading-tight">The hand on the <span className="text-amber">amber key.</span></h1>
        <p className="text-dim text-sm leading-relaxed max-w-lg">
          Only the Director can approve or reject gates, change flywheel rules, run or automate cycles, fire manual injections, and dispatch SOL from the vault. Everything else — the ledger, the curve, the token feed — stays public.
        </p>
        <div className="flex flex-wrap gap-2">
          {['Gate approvals', 'Flywheel config', 'Vault withdrawals', 'Run / auto cycle', 'Inject · Convert · +1h'].map((t) => <Tag key={t} tone="amber">{t}</Tag>)}
        </div>
      </div>

      <Panel className="relative lg:col-span-5 lg:col-start-8 p-6 space-y-4 scanline">
        {user ? (
          <div className="space-y-4" data-testid="login-already">
            <div className="flex items-center gap-2 text-green"><ShieldCheck className="h-5 w-5" /><div className="font-display text-[14px] font-black">Signed in as Director</div></div>
            <div className="text-[11px] text-dim">{user.email}</div>
            <div className="flex gap-2">
              <Btn variant="green" onClick={() => navigate(next)} data-testid="login-continue-btn">Continue</Btn>
              <Btn variant="ghost" onClick={logout} data-testid="login-logout-btn"><LogOut className="h-3.5 w-3.5" /> Sign out</Btn>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <Eyebrow>Sign in</Eyebrow>
            <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="director@…" autoComplete="username" data-testid="login-email" required /></Field>
            <Field label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" autoComplete="current-password" data-testid="login-password" required /></Field>
            {error && <div className="text-[11px] text-red border border-red/40 bg-red/10 rounded-sm px-3 py-2" data-testid="login-error">{error}</div>}
            <Btn type="submit" variant="amber" className="w-full py-2.5" disabled={busy} data-testid="login-submit">{busy ? 'Verifying…' : 'Unlock Director controls'}</Btn>
            <p className="text-[9.5px] text-dim2 leading-relaxed">Five failed attempts lock the account for 15 minutes. Sessions refresh silently for 7 days.</p>
          </form>
        )}
      </Panel>
    </div>
  );
}
