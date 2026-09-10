from fastapi import APIRouter, Depends, HTTPException
from services import telegram
from services.auth import get_current_director

router = APIRouter(prefix='/alerts', tags=['alerts'])


@router.get('/status')
async def alerts_status():
    return await telegram.status()


@router.post('/test')
async def alerts_test(user: dict = Depends(get_current_director)):
    if not telegram.configured():
        raise HTTPException(400, 'Telegram not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in backend/.env and restart the backend.')
    doc = await telegram.send('test', f"🔔 <b>YABBAI FORGE</b> test alert — Director {user['email']} wired up Telegram alerts. Injections and governor delays will post here.")
    if doc['status'] != 'sent':
        raise HTTPException(502, f"Telegram rejected the message: {doc.get('error')}")
    return doc
