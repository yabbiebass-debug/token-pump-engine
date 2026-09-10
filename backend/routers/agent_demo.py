import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from models import AgentDemoRequest
from services.agent import stream_agent

router = APIRouter(tags=['agent-demo'])


@router.post('/agent-demo/stream')
async def agent_demo_stream(body: AgentDemoRequest):
    async def gen():
        async for item in stream_agent(body.agentType, body.userInput, body.sessionId):
            yield f"data: {json.dumps(item)}\n\n"
    return StreamingResponse(gen(), media_type='text/event-stream', headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


@router.post('/agent-demo')
async def agent_demo(body: AgentDemoRequest):
    reply, meta = '', {}
    async for item in stream_agent(body.agentType, body.userInput, body.sessionId):
        if 'delta' in item:
            reply += item['delta']
        elif item.get('done'):
            meta = item
    return {'reply': reply, 'data': meta.get('data'), 'source': meta.get('source')}
