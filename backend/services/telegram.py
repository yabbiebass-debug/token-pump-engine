import asyncio
import html
import logging
import os
import httpx
from db import db
from constants import TOKEN_MINT
from services.util import utcnow, iso, new_id

log = logging.getLogger('telegram')


def configured() -> bool:
    return bool(os.environ.get('TELEGRAM_BOT_TOKEN', '').strip()) and bool(os.environ.get('TELEGRAM_CHAT_ID', '').strip())


def _base() -> str:
    return f"https://api.telegram.org/bot{os.environ['TELEGRAM_BOT_TOKEN'].strip()}"


async def send(kind: str, text: str) -> dict:
    doc = {'id': new_id('al-'), 'kind': kind, 'text': text, 'created_at': iso(utcnow())}
    if not configured():
        doc['status'] = 'unconfigured'
    else:
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(f"{_base()}/sendMessage", json={'chat_id': os.environ['TELEGRAM_CHAT_ID'].strip(), 'text': text,
                                                                 'parse_mode': 'HTML', 'disable_web_page_preview': True})
            j = r.json()
            if not j.get('ok'):
                raise RuntimeError(j.get('description', 'telegram error'))
            doc.update({'status': 'sent', 'message_id': j['result']['message_id']})
        except Exception as e:
            log.warning('telegram send failed: %s', e)
            doc.update({'status': 'failed', 'error': str(e)})
    await db.alerts.insert_one(dict(doc))
    return doc


def fire(kind: str, text: str):
    asyncio.create_task(send(kind, text))


def injection_text(entry: dict, reserve_after: float) -> str:
    link = f"https://solscan.io/tx/{entry['tx_signature']}" if entry.get('tx_signature') else f"https://pump.fun/coin/{TOKEN_MINT}"
    return (f"🟢 <b>$BASH BUYBACK EXECUTED ON-CHAIN</b>\n"
            f"Amount: <b>{entry['amount_sol']:.4f} SOL</b> (~${entry.get('amount_usd', 0):.2f})\n"
            f"Tokens: {entry['tokens_acquired']:,.0f} $BASH\n"
            f"Price impact: +{entry['impact_pct']:.2f}% · avg {entry['avg_price_sol']:.3e} SOL\n"
            f"Curve: {entry['curve_progress_after_pct']:.3f}% → graduation\n"
            f"Trigger: {html.escape(str(entry['trigger']))} · reserve after: {reserve_after:.4f} SOL\n"
            f"{link}")


def intent_text(intent: dict) -> str:
    return (f"🟡 <b>BUYBACK READY FOR SIGNATURE</b>\n"
            f"Governor released <b>{intent['amount_sol']:.4f} SOL</b> ({html.escape(str(intent['trigger']))}).\n"
            f"Open Mission Control → $BASH Flywheel → Live buyback and sign with the treasury wallet.\n"
            f"Window closes {str(intent.get('expires_at', ''))[11:16]} UTC.")


def delay_text(entry: dict) -> str:
    resumes = str(entry.get('resumes_at', ''))[11:16]
    return (f"⏸ <b>GOVERNOR DELAY</b>\n"
            f"Cap {entry['cap_sol']} SOL/window reached — <b>{entry['amount_sol']:.4f} SOL</b> held in reserve.\n"
            f"Resumes: {resumes} UTC · trigger: {html.escape(str(entry['trigger']))}")


async def status() -> dict:
    bot = None
    if configured():
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                j = (await c.get(f"{_base()}/getMe")).json()
            bot = j['result'].get('username') if j.get('ok') else None
        except Exception as e:
            log.warning('getMe failed: %s', e)
    recent = await db.alerts.find({}, {'_id': 0}).sort('created_at', -1).to_list(20)
    counts = {}
    async for row in db.alerts.aggregate([{'$group': {'_id': '$status', 'n': {'$sum': 1}}}]):
        counts[row['_id']] = row['n']
    return {'configured': configured(), 'token_set': bool(os.environ.get('TELEGRAM_BOT_TOKEN', '').strip()),
            'chat_id_set': bool(os.environ.get('TELEGRAM_CHAT_ID', '').strip()), 'bot_username': bot, 'recent': recent, 'counts': counts}
