from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from services import nodes
from services.auth import get_current_director

router = APIRouter(prefix='/nodes', tags=['nodes'])


class RegisterRequest(BaseModel):
    node_id: str = Field(min_length=1, max_length=80)
    wallet: str = Field(min_length=32, max_length=48)
    capacity_sol: float = Field(gt=0, le=1000)
    meta: Optional[dict] = None


class HeartbeatRequest(BaseModel):
    node_id: str
    status: Optional[dict] = None


def _node_auth(authorization: str = Header('')):
    token = authorization[7:] if authorization.startswith('Bearer ') else authorization
    if not nodes.check_key(token):
        raise HTTPException(401, 'bad or missing node API key')
    return True


@router.get('')
async def list_nodes(user: dict = Depends(get_current_director)):
    _ = user
    return await nodes.list_nodes()


@router.post('/register')
async def register(body: RegisterRequest, _ok: bool = Depends(_node_auth)):
    return await nodes.register(body.node_id, body.wallet.strip(), body.capacity_sol, body.meta)


@router.post('/heartbeat')
async def heartbeat(body: HeartbeatRequest, _ok: bool = Depends(_node_auth)):
    try:
        return await nodes.heartbeat(body.node_id, body.status)
    except KeyError as e:
        raise HTTPException(404, str(e))


@router.get('/plan')
async def plan(total_sol: float, user: dict = Depends(get_current_director)):
    _ = user
    return await nodes.plan_window(total_sol)
