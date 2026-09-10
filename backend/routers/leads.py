import random
from fastapi import APIRouter, HTTPException
from db import db
from models import LeadCreate, LeadStageUpdate
from services.events import add_event
from services.util import utcnow, iso, new_id

router = APIRouter(tags=['leads'])


@router.get('/leads')
async def list_leads():
    return await db.leads.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)


@router.post('/leads', status_code=201)
async def create_lead(body: LeadCreate):
    lead = {
        'id': new_id('lead-'), 'biz': body.biz.strip(), 'niche': body.niche, 'region': body.region, 'email': body.email.strip(),
        'phone': body.phone.strip(), 'pain': body.pain.strip() or 'No maintained open-source tool for this niche', 'fit': 'High fit',
        'score': random.randint(80, 99), 'stage': 'SCOUT', 'source': body.source, 'notes': 'Ingested into autonomous agent operating loop.',
        'created_at': iso(utcnow()), 'estimatedValue': body.estimatedValue,
    }
    await db.leads.insert_one(dict(lead))
    await add_event('SCOUT', f"Request ingested: \"{lead['biz']}\" ({lead['niche']}). QUALIFIER scanning upstream repos.")
    return lead


@router.patch('/leads/{lead_id}/stage')
async def move_lead(lead_id: str, body: LeadStageUpdate):
    res = await db.leads.find_one_and_update({'id': lead_id}, {'$set': {'stage': body.stage}}, projection={'_id': 0}, return_document=True)
    if not res:
        raise HTTPException(404, 'lead not found')
    await add_event('QUALIFIER', f"Lead \"{res['biz']}\" moved to {body.stage} by Director.")
    return res
