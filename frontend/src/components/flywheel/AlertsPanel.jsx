import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, BellOff, Send } from 'lucide-react';
import { Panel, Eyebrow, Tag, Btn } from '@/components/kit/Primitives';
import { getAlertsStatus, sendTestAlert, errMsg } from '@/lib/api';
import { useDirectorGuard } from '@/lib/auth';
import { dateTime } from '@/lib/format';

const STATUS_TONE = { sent: 'green', failed: 'red', unconfigured: 'amber' };

export const AlertsPanel = () => {
  const { data, refetch } = useQuery({ queryKey: ['alerts'], queryFn: getAlertsStatus, refetchInterval: 15000, staleTime: 0 });
  const { guard, isDirector } = useDirectorGuard();
  const [busy, setBusy] = useState(false);

  const test = guard(async () => {
    setBusy(true);
    try { await sendTestAlert(); toast.success('Test alert delivered to Telegram'); refetch(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  });

  if (!data) return null;
  return (
    <Panel className="p-5 space-y-4" data-testid="alerts-panel">
      <div className="flex items-center justify-between">
        <Eyebrow className="flex items-center gap-1.5">{data.configured ? <Bell className="h-3.5 w-3.5 text-green" /> : <BellOff className="h-3.5 w-3.5 text-amber" />} Telegram alerts</Eyebrow>
        <Tag tone={data.configured ? 'green' : 'amber'} data-testid="alerts-status">{data.configured ? `Live · @${data.bot_username || 'bot'}` : 'Not configured'}</Tag>
      </div>
      {!data.configured ? (
        <div className="text-[10.5px] text-dim leading-relaxed space-y-1.5 border border-amber/30 bg-amber/5 rounded-sm p-3" data-testid="alerts-setup">
          <div className="text-amber font-bold uppercase tracking-[1.5px] text-[9px]">Wire it up (3 steps)</div>
          <div>1. Message <span className="text-ink">@BotFather</span> on Telegram → <span className="text-ink">/newbot</span> → copy the bot token.</div>
          <div>2. Add the bot to your channel/group (or DM it), then get the chat ID via <span className="text-ink">@userinfobot</span> or <span className="text-ink">getUpdates</span>.</div>
          <div>3. Set <span className="text-ink">TELEGRAM_BOT_TOKEN</span> and <span className="text-ink">TELEGRAM_CHAT_ID</span> in <span className="text-ink">backend/.env</span> and restart the backend.</div>
          <div className="text-dim2 pt-1">Token set: {data.token_set ? 'yes' : 'no'} · Chat ID set: {data.chat_id_set ? 'yes' : 'no'}. Until then every alert is logged below exactly as it would have been sent.</div>
        </div>
      ) : (
        <div className="text-[10.5px] text-dim">Every INJECTOR buy and every governor delay posts to the configured chat.</div>
      )}
      <div className="flex items-center justify-between">
        <div className="text-[9.5px] text-dim2">Sent {data.counts?.sent || 0} · failed {data.counts?.failed || 0} · queued-unconfigured {data.counts?.unconfigured || 0}</div>
        <Btn variant="ghost" disabled={busy} onClick={test} data-testid="alerts-test-btn" title={isDirector ? '' : 'Director login required'}><Send className="h-3.5 w-3.5" /> Send test</Btn>
      </div>
      <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
        {data.recent.map((a) => (
          <div key={a.id} className="border border-line-subtle rounded-sm p-2.5 text-[10px]" data-testid={`alert-${a.id}`}>
            <div className="flex items-center justify-between mb-1"><Tag tone={STATUS_TONE[a.status] || 'dim'}>{a.status}</Tag><span className="text-dim2">{a.kind} · {dateTime(a.created_at)}</span></div>
            <pre className="whitespace-pre-wrap text-dim font-mono leading-relaxed">{a.text.replace(/<[^>]+>/g, '')}</pre>
            {a.error && <div className="text-red mt-1">{a.error}</div>}
          </div>
        ))}
        {data.recent.length === 0 && <div className="text-[10.5px] text-dim">No alerts yet — they appear here on the next injection or delay.</div>}
      </div>
    </Panel>
  );
};
