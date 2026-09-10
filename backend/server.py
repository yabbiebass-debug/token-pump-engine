import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402
from db import client  # noqa: E402
from seed import ensure_seed  # noqa: E402
from services.scheduler import scheduler_loop  # noqa: E402
from routers import state, cycle, leads, approvals, payments, withdrawals, flywheel, market, agent_demo  # noqa: E402

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('server')


@asynccontextmanager
async def lifespan(_: FastAPI):
    await ensure_seed()
    task = asyncio.create_task(scheduler_loop())
    logger.info('seed verified, scheduler started')
    yield
    task.cancel()
    client.close()


app = FastAPI(title='YABBAI Forge · $BASH Flywheel API', lifespan=lifespan)

for r in (state, cycle, leads, approvals, payments, withdrawals, flywheel, market, agent_demo):
    app.include_router(r.router, prefix='/api')


@app.get('/api/')
async def root():
    return {'service': 'yabbai-forge', 'status': 'online'}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=['*'],
    allow_headers=['*'],
)
